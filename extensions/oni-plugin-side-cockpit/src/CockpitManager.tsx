import * as Oni from "oni-api"
import * as React from "react"
import { find } from "lodash"
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
        this._mainEditor.onTabsUpdate.subscribe(currentTabId => {
            const state = this._store.getState()
            if (state.activeTabId === currentTabId) {
                // TODO check if one tab was deleted, delete tab state as well, or listen explicetly for "tab close" event, probably easier
                return
            }

            const tab = state.tabs[currentTabId]
            if (tab) {
                if (tab.bufferId) {
                    this.replaceCockpitBuffer(tab.bufferId)
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
        })

        this._cockpitEditor = this._oni.neovimEditorFactory.createEditor()
        this._cockpitEditor.init([])
    }

    private replaceCockpitBuffer(bufferId: string): void {
        // TODO add getBufferById from BufferManager to NeovimEditor
        const buffer = find(this._mainEditor.getBuffers(), ({ id }) => id === bufferId)
        if (!buffer) {
            throw new Error("Can't find buffer by id: " + bufferId)
        }
        this.emptyCockpitEditor()
        this._cockpitEditor.openFile(buffer.filePath, {
            openMode: Oni.FileOpenMode.ExistingTab,
        })
    }

    private emptyCockpitEditor(): void {
        // https://www.reddit.com/r/vim/comments/8d4dee/how_do_i_close_all_files_but_not_quit_vim/
        this._cockpitEditor.neovim.command(":bufdo bwipeout")
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
