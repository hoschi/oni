import * as Oni from "oni-api"
import * as React from "react"
import { find, hasIn } from "lodash"
import { Provider } from "react-redux"
import { Reducer, Store } from "redux"
import { CockpitEditor } from "./CockpitEditor"

export class CockpitTab {
    public bufferId: string | null
    public topLine: number | null
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
    private attachedBuffer: Oni.Buffer

    constructor(private oni: Oni.Plugin.Api) {
        this.store = createStore(this.oni)
    }

    public open(): void {
        const editorSplit = this.oni.windows.activeSplitHandle
        this.split = this.oni.windows.createSplit("vertical", this)
        editorSplit.focus()

        this.mainEditor = this.oni.editors.anyEditor

        this.mainEditor.onTabsUpdate.subscribe(this.onTabsUpdate.bind(this))
        this.mainEditor.onBufferEnter.subscribe(this.onBufferEnter.bind(this))
        this.mainEditor.onBufferLeave.subscribe(this.onBufferLeave.bind(this))
        this.mainEditor.onBufferSaved.subscribe(this.onBufferSaved.bind(this))
        this.mainEditor.neovim.onBufLinesEvent.subscribe(this.onBufLinesEvent.bind(this))
        this.mainEditor.neovim.onBufDetachEvent.subscribe(this.onBufDetachEvent.bind(this))

        this.cockpitEditor = this.oni.neovimEditorFactory.createEditor()
        this.cockpitEditor.init([])
    }

    private async onBufLinesEvent(evt: Oni.IBufLinesEvent) {
        this.oni.log.info(
            `sc - onBufLinesEvent (${evt.buf}), lines ${evt.firstline}-${
                evt.lastline
            }, linedata count ${evt.linedata.length}`,
        )
        this.cockpitEditor.activeBuffer.setLines(evt.firstline, evt.lastline, evt.linedata)
        this.cockpitEditor.neovim.input("z<CR>")
    }

    private async onBufDetachEvent(bufferId: string) {
        this.oni.log.info(`sc - onBufDetachEvent (${bufferId})`)
        const activeTab = this.getActiveTabState()
        if (this.isSyncingBuffer(bufferId)) {
            if (this.attachedBuffer) {
                const success = await this.attachedBuffer.attach()
                this.oni.log.info(`sc - reattached buffer ${bufferId} success:${success}`)
                if (success) {
                    await this.replaceCockpitBuffer(this.mainEditor.activeBuffer.id)
                }
            } else {
                throw new Error("sc - I don't think this will happen - tried to reattach buffer")
            }
        }
    }

    private async onTabsUpdate(currentTabId: number): Promise<void> {
        const state = this.store.getState()
        this.oni.log.info(`sc - tabs update, current:${currentTabId}, before:${state.activeTabId}`)
        if (state.activeTabId === currentTabId) {
            // TODO check if one tab was deleted, delete tab state as well, or listen explicetly for "tab close" event, probably easier
            return
        }

        this.store.dispatch({
            type: "SET_CURRENT_TAB_ID",
            currentTabId,
        })
        const activeTab = this.getActiveTabState()
        if (activeTab) {
            if (activeTab.bufferId) {
                await this.replaceCockpitBuffer(activeTab.bufferId)
            } else {
                await this.emptyCockpitEditor()
            }
        } else {
            this.store.dispatch({
                type: "ADD_TAB",
                currentTabId,
            })
            await this.emptyCockpitEditor()
        }
    }

    private async setCockpitBufferToDiskState(bufferId: string): Promise<void> {
        const activeTab = this.getActiveTabState()
        if (bufferId !== activeTab.bufferId) {
            return
        }
        await this.cockpitEditor.neovim.command(":e!")
        this.setEditorCursorToState(this.cockpitEditor, activeTab.topLine)
    }

    private onBufferSaved(evt: Oni.EditorBufferSavedEventArgs): void {
        this.oni.log.info(`sc - buffer saved "${evt.id}"`)
        this.setCockpitBufferToDiskState(evt.id)
    }

    private async onBufferEnter(evt: Oni.EditorBufferEventArgs): Promise<void> {
        this.oni.log.info(`sc - buffer enter "${evt.id}" modified:${evt.modified}`)
        if (!this.isSyncingBuffer(null) || this.attachedBuffer) {
            return
        }

        this.attachedBuffer = this.mainEditor.activeBuffer
        const success = await this.attachedBuffer.attach()
        this.oni.log.info(`sc - buffer enter - attched buffer "${evt.id}" ${success}`)
    }

    private async onBufferLeave(evt: Oni.EditorBufferEventArgs): Promise<void> {
        this.oni.log.info(`sc - buffer leave "${evt.id}" modified:${evt.modified}`)

        this.detachBuffer()
    }

    private async detachBuffer(): Promise<void> {
        if (!this.attachedBuffer) {
            return
        }
        const id = this.attachedBuffer.id
        const success = await this.attachedBuffer.detach()
        this.attachedBuffer = undefined
        this.oni.log.info(`sc - detached buffer "${id}" ${success}`)
    }

