/**
 * BufferManager.ts
 *
 * Helpers to manage buffer state
 */

import * as os from "os"
import * as types from "vscode-languageserver-types"

import { Observable } from "rxjs/Observable"

import "rxjs/add/observable/defer"
import "rxjs/add/observable/from"
import "rxjs/add/operator/concatMap"

import { Store } from "redux"

import * as detectIndent from "detect-indent"

import * as Oni from "oni-api"
import * as Log from "oni-core-logging"

import {
    BufferEventContext,
    EventContext,
    InactiveBufferContext,
    NeovimInstance,
} from "./../neovim"
import * as LanguageManager from "./../Services/Language"
import { PromiseQueue } from "./../Services/Language/PromiseQueue"

import {
    BufferHighlightId,
    BufferHighlightsUpdater,
    IBufferHighlightsUpdater,
} from "./BufferHighlights"

import * as Actions from "./NeovimEditor/NeovimEditorActions"
import * as State from "./NeovimEditor/NeovimEditorStore"

import * as Constants from "./../Constants"
import { TokenColor } from "./../Services/TokenColors"

import { IBufferLayer } from "./NeovimEditor/BufferLayerManager"

/**
 * Candidate API methods
 */
export interface IBuffer extends Oni.Buffer {
    tabstop: number
    shiftwidth: number
    comment: ICommentFormats

    setLanguage(lang: string): Promise<void>
    getLayerById<T>(id: string): T

    getCursorPosition(): Promise<types.Position>
    handleInput(key: string): boolean
    detectIndentation(): Promise<BufferIndentationInfo>
    setScratchBuffer(): Promise<void>
}

type NvimError = [1, string]

interface ICommentFormats {
    start: string
    middle: string
    end: string
    defaults: string[]
}

const isStringArray = (value: NvimError | string[]): value is string[] => {
    if (value && Array.isArray(value)) {
        return typeof value[0] === "string"
    }
    return false
}

export type IndentationType = "tab" | "space"

export interface BufferIndentationInfo {
    type: IndentationType

    // If indentation is 'space', this is how
    // many spaces are at a particular tabstop
    amount: number

    // String value for indentation
    indent: string
}

const getStringFromTypeAndAmount = (type: IndentationType, amount: number): string => {
    if (type === "tab") {
        return "\t"
    } else {
        let str = ""
        for (let i = 0; i < amount; i++) {
            str += " "
        }
        return str
    }
}

export class Buffer implements IBuffer {
    private _id: string
    private _filePath: string
    private _language: string
    private _cursor: Oni.Cursor
    private _cursorOffset: number
    private _version: number
    private _modified: boolean
    private _lineCount: number
    private _tabstop: number
    private _shiftwidth: number
    private _comment: ICommentFormats

    private _bufferHighlightId: BufferHighlightId = null

    private _promiseQueue = new PromiseQueue()

    public get shiftwidth(): number {
        return this._shiftwidth
    }

    public get tabstop(): number {
        return this._tabstop
    }

    public get comment(): ICommentFormats {
        return this._comment
    }

    public get filePath(): string {
        return this._filePath
    }

    public get language(): string {
        return this._language
    }

    public get lineCount(): number {
        return this._lineCount
    }

    public get cursor(): Oni.Cursor {
        return this._cursor
    }

    public get cursorOffset(): number {
        return this._cursorOffset
    }

    public get version(): number {
        return this._version
    }

    public get modified(): boolean {
        return this._modified
    }

    public get id(): string {
        return this._id
    }

    constructor(
        private _neovimInstance: NeovimInstance,
        private _actions: typeof Actions,
        private _store: Store<State.IState>,
        evt: EventContext,
    ) {
        this.updateFromEvent(evt)
    }

    public addLayer(layer: IBufferLayer): void {
        this._actions.addBufferLayer(parseInt(this._id, 10), layer)
    }

    public getLayerById<T>(id: string): T | null {
        return (
            ((this._store
                .getState()
                .layers[parseInt(this._id, 10)].find(layer => layer.id === id) as any) as T) || null
        )
    }

    public removeLayer(layer: IBufferLayer): void {
        this._actions.removeBufferLayer(parseInt(this._id, 10), layer)
    }

