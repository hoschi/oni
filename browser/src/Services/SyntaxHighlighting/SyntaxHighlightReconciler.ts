/**
 * SyntaxHighlighting.ts
 *
 * Handles enhanced syntax highlighting
 */

import { Buffer, Editor, ISyntaxHighlightTokenInfo } from "oni-api"
import * as Log from "oni-core-logging"

import { prettyPrint } from "./../../Utility"
import { TokenColor, TokenColors } from "./../TokenColors"

import { HighlightInfo } from "./Definitions"
import { ISyntaxHighlightLineInfo, ISyntaxHighlightState } from "./SyntaxHighlightingStore"
import { TokenScorer } from "./TokenScorer"

import { IBufferHighlightsUpdater } from "../../Editor/BufferHighlights"
import * as Selectors from "./SyntaxHighlightSelectors"

interface IBufferWithSyntaxHighlighter extends Buffer {
    updateHighlights?: (
        tokenColors: TokenColor[],
        highlightCallback: (args: IBufferHighlightsUpdater) => void,
    ) => void
}

export interface IEditorWithSyntaxHighlighter extends Editor {
    activeBuffer: IBufferWithSyntaxHighlighter
}

/**
 * SyntaxHighlightReconciler
 *
 * Essentially a renderer / reconciler, that will push
 * highlight calls to the active buffer based on the active
 * window and viewport
 * @name SyntaxHighlightReconciler
 * @class
 */
export class SyntaxHighlightReconciler {
    private _previousState: { [line: number]: ISyntaxHighlightLineInfo } = {}
    private _tokenScorer = new TokenScorer()

    constructor(private _editor: IEditorWithSyntaxHighlighter, private _tokenColors: TokenColors) {}

    public update(state: ISyntaxHighlightState) {
        const { activeBuffer } = this._editor

        if (!activeBuffer) {
            return
        }

        const bufferId = activeBuffer.id

        const currentHighlightState = state.bufferToHighlights[bufferId]

        if (currentHighlightState && currentHighlightState.lines) {
            const lineNumbers = Object.keys(currentHighlightState.lines)

            const relevantRange = Selectors.getRelevantRange(state, bufferId)

            const filteredLines = lineNumbers.filter(line => {
                const lineNumber = parseInt(line, 10)

                // Ignore lines that are not in current view
                if (lineNumber < relevantRange.top || lineNumber > relevantRange.bottom) {
                    return false
                }

                const latestLine = Selectors.getLineFromBuffer(currentHighlightState, lineNumber)

                // If dirty (haven't processed tokens yet) - skip
                if (latestLine.dirty) {
                    return false
                }

                // Or lines that haven't been updated
                return this._previousState[line] !== latestLine
            })

            const tokens = filteredLines.map(currentLine => {
                const lineNumber = parseInt(currentLine, 10)
                const line = Selectors.getLineFromBuffer(currentHighlightState, lineNumber)

                const highlights = this._mapTokensToHighlights(line.tokens)
                return {
                    line: parseInt(currentLine, 10),
                    highlights,
                }
            })

            // Get only the token colors that apply to the visible section of the buffer
            const visibleTokens = tokens.reduce((accumulator, { highlights }) => {
                if (highlights) {
                    const tokenColors = highlights.map(({ tokenColor }) => tokenColor)
                    accumulator.push(...tokenColors)
                }
                return accumulator
            }, [])

            filteredLines.forEach(line => {
                const lineNumber = parseInt(line, 10)
                this._previousState[line] = Selectors.getLineFromBuffer(
                    currentHighlightState,
                    lineNumber,
                )
            })

            if (tokens.length) {
                Log.verbose(
                    `[SyntaxHighlightReconciler] Applying changes to ${tokens.length} lines.`,
                )
                activeBuffer.updateHighlights(visibleTokens, highlightUpdater => {
                    tokens.forEach(token => {
                        const { line, highlights } = token
                        if (Log.isDebugLoggingEnabled()) {
                            Log.debug(
                                `[SyntaxHighlightingReconciler] Updating tokens for line: ${line} | ${prettyPrint(
                                    highlights,
                                )}`,
                            )
                        }

                        highlightUpdater.setHighlightsForLine(line, highlights)
                    })
                })
            }
        }
    }

    private _mapTokensToHighlights(tokens: ISyntaxHighlightTokenInfo[]): HighlightInfo[] {
        const mapTokenToHighlight = (token: ISyntaxHighlightTokenInfo) => ({
            tokenColor: this._getHighlightGroupFromScope(token.scopes),
            range: token.range,
        })

        return tokens.map(mapTokenToHighlight).filter(t => !!t.tokenColor)
    }

    private _getHighlightGroupFromScope(scopes: string[]): TokenColor {
        const highestRanked = this._tokenScorer.rankTokenScopes(
            scopes,
            this._tokenColors.tokenColors,
        )
        return highestRanked
    }
}