    private async replaceCockpitBuffer(bufferId: string): Promise<void> {
        let buffer = this.getMainEditorBuffer(bufferId)
        if (!buffer) {
            throw new Error("Can't find buffer by id: " + bufferId)
        }
        await this.cockpitEditor.neovim.command(":GitGutterDisable")
        this.oni.log.info(`sc - disabled Git Gutter`)
        await this.emptyCockpitEditor()
        await this.cockpitEditor.openFile(buffer.filePath, {
            openMode: Oni.FileOpenMode.ExistingTab,
        })

        const activeTab = this.getActiveTabState()
        const isSyncingBuffer = this.isSyncingBuffer(buffer.id)
        const attachIfNeeded = async (activeBuffer: Oni.Buffer) => {
            if (!isSyncingBuffer) {
                return
            }
            const success = await activeBuffer.attach()
            this.attachedBuffer = activeBuffer
            this.oni.log.info(
                `sc - attached buffer "${buffer.id}" ${success}, while replacing cockpit buffer`,
            )
        }

        if (isActiveBuffer(buffer)) {
            const activeBuffer = buffer as Oni.Buffer
            if (buffer.modified) {
                await this.applyDirtyBufferChanges(activeBuffer)
            }
            await attachIfNeeded(activeBuffer)
        } else {
            await this.mainEditor.neovim.request<void>("nvim_call_atomic", [
                [["nvim_command", [":vsp"]], ["nvim_command", [":b " + bufferId]]],
            ])

            buffer = this.getMainEditorBuffer(bufferId)
            const activeBuffer = buffer as Oni.Buffer
            if (buffer.modified) {
                await this.applyDirtyBufferChanges(activeBuffer)
            }
            await attachIfNeeded(activeBuffer)
            await this.mainEditor.neovim.command(":q")
        }

        await this.setEditorCursorToState(this.cockpitEditor, activeTab.topLine)
        await this.cockpitEditor.neovim.command(":GitGutterEnable")
        this.oni.log.info(`sc - enabled Git Gutter`)
    }

    private async setEditorCursorToState(editor: Oni.Editor, topLine: number): Promise<void> {
        const buffer = editor.activeBuffer
        await buffer.setCursorPosition(topLine, 0)
        editor.neovim.input("z<CR>")
    }

    private getMainEditorBuffer(bufferId: string): Oni.Buffer | Oni.InactiveBuffer {
        // TODO add getBufferById from BufferManager to NeovimEditor
        return find(this.mainEditor.getBuffers(), ({ id }) => id === bufferId)
    }

    private async applyDirtyBufferChanges(buffer: Oni.Buffer): Promise<void> {
        this.oni.log.info("sc - replaced all lines in cockpit buffer")
        const lines = await buffer.getLines()
        await this.cockpitEditor.activeBuffer.setLines(
            0,
            this.cockpitEditor.activeBuffer.lineCount,
            lines,
        )
    }

    private async emptyCockpitEditor(): Promise<void> {
        this.detachBuffer()
        // https://www.reddit.com/r/vim/comments/8d4dee/how_do_i_close_all_files_but_not_quit_vim/
        await this.cockpitEditor.neovim.command(":bufdo bwipeout!")
    }

    private getActiveTabState(): CockpitTab {
        const state = this.store.getState()
        return state.tabs[state.activeTabId]
    }

    private isSyncingBuffer(bufferId: string): boolean {
        let ret: boolean
        const activeTab = this.getActiveTabState()
        const isSame = !!(
            activeTab &&
            activeTab.bufferId &&
            this.mainEditor.activeBuffer.id === activeTab.bufferId
        )
        if (bufferId) {
            ret = isSame && bufferId === activeTab.bufferId
        } else {
            ret = isSame
        }
        return !!ret
    }

    public async pushToCockpit(): Promise<void> {
        const buffer = this.mainEditor.activeBuffer
        if (!buffer) {
            return
        }
        const pos = await buffer.getCursorPosition()
        this.store.dispatch({
            type: "SET_BUFFER",
            bufferId: buffer.id,
            topLine: pos.line,
        })
        this.replaceCockpitBuffer(buffer.id)
    }

    public async pushToEditor(): Promise<void> {
        const activeTab = this.getActiveTabState()
        if (!activeTab.bufferId) {
            return
        }
        await this.mainEditor.neovim.command(`:b ${activeTab.bufferId}`)
        await this.setEditorCursorToState(this.mainEditor, activeTab.topLine)
    }

    public async swapEditors(): Promise<void> {
        const buffer = this.mainEditor.activeBuffer
        const activeTab = this.getActiveTabState()

        if (!buffer.filePath && !activeTab.bufferId) {
            return
        } else if (!buffer.filePath) {
            return this.pushToEditor()
        } else if (!activeTab.bufferId) {
            return this.pushToCockpit()
        } else {
            // swap
            await this.mainEditor.neovim.command(":norm H")
            const posEditorBefore = await buffer.getCursorPosition()
            this.pushToEditor()
            this.store.dispatch({
                type: "SET_BUFFER",
                bufferId: buffer.id,
                topLine: posEditorBefore.line,
            })
            this.replaceCockpitBuffer(buffer.id)
        }
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
                                    topLine: 0,
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
          topLine: number
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
                        topLine: action.topLine,
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