    /**
     * convertOffsetToLineColumn
     */
    public async convertOffsetToLineColumn(
        cursorOffset = this._cursorOffset,
    ): Promise<types.Position> {
        const line: number = await this._neovimInstance.callFunction("byte2line", [cursorOffset])
        const countFromLine: number = await this._neovimInstance.callFunction("line2byte", [line])
        const column = cursorOffset - countFromLine
        return types.Position.create(line - 1, column)
    }

    public async getCursorPosition(): Promise<types.Position> {
        const pos = await this._neovimInstance.callFunction("getpos", ["."])
        const [, oneBasedLine, oneBasedColumn] = pos
        return types.Position.create(oneBasedLine - 1, oneBasedColumn - 1)
    }

    public async attach(): Promise<boolean> {
        const ret = await this._neovimInstance.request<boolean | string>("nvim_buf_attach", [
            parseInt(this._id, 10),
            false,
            {},
        ])
        if (ret === true || ret === false) {
            return ret
        } else {
            Log.error(`nvim_buf_attach errror: ${ret}`)
            return false
        }
    }

    public async detach(): Promise<boolean> {
        const ret = await this._neovimInstance.request<boolean | string>("nvim_buf_detach", [
            parseInt(this._id, 10),
        ])
        if (ret === true || ret === false) {
            return ret
        } else {
            Log.error(`nvim_buf_detach errror: ${ret}`)
            return false
        }
    }

    public async getLines(start?: number, end?: number): Promise<string[]> {
        if (typeof start !== "number") {
            start = 0
        }

        if (typeof end !== "number") {
            end = this._lineCount
        }

        if (end - start > 2500) {
            Log.warn("getLines called with over 2500 lines, this may cause instability.")
        }

        // Neovim does not error if it is unable to get lines instead it returns an array
        // of type [1, "an error message"] **on Some occasions**, we only check the first on the assumption that
        // that is where the number is placed by neovim
        const lines = await this._neovimInstance.request<string[]>("nvim_buf_get_lines", [
            parseInt(this._id, 10),
            start,
            end,
            false,
        ])

        if (isStringArray(lines)) {
            return lines
        }
        return []
    }

    public async setLanguage(language: string): Promise<void> {
        this._language = language
        await this._neovimInstance.command(`setl ft=${language}`)
    }

    public async setScratchBuffer(): Promise<void> {
        // set the open buffer to be a readonly throw away buffer, also add scrollbind
        // may need a config option
        const calls = [
            ["nvim_command", ["setlocal buftype=nofile"]],
            ["nvim_command", ["setlocal bufhidden=hide"]],
            ["nvim_command", ["setlocal noswapfile"]],
            ["nvim_command", ["setlocal nobuflisted"]],
            ["nvim_command", ["setlocal nomodifiable"]],
        ]

        const [result, error] = await this._neovimInstance.request<any[] | NvimError>(
            "nvim_call_atomic",
            [calls],
        )

        if (typeof result === "number" && error) {
            Log.info(`Failed to set scratch buffer due to ${error}`)
        }
        this._modified = false
    }

    public async detectIndentation(): Promise<BufferIndentationInfo> {
        const bufferLines = await this.getLines(0, 1024)

        const ret = detectIndent(bufferLines.join("\n"))

        // We were able to infer tab settings from lines, so return
        if (ret.type === "tab" || ret.type === "space") {
            return ret
        }

        // Otherwise, we'll fall back to getting vim tab settings
        const isSpaces = await this._neovimInstance.request<boolean>("nvim_get_option", [
            "expandtab",
        ])
        const tabSize = await this._neovimInstance.request<number>("nvim_get_option", ["tabstop"])

        const tabType = isSpaces ? "space" : "tab"
        return {
            amount: tabSize,
            type: tabType,
            indent: getStringFromTypeAndAmount(tabType, tabSize),
        }
    }

