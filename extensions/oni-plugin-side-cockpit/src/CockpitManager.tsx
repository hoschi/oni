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

interface BufferChangedEvent {
    buffer: Oni.Buffer
}

function isActiveBuffer(buffer: Oni.Buffer | Oni.InactiveBuffer): buffer is Oni.Buffer {
    return (buffer as Oni.Buffer).getLines !== undefined
}

export class CockpitManager implements Oni.IWindowSplit {
    private _split: Oni.WindowSplitHandle
    private _store: Store<ICockpitManagerState>
    private _cockpitEditor: Oni.Editor
    private _mainEditor: Oni.Editor

    constructor(private _oni: Oni.Plugin.Api) {
        this._store = createStore(this._oni)
    }

    public open(): void {
        const editorSplit = this._oni.windows.activeSplitHandle
        this._split = this._oni.windows.createSplit("vertical", this)
        editorSplit.focus()

        this._mainEditor = this._oni.editors.anyEditor

        this._mainEditor.onTabsUpdate.subscribe(this.onTabsUpdate.bind(this))
        this._mainEditor.onBufferChanged.subscribe(this.onBufferChanged.bind(this))

        this._cockpitEditor = this._oni.neovimEditorFactory.createEditor()
        this._cockpitEditor.init([])
    }

    private async onTabsUpdate(currentTabId: number): Promise<void> {
        const state = this._store.getState()
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
            this._store.dispatch({
                type: "ADD_TAB",
                currentTabId,
            })
            this.emptyCockpitEditor()
        }
        this._store.dispatch({
            type: "SET_CURRENT_TAB_ID",
            currentTabId,
        })
    }

    private onBufferChanged({ buffer }: BufferChangedEvent): void {
        this._oni.log.info(`sc - buffer changed "${buffer.id}" modified:${buffer.modified}`)
        const state = this._store.getState()
        const activeTab = state.tabs[state.activeTabId]
        if (buffer.id !== activeTab.bufferId) {
            return
        }

        if (buffer.modified) {
            this.applyDirtyBufferChanges(buffer)
        } else {
            this._cockpitEditor.neovim.command(":e!")
        }
    }

    private async replaceCockpitBuffer(bufferId: string): Promise<void> {
        let buffer = this.getMainEditorBuffer(bufferId)
        if (!buffer) {
            throw new Error("Can't find buffer by id: " + bufferId)
        }
        this.emptyCockpitEditor()
        this._cockpitEditor.openFile(buffer.filePath, {
            openMode: Oni.FileOpenMode.ExistingTab,
        })

        if (buffer.modified) {
            if (isActiveBuffer(buffer)) {
                this.applyDirtyBufferChanges(buffer as Oni.Buffer)
            } else {
                const reponse = await this._mainEditor.neovim.request<void>("nvim_call_atomic", [
                    [["nvim_command", [":vsp"]], ["nvim_command", [":b " + bufferId]]],
                ])

                buffer = this.getMainEditorBuffer(bufferId)
                this.applyDirtyBufferChanges(buffer as Oni.Buffer)
                this._mainEditor.neovim.command(":q")
            }
        }
    }

    private getMainEditorBuffer(bufferId: string): Oni.Buffer | Oni.InactiveBuffer {
        // TODO add getBufferById from BufferManager to NeovimEditor
        return find(this._mainEditor.getBuffers(), ({ id }) => id === bufferId)
    }

    private async applyDirtyBufferChanges(buffer: Oni.Buffer): Promise<void> {
        const lines = await buffer.getLines()
        this._cockpitEditor.activeBuffer.setLines(
            0,
            this._cockpitEditor.activeBuffer.lineCount,
            lines,
        )
    }

    private emptyCockpitEditor(): void {
        // https://www.reddit.com/r/vim/comments/8d4dee/how_do_i_close_all_files_but_not_quit_vim/
        this._cockpitEditor.neovim.command(":bufdo bwipeout!")
    }

    public pushToCockpit(): void {
        const bufferId = this._mainEditor.activeBuffer.id
        if (!bufferId) {
            return
        }

        this._store.dispatch({
            type: "SET_BUFFER",
            bufferId: bufferId,
        })
        this.replaceCockpitBuffer(bufferId)
    }

    public pushToEditor(): void {
        const file = this._cockpitEditor.activeBuffer.filePath
        if (!file) {
            return
        }
        this._mainEditor.openFile(file, {
            openMode: Oni.FileOpenMode.ExistingTab,
        })
    }

    public render(): JSX.Element {
        return (
            <Provider store={this._store}>
                <div>
                    <h1>Cockpit</h1>
                    <CockpitEditor editor={this._cockpitEditor} />
                    <div className="enable-mouse">
                        test:{" "}
                        <button
                            onClick={() => {
                                this._oni.log.info("sc: test")
                                this._store.dispatch({
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
