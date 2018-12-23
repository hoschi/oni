import * as Oni from "oni-api"
import * as React from "react"
import { Provider } from "react-redux"
import { Reducer, Store } from "redux"
import { CockpitEditor } from "./CockpitEditor"

export class CockpitTab {
    public bufferId: string | null
    constructor(public tabId: number) {}
}

export interface ICockpitManagerState {
    activeTabId: number
    tabs: CockpitTab[]
}

export class CockpitManager implements Oni.IWindowSplit {
    private _split: Oni.WindowSplitHandle
    private _store: Store<ICockpitManagerState>
    private _cockpitEditor: Oni.Editor

    constructor(private _oni: Oni.Plugin.Api) {
        this._store = createStore(this._oni)
    }

    public open(): void {
        const editorSplit = this._oni.windows.activeSplitHandle
        this._split = this._oni.windows.createSplit("vertical", this)
        editorSplit.focus()

        this._cockpitEditor = this._oni.neovimEditorFactory.createEditor()
        this._cockpitEditor.init([])
    }

    public pushToCockpit(): void {
        const file = this._oni.editors.anyEditor.activeBuffer.filePath
        if (!file) {
            return
        }

        this._cockpitEditor.openFile(file, {
            openMode: Oni.FileOpenMode.ExistingTab,
        })
    }

    public pushToEditor(): void {
        const file = this._cockpitEditor.activeBuffer.filePath
        if (!file) {
            return
        }
        this._oni.editors.anyEditor.openFile(file, {
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
    activeTabId: 0,
    tabs: [new CockpitTab(0)],
}

type CockpitManagerActions =
    | {
          type: "CLOSE_TAB"
      }
    | {
          type: "SET_BUFFER"
          bufferId: string | null
      }

const cockpitManagerReducer: Reducer<ICockpitManagerState> = (
    state: ICockpitManagerState = DefaultCockpitManagerState,
    action: CockpitManagerActions,
) => {
    switch (action.type) {
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
