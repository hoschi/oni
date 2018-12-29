import * as Oni from "oni-api"
import * as React from "react"
import { find, hasIn } from "lodash"
import { Provider } from "react-redux"
import { Reducer, Store } from "redux"
import { CockpitEditor } from "./CockpitEditor"

export class CockpitTab {
    public bufferId: string | null
    constructor(public tabId: number) {}
}

export interface ICockpitManagerState {
    activeTabId: number
    tabs: { [id: number]: CockpitTab }
}

function isActiveBuffer(buffer: Oni.Buffer | Oni.InactiveBuffer): buffer is Oni.Buffer {
    return (buffer as Oni.Buffer).getLines !== undefined
}

export class CockpitManager implements Oni.IWindowSplit {
    private split: Oni.WindowSplitHandle
    private store: Store<ICockpitManagerState>
    private cockpitEditor: Oni.Editor
    private mainEditor: Oni.Editor

    constructor(private oni: Oni.Plugin.Api) {
        this.store = createStore(this.oni)
    }

    public open(): void {
        const editorSplit = this.oni.windows.activeSplitHandle
        this.split = this.oni.windows.createSplit("vertical", this)
        editorSplit.focus()

        this.mainEditor = this.oni.editors.anyEditor

        this.mainEditor.onTabsUpdate.subscribe(this.onTabsUpdate.bind(this))
        this.mainEditor.onBufferChanged.subscribe(this.onBufferChanged.bind(this))
        this.mainEditor.onBufferSaved.subscribe(this.onBufferSaved.bind(this))

        this.cockpitEditor = this.oni.neovimEditorFactory.createEditor()
        this.cockpitEditor.init([])
    }

    private async onTabsUpdate(currentTabId: number): Promise<void> {
        const state = this.store.getState()
        if (state.activeTabId === currentTabId) {
            // TODO check if one tab was deleted, delete tab state as well, or listen explicetly for "tab close" event, probably easier
            return
        }

        const tab = state.tabs[currentTabId]
        if (tab) {
            if (tab.bufferId) {
                await this.replaceCockpitBuffer(tab.bufferId)
            } else {
                this.emptyCockpitEditor()
            }
        } else {
            this.store.dispatch({
                type: "ADD_TAB",
                currentTabId,
            })
            this.emptyCockpitEditor()
        }
        this.store.dispatch({
            type: "SET_CURRENT_TAB_ID",
            currentTabId,
        })
    }

    private onBufferSaved(evt: Oni.EditorBufferSavedEventArgs): void {
        this.oni.log.info(`sc - buffer saved "${evt.id}"`)
        const activeTab = this.getActiveTabState()
        if (!activeTab || evt.id !== activeTab.bufferId) {
            return
        }
        this.cockpitEditor.neovim.command(":e!")
    }

    private onBufferChanged({ buffer }: Oni.EditorBufferChangedEventArgs): void {
        this.oni.log.info(`sc - buffer changed "${buffer.id}" modified:${buffer.modified}`)
        const activeTab = this.getActiveTabState()
        if (!activeTab || buffer.id !== activeTab.bufferId) {
            return
        }

        if (buffer.modified) {
            this.applyDirtyBufferChanges(buffer)
        } else {
            this.cockpitEditor.neovim.command(":e!")
        }
    }

    private async replaceCockpitBuffer(bufferId: string): Promise<void> {
        let buffer = this.getMainEditorBuffer(bufferId)
        if (!buffer) {
            throw new Error("Can't find buffer by id: " + bufferId)
        }
        this.emptyCockpitEditor()
        this.cockpitEditor.openFile(buffer.filePath, {
            openMode: Oni.FileOpenMode.ExistingTab,
        })

        if (buffer.modified) {
            if (isActiveBuffer(buffer)) {
                this.applyDirtyBufferChanges(buffer as Oni.Buffer)
            } else {
                const reponse = await this.mainEditor.neovim.request<void>("nvim_call_atomic", [
                    [["nvim_command", [":vsp"]], ["nvim_command", [":b " + bufferId]]],
                ])

                buffer = this.getMainEditorBuffer(bufferId)
                this.applyDirtyBufferChanges(buffer as Oni.Buffer)
                this.mainEditor.neovim.command(":q")
            }
        }
    }