    public async applyTextEdits(textEdits: types.TextEdit | types.TextEdit[]): Promise<void> {
        const textEditsAsArray = textEdits instanceof Array ? textEdits : [textEdits]

        const sortedEdits = LanguageManager.sortTextEdits(textEditsAsArray)

        const deferredEdits = sortedEdits.map(te => {
            return Observable.defer(async () => {
                const range = te.range
                Log.info("[Buffer] Applying edit")

                const characterStart = range.start.character
                const lineStart = range.start.line
                const lineEnd = range.end.line
                const characterEnd = range.end.character

                const calls = []

                calls.push(["nvim_command", ["silent! undojoin"]])

                if (lineStart === lineEnd) {
                    const [lineContents] = await this.getLines(lineStart, lineStart + 1)
                    const beginning = lineContents.substring(0, range.start.character)
                    const end = lineContents.substring(range.end.character, lineContents.length)
                    const newLine = beginning + te.newText + end

                    const lines = newLine.split(os.EOL)

                    calls.push([
                        "nvim_buf_set_lines",
                        [parseInt(this._id, 10), lineStart, lineStart + 1, false, lines],
                    ])
                } else if (characterEnd === 0 && characterStart === 0) {
                    const lines = te.newText.split(os.EOL)
                    calls.push([
                        "nvim_buf_set_lines",
                        [parseInt(this._id, 10), lineStart, lineEnd, false, lines],
                    ])
                } else {
                    Log.warn("Multi-line mid character edits not currently supported")
                }

                await this._neovimInstance.request("nvim_call_atomic", [calls])
            })
        })

        await Observable.from(deferredEdits)
            .concatMap(de => de)
            .toPromise()
    }

    public handleInput(key: string): boolean {
        const state = this._store.getState()

        const bufferLayers: IBufferLayer[] = state.layers[this._id]

        if (!bufferLayers || !bufferLayers.length) {
            return false
        }

        const layerShouldHandleInput = bufferLayers.reduce<boolean>(
            (layerHandlerExists, currentLayer) => {
                if (layerHandlerExists) {
                    return true
                }

                if (!currentLayer || !currentLayer.handleInput) {
                    return false
                } else if (currentLayer.isActive && currentLayer.isActive()) {
                    return currentLayer.handleInput(key)
                }
                return false
            },
            false,
        )

        return layerShouldHandleInput
    }
    public async updateHighlights(
        tokenColors: TokenColor[],
        updateFunction: (highlightsUpdater: IBufferHighlightsUpdater) => void,
    ): Promise<void> {
        this._promiseQueue.enqueuePromise(async () => {
            const bufferId = parseInt(this._id, 10)
            const bufferUpdater = new BufferHighlightsUpdater(
                bufferId,
                this._neovimInstance,
                this._bufferHighlightId,
            )
            await this._neovimInstance.tokenColorSynchronizer.synchronizeTokenColors(tokenColors)
            await bufferUpdater.start()

            updateFunction(bufferUpdater)

            this._bufferHighlightId = await bufferUpdater.apply()
        })
    }

    public async setLines(start: number, end: number, lines: string[]): Promise<void> {
        return this._neovimInstance.request<any>("nvim_buf_set_lines", [
            parseInt(this._id, 10),
            start,
            end,
            false,
            lines,
        ])
    }

    public async setCursorPosition(row: number, column: number): Promise<void> {
        await this._neovimInstance.eval(`setpos(".", [${this._id}, ${row + 1}, ${column + 1}, 0])`)
    }

    public async getSelectionRange(): Promise<types.Range | null> {
        const startRange = await this._neovimInstance.callFunction("getpos", ["'<'"])
        const endRange = await this._neovimInstance.callFunction("getpos", ["'>"])

        const [, startLine, startColumn] = startRange
        let [, endLine, endColumn] = endRange

        if (startLine === 0 && startColumn === 0 && endLine === 0 && endColumn === 0) {
            return null
        }

        if (endColumn === Constants.Vim.MAX_VALUE) {
            endLine++
            endColumn = 1
        }

        return types.Range.create(startLine - 1, startColumn - 1, endLine - 1, endColumn - 1)
    }

    public async getTokenAt(line: number, column: number): Promise<Oni.IToken> {
        const result = await this.getLines(line, line + 1)

        const tokenRegEx = LanguageManager.getInstance().getTokenRegex(this.language)

        const getLastMatchingCharacter = (
            lineContents: string,
            character: number,
            dir: number,
            regex: RegExp,
        ) => {
            while (character > 0 && character < lineContents.length) {
                if (!lineContents[character].match(regex)) {
                    return character - dir
                }

                character += dir
            }

            return character
        }

        const getToken = (lineContents: string, character: number): Oni.IToken => {
            if (!lineContents || !character) {
                return null
            }

            const tokenStart = getLastMatchingCharacter(lineContents, character, -1, tokenRegEx)
            const tokenEnd = getLastMatchingCharacter(lineContents, character, 1, tokenRegEx)

            const range = types.Range.create(line, tokenStart, line, tokenEnd)
            const tokenName = lineContents.substring(tokenStart, tokenEnd + 1)

            return {
                tokenName,
                range,
            }
        }

        return getToken(result[0], column)
    }

