/**
 * SyntaxHighlighting.ts
 *
 * Handles enhanced syntax highlighting
 */

import * as os from "os"
import * as path from "path"

import { Subject } from "rxjs/Subject"

import * as types from "vscode-languageserver-types"

import * as Oni from "oni-api"
import * as Log from "oni-core-logging"

import { Store, Unsubscribe } from "redux"

import { TokenColors } from "./../TokenColors"

import { NeovimEditor } from "./../../Editor/NeovimEditor"

import {
    createSyntaxHighlightStore,
    ISyntaxHighlightAction,
    ISyntaxHighlightState,
} from "./SyntaxHighlightingStore"

import {
    IEditorWithSyntaxHighlighter,
    SyntaxHighlightReconciler,
} from "./SyntaxHighlightReconciler"
import { getLineFromBuffer } from "./SyntaxHighlightSelectors"

import * as Utility from "./../../Utility"

export class SyntaxHighlighter implements Oni.ISyntaxHighlighter {
    private _store: Store<ISyntaxHighlightState>
    private _reconciler: SyntaxHighlightReconciler
    private _unsubscribe: Unsubscribe

    private _throttledActions: Subject<ISyntaxHighlightAction> = new Subject<
        ISyntaxHighlightAction
    >()

    constructor(private _editor: NeovimEditor, private _tokenColors: TokenColors) {
        this._store = createSyntaxHighlightStore()

        this._reconciler = new SyntaxHighlightReconciler(
            this._editor as IEditorWithSyntaxHighlighter,
            this._tokenColors,
        )
        this._unsubscribe = this._store.subscribe(() => {
            const state = this._store.getState()
            this._reconciler.update(state)
        })

        this._throttledActions.auditTime(50).subscribe(action => {
            this._store.dispatch(action)
        })
    }

    public notifyViewportChanged(
        bufferId: string,
        topLineInView: number,
        bottomLineInView: number,
    ): void {
        Log.verbose(
            `[SyntaxHighlighting.notifyViewportChanged] -
             bufferId: ${bufferId}
             topLineInView: ${topLineInView}
             bottomLineInView:  ${bottomLineInView}`,
        )

        const state = this._store.getState()
        const previousBufferState = state.bufferToHighlights[bufferId]

        if (
            previousBufferState &&
            topLineInView === previousBufferState.topVisibleLine &&
            bottomLineInView === previousBufferState.bottomVisibleLine
        ) {
            return
        }

        this._store.dispatch({
            type: "SYNTAX_UPDATE_BUFFER_VIEWPORT",
            bufferId,
            topVisibleLine: topLineInView,
            bottomVisibleLine: bottomLineInView,
        })
    }

    public async notifyColorschemeRedraw(bufferId: string) {
        this._store.dispatch({ type: "SYNTAX_RESET_BUFFER", bufferId })
    }

    public async notifyBufferUpdate(evt: Oni.EditorBufferChangedEventArgs): Promise<void> {
        const firstChange = evt.contentChanges[0]
        if (!firstChange.range && !firstChange.rangeLength) {
            const lines = firstChange.text.split(os.EOL)
            this._store.dispatch({
                type: "SYNTAX_UPDATE_BUFFER",
                extension: path.extname(evt.buffer.filePath),
                language: evt.buffer.language,
                bufferId: evt.buffer.id,
                lines,
                version: evt.buffer.version,
            })
        } else {
            // Incremental update
            this._throttledActions.next({
                type: "SYNTAX_UPDATE_BUFFER_LINE",
                bufferId: evt.buffer.id,
                version: evt.buffer.version,
                lineNumber: firstChange.range.start.line,
                line: firstChange.text,
            })
        }
    }

    public async updateBuffer(lines: string[], buffer: Oni.Buffer): Promise<void> {
        // reset buffer data, buffer.version is not updated and update would be ignored without this
        this._store.dispatch({ type: "SYNTAX_RESET_BUFFER", bufferId: buffer.id, lines })
        this._store.dispatch({
            type: "SYNTAX_UPDATE_BUFFER",
            extension: path.extname(buffer.filePath),
            language: buffer.language,
            bufferId: buffer.id,
            lines,
            version: buffer.version,
        })
    }

    public async updateLine(line: string, lineNumber: number, buffer: Oni.Buffer): Promise<void> {
        this._throttledActions.next({
            type: "SYNTAX_UPDATE_BUFFER_LINE_FORCED",
            bufferId: buffer.id,
            version: buffer.version,
            lineNumber,
            line,
        })
    }

    public getHighlightTokenAt(
        bufferId: string,
        position: types.Position,
    ): Oni.ISyntaxHighlightTokenInfo {
        const state = this._store.getState()
        const buffer = state.bufferToHighlights[bufferId]

        if (!buffer) {
            return null
        }

        const line = getLineFromBuffer(buffer, position.line)

        if (!line) {
            return null
        }

        return line.tokens.find(r => Utility.isInRange(position.line, position.character, r.range))
    }

    public dispose(): void {
        if (this._reconciler) {
            this._reconciler = null
        }

        if (this._unsubscribe) {
            this._unsubscribe()
            this._unsubscribe = null
        }
    }
}

export class NullSyntaxHighlighter implements Oni.ISyntaxHighlighter {
    public notifyBufferUpdate(evt: Oni.EditorBufferChangedEventArgs): Promise<void> {
        return Promise.resolve(null)
    }

    public getHighlightTokenAt(
        bufferId: string,
        position: types.Position,
    ): Oni.ISyntaxHighlightTokenInfo {
        return null
    }

    public notifyColorschemeRedraw(id: string): void {
        return null
    }

    public notifyViewportChanged(
        bufferId: string,
        topLineInView: number,
        bottomLineInView: number,
    ): void {
        // tslint: disable-line
    }

    public async updateBuffer(lines: string[], buffer: Oni.Buffer): Promise<void> {
        return Promise.resolve(null)
    }

    public async updateLine(line: string, lineNumber: number, buffer: Oni.Buffer): Promise<void> {
        return Promise.resolve(null)
    }

    public dispose(): void {} // tslint:disable-line
}