    private getMainEditorBuffer(bufferId: string): Oni.Buffer | Oni.InactiveBuffer {
        // TODO add getBufferById from BufferManager to NeovimEditor
        return find(this.mainEditor.getBuffers(), ({ id }) => id === bufferId)
    }

    private async applyDirtyBufferChanges(buffer: Oni.Buffer): Promise<void> {
        const lines = await buffer.getLines()
        this.cockpitEditor.activeBuffer.setLines(
            0,
            this.cockpitEditor.activeBuffer.lineCount,
            lines,
        )
    }

    private emptyCockpitEditor(): void {
        // https://www.reddit.com/r/vim/comments/8d4dee/how_do_i_close_all_files_but_not_quit_vim/
        this.cockpitEditor.neovim.command(":bufdo bwipeout!")
    }

    private getActiveTabState(): CockpitTab | void {
        const state = this.store.getState()
        return state.tabs[state.activeTabId]
    }

    public pushToCockpit(): void {
        const bufferId = this.mainEditor.activeBuffer.id
        if (!bufferId) {
            return
        }

        this.store.dispatch({
            type: "SET_BUFFER",
            bufferId: bufferId,
        })
        this.replaceCockpitBuffer(bufferId)
    }

    public pushToEditor(): void {
        const file = this.cockpitEditor.activeBuffer.filePath
        if (!file) {
            return
        }
        this.mainEditor.openFile(file, {
            openMode: Oni.FileOpenMode.ExistingTab,
        })
    }

    public render(): JSX.Element {
        return (
            <Provider store={this.store}>
                <div>
                    <h1>Cockpit</h1>
                    <CockpitEditor editor={this.cockpitEditor} />
                    <div className="enable-mouse">
                        test:{" "}
                        <button
                            onClick={() => {
                                this.oni.log.info("sc: test")
                                this.store.dispatch({
                                    type: "SET_BUFFER",
                                    bufferId: "./test.js",
                                })
                            }}
                        >
                            click me
                        </button>
                    </div>
                </div>
            </Provider>
        )
    }
}

const DefaultCockpitManagerState: ICockpitManagerState = {
    activeTabId: null,
    tabs: {},
}

type CockpitManagerActions =
    | {
          type: "SET_BUFFER"
          bufferId: string | null
      }
    | {
          type: "ADD_TAB"
          currentTabId: number
      }
    | {
          type: "SET_CURRENT_TAB_ID"
          currentTabId: number
      }

const cockpitManagerReducer: Reducer<ICockpitManagerState> = (
    state: ICockpitManagerState = DefaultCockpitManagerState,
    action: CockpitManagerActions,
) => {
    switch (action.type) {
        case "SET_BUFFER":
            return {
                ...state,
                tabs: {
                    ...state.tabs,
                    [state.activeTabId]: {
                        ...state.tabs[state.activeTabId],
                        bufferId: action.bufferId,
                    },
                },
            }
        case "ADD_TAB":
            return {
                ...state,
                tabs: {
                    ...state.tabs,
                    [action.currentTabId]: new CockpitTab(action.currentTabId),
                },
            }
        case "SET_CURRENT_TAB_ID":
            return {
                ...state,
                activeTabId: action.currentTabId,
            }
        default:
            return state
    }
}

const createStore = (oni: Oni.Plugin.Api): Store<ICockpitManagerState> => {
    return oni.createReduxStore(
        "CockpitManager",
        cockpitManagerReducer,
        DefaultCockpitManagerState,
        [],
    )
}