    public updateFromEvent(evt: EventContext): void {
        this._id = evt.bufferNumber.toString()
        this._filePath = evt.bufferFullPath
        this._language = evt.filetype
        this._version = evt.version
        this._modified = evt.modified
        this._lineCount = evt.bufferTotalLines
        this._cursorOffset = evt.byte
        this._tabstop = evt.tabstop
        this._shiftwidth = evt.shiftwidth
        this._comment = this.formatCommentOption(evt.comments)

        this._cursor = {
            line: evt.line - 1,
            column: evt.column - 1,
        }
    }

    public formatCommentOption(comments: string): ICommentFormats {
        if (!comments) {
            return null
        }
        try {
            const commentsArray = comments.split(",")
            const commentFormats = commentsArray.reduce<ICommentFormats>(
                (acc, str) => {
                    const [flag, character] = str.split(":")
                    switch (true) {
                        case flag.includes("s"):
                            acc.start = character
                            return acc
                        case flag.includes("m"):
                            acc.middle = character
                            return acc
                        case flag.includes("e"):
                            acc.end = character
                            return acc
                        default:
                            acc.defaults.push(character)
                            return acc
                    }
                },
                {
                    start: null,
                    middle: null,
                    end: null,
                    defaults: [],
                },
            )

            return commentFormats
        } catch (e) {
            Log.warn(`Error formatting neovim comment options due to ${e.message}`)
            return null
        }
    }
}

// Helper for managing buffer state
export class BufferManager {
    private _idToBuffer: { [id: string]: Buffer } = {}
    private _filePathToId: { [filePath: string]: string } = {}
    private _bufferList: { [id: string]: InactiveBuffer } = {}

    constructor(
        private _neovimInstance: NeovimInstance,
        private _actions: typeof Actions,
        private _store: Store<State.IState>,
    ) {}

    public updateBufferFromEvent(evt: EventContext): Buffer {
        const id = evt.bufferNumber.toString()
        const currentBuffer = this.getBufferById(id)

        if (evt.bufferFullPath) {
            this._filePathToId[evt.bufferFullPath] = id
        }

        if (currentBuffer) {
            currentBuffer.updateFromEvent(evt)
        } else {
            const buf = new Buffer(this._neovimInstance, this._actions, this._store, evt)
            this._idToBuffer[id] = buf
        }

        return this._idToBuffer[id]
    }

    public populateBufferList(buffers: BufferEventContext): void {
        const bufferlist = buffers.existingBuffers.reduce((list, buffer) => {
            const id = `${buffer.bufferNumber}`
            if (buffer.bufferFullPath) {
                this._filePathToId[buffer.bufferFullPath] = id
                list[id] = new InactiveBuffer(buffer)
            }
            return list
        }, {})
        const currentId = buffers.current.bufferNumber.toString()
        const current = this.getBufferById(currentId)
        this._bufferList = { ...bufferlist, [currentId]: current }
    }

    public getBufferById(id: string): Buffer {
        return this._idToBuffer[id]
    }

    public getBuffers(): Array<Buffer | InactiveBuffer> {
        return Object.values(this._bufferList)
    }
}

export class InactiveBuffer implements Oni.InactiveBuffer {
    private _id: string
    private _filePath: string
    private _language: string
    private _version: number
    private _modified: boolean
    private _lineCount: number

    public get id(): string {
        return this._id
    }

    public get filePath(): string {
        return this._filePath
    }
    public get language(): string {
        return this._language
    }
    public get version(): number {
        return this._version
    }
    public get modified(): boolean {
        return this._modified
    }
    public get lineCount(): number {
        return this._lineCount
    }

    constructor(inactiveBuffer: InactiveBufferContext) {
        this._id = `${inactiveBuffer.bufferNumber}`
        this._filePath = inactiveBuffer.bufferFullPath
        this._language = inactiveBuffer.filetype
        this._version = inactiveBuffer.version || null
        this._modified = inactiveBuffer.modified || false
        this._lineCount = null
    }
}
