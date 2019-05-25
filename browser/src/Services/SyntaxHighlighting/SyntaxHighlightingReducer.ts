// SyntaxHighlightingReducer.ts
//
// Reducers for handling state changes from ISyntaxHighlightActions

import {
    IBufferSyntaxHighlightState,
    ISyntaxHighlightAction,
    ISyntaxHighlightState,
    SyntaxHighlightLines,
} from "./SyntaxHighlightingStore"

import { Reducer } from "redux"

export const reducer: Reducer<ISyntaxHighlightState> = (
    state: ISyntaxHighlightState = {
        bufferToHighlights: {},
    },
    action: ISyntaxHighlightAction,
) => {
    const newState = state

    return {
        ...newState,
        bufferToHighlights: bufferToHighlightsReducer(state.bufferToHighlights, action),
    }
}

export const bufferToHighlightsReducer: Reducer<{
    [bufferId: string]: IBufferSyntaxHighlightState
}> = (
    state: { [bufferId: string]: IBufferSyntaxHighlightState } = {},
    action: ISyntaxHighlightAction,
) => {
    return {
        ...state,
        [action.bufferId]: bufferReducer(state[action.bufferId], action),
    }
}

export const bufferReducer: Reducer<IBufferSyntaxHighlightState> = (
    state: IBufferSyntaxHighlightState = {
        bufferId: null,
        extension: null,
        language: null,
        version: -1,
        topVisibleLine: -1,
        bottomVisibleLine: -1,
        insertModeLine: null,
        lines: {},
    },
    action: ISyntaxHighlightAction,
) => {
    switch (action.type) {
        case "SYNTAX_RESET_BUFFER":
            return {
                ...state,
                lines: linesReducer(state.lines, action),
            }
        case "SYNTAX_UPDATE_BUFFER":
            return {
                ...state,
                bufferId: action.bufferId,
                language: action.language,
                extension: action.extension,
                lines: linesReducer(state.lines, action),
                version: action.version,
            }
        case "SYNTAX_UPDATE_BUFFER_VIEWPORT":
            return {
                ...state,
                topVisibleLine: action.topVisibleLine,
                bottomVisibleLine: action.bottomVisibleLine,
            }
        case "SYNTAX_UPDATE_TOKENS_FOR_LINE":
            return {
                ...state,
                lines: linesReducer(state.lines, action),
            }
        case "SYNTAX_UPDATE_TOKENS_FOR_LINE_INSERT_MODE":
            return {
                ...state,
                insertModeLine: {
                    version: action.version,
                    lineNumber: action.lineNumber,
                    info: {
                        line: action.line,
                        tokens: action.tokens,
                        ruleStack: action.ruleStack,
                        dirty: false,
                    },
                },
            }
        default:
            return state
    }
}

export const linesReducer: Reducer<SyntaxHighlightLines> = (
    state: SyntaxHighlightLines = {},
    action: ISyntaxHighlightAction,
) => {
    switch (action.type) {
        case "SYNTAX_UPDATE_TOKENS_FOR_LINE": {
            const newState = {
                ...state,
            }

            const originalLine = newState[action.lineNumber]

            // If the ruleStack changed, we need to invalidate the next line
            const shouldDirtyNextLine =
                originalLine &&
                originalLine.ruleStack &&
                !originalLine.ruleStack.equals(action.ruleStack)

            newState[action.lineNumber] = {
                ...originalLine,
                dirty: false,
                tokens: action.tokens,
                ruleStack: action.ruleStack,
                version: action.version,
            }

            const nextLine = newState[action.lineNumber + 1]
            if (shouldDirtyNextLine && nextLine) {
                newState[action.lineNumber + 1] = {
                    ...nextLine,
                    dirty: true,
                }
            }
            return newState
        }
        case "SYNTAX_RESET_BUFFER":
            const resetState = Object.entries(state).reduce<SyntaxHighlightLines>(
                (newResetState, [lineNumber, ourLine]) => {
                    const line = action.lines ? action.lines[lineNumber] : ourLine
                    newResetState[lineNumber] = {
                        tokens: [],
                        ruleStack: null,
                        ...line,
                        dirty: true,
                    }
                    return newResetState
                },
                {},
            )
            return resetState

        case "SYNTAX_UPDATE_BUFFER":
            const updatedBufferState: SyntaxHighlightLines = {
                ...state,
            }

            for (let i = 0; i < action.lines.length; i++) {
                const oldLine = updatedBufferState[i]
                const newLine = action.lines[i]

                // check if the buffer version has changed and if so
                // update the line - rather than check if specific line
                // is changed
                if (oldLine && oldLine.version >= action.version) {
                    continue
                }

                updatedBufferState[i] = {
                    tokens: [],
                    ruleStack: null,
                    ...oldLine,
                    line: newLine,
                    dirty: true,
                }
            }

            return updatedBufferState
    }

    return state
}
