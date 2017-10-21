/**
 * ActionCreators.ts
 *
 * Action Creators are relatively simple - they are just a function that returns an `Action`
 *
 * For information on Action Creators, check out this link:
 * http://redux.js.org/docs/basics/Actions.html
 */

import * as types from "vscode-languageserver-types"

import { Rectangle } from "./Types"

import * as Actions from "./Actions"
import * as Coordinates from "./Coordinates"
import * as State from "./State"

import { IScreen } from "./../Screen"
import { normalizePath } from "./../Utility"

import { IConfigurationValues } from "./../Services/Configuration"

export type DispatchFunction = (action: any) => void
export type GetStateFunction = () => State.IState

export const setViewport = (width: number, height: number) => ({
    type: "SET_VIEWPORT",
    payload: {
        width,
        height,
    },
})

export const bufferEnter = (id: number, file: string, language: string, totalLines: number, hidden: boolean, listed: boolean) => ({
    type: "BUFFER_ENTER",
    payload: {
        id,
        file: normalizePath(file),
        language,
        totalLines,
        hidden,
        listed,
    },
})

export const bufferUpdate = (id: number, modified: boolean, version: number, totalLines: number, lines?: string[]) => ({
    type: "BUFFER_UPDATE",
    payload: {
        id,
        modified,
        version,
        totalLines,
        lines,
    },
})

export const bufferSave = (id: number, modified: boolean, version: number) => ({
    type: "BUFFER_SAVE",
    payload: {
        id,
        modified,
        version,
    },
})

export const setCurrentBuffers = (bufferIds: number[]) => ({
    type: "SET_CURRENT_BUFFERS",
    payload: {
        bufferIds,
    },
})

export const setImeActive = (imeActive: boolean) => ({
    type: "SET_IME_ACTIVE",
    payload: {
        imeActive,
    },
})

export const setFont = (fontFamily: string, fontSize: string) => ({
    type: "SET_FONT",
    payload: {
        fontFamily,
        fontSize,
    },
})

export const setTabs = (selectedTabId: number, tabs: State.ITab[]): Actions.ISetTabs => ({
    type: "SET_TABS",
    payload: {
        selectedTabId,
        tabs,
    },
})

export const setWindowCursor = (windowId: number, line: number, column: number) => ({
    type: "SET_WINDOW_CURSOR",
    payload: {
        windowId,
        line,
        column,
    },
})

export const setWindowState = (windowId: number,
                               file: string,
                               column: number,
                               line: number,
                               bottomBufferLine: number,
                               topBufferLine: number,
                               dimensions: Rectangle,
                               bufferToScreen: Coordinates.BufferToScreen) => (dispatch: DispatchFunction, getState: GetStateFunction) => {

    const { fontPixelWidth, fontPixelHeight } = getState()

    const screenToPixel = (screenSpace: Coordinates.ScreenSpacePoint) => ({
            pixelX: screenSpace.screenX * fontPixelWidth,
            pixelY: screenSpace.screenY * fontPixelHeight,
    })

    dispatch({
        type: "SET_WINDOW_STATE",
        payload: {
            windowId,
            file: normalizePath(file),
            column,
            dimensions,
            line,
            bufferToScreen,
            screenToPixel,
            bottomBufferLine,
            topBufferLine,
        },
    })
}

export const setErrors = (file: string, key: string, errors: types.Diagnostic[]) => ({
    type: "SET_ERRORS",
    payload: {
        file: normalizePath(file),
        key,
        errors,
    },
})

export const clearErrors = (file: string, key: string) => ({
    type: "CLEAR_ERRORS",
    payload: {
        file,
        key,
    },
})

export const showMessageDialog = (messageType: State.MessageType, text: string, buttons: State.IMessageDialogButton[], details?: string): Actions.IShowMessageDialog => ({
    type: "SHOW_MESSAGE_DIALOG",
    payload: {
        messageType,
        text,
        buttons,
        details,
    },
})

export const hideMessageDialog = (): Actions.IHideMessageDialog => ({
    type: "HIDE_MESSAGE_DIALOG",
})

export const showStatusBarItem = (id: string, contents: JSX.Element, alignment?: State.StatusBarAlignment, priority?: number) => (dispatch: DispatchFunction, getState: GetStateFunction) => {

    const currentStatusBarItem = getState().statusBar[id]

    if (currentStatusBarItem) {
        alignment = alignment || currentStatusBarItem.alignment
        priority = priority || currentStatusBarItem.priority
    }

    dispatch({
        type: "STATUSBAR_SHOW",
        payload: {
            id,
            contents,
            alignment,
            priority,
        },
    })
}

export const hideStatusBarItem = (id: string) => ({
    type: "STATUSBAR_HIDE",
    payload: {
        id,
    },
})

export const previousCompletion = () => (dispatch: DispatchFunction, getState: GetStateFunction) => {
    dispatch(_previousAutoCompletion())
}

export const nextCompletion = () => (dispatch: DispatchFunction, getState: GetStateFunction) => {
    dispatch(_nextAutoCompletion())
}

export const setCursorPosition = (screen: IScreen) => (dispatch: DispatchFunction) => {
    const cell = screen.getCell(screen.cursorColumn, screen.cursorRow)

    dispatch(_setCursorPosition(screen.cursorColumn * screen.fontWidthInPixels, screen.cursorRow * screen.fontHeightInPixels, screen.fontWidthInPixels, screen.fontHeightInPixels, cell.character, cell.characterWidth * screen.fontWidthInPixels))
}

export const setColors = (foregroundColor: string, backgroundColor: string) => (dispatch: DispatchFunction, getState: GetStateFunction) => {
    if (foregroundColor === getState().foregroundColor && backgroundColor === getState().backgroundColor) {
        return
    }

    dispatch(_setColors(foregroundColor, backgroundColor))
}

export const setMode = (mode: string) => ({
    type: "SET_MODE",
    payload: { mode },
})

export const showSignatureHelp = (filePath: string, line: number, column: number, signatureHelp: types.SignatureHelp) => ({
    type: "SHOW_SIGNATURE_HELP",
    payload: {
        filePath: normalizePath(filePath),
        line,
        column,
        signatureHelp,
    },
})

export const showQuickInfo = (filePath: string, line: number, column: number, title: string, description: string): Actions.IShowQuickInfoAction => ({
    type: "SHOW_QUICK_INFO",
    payload: {
        filePath: normalizePath(filePath),
        line,
        column,
        title,
        description,
    },
})

export const setDefinition = (filePath: string, line: number, column: number, token: Oni.IToken, definitionLocation: types.Location): Actions.ISetDefinitionAction => ({
    type: "SET_DEFINITION",
    payload: {
        filePath: normalizePath(filePath),
        line,
        column,
        token,
        definitionLocation,
    },
})

export const showCompletions = (filePath: string, line: number, column: number, entries: Oni.Plugin.CompletionInfo[], base: string): Actions.IShowAutoCompletionAction => ({
    type: "SHOW_AUTO_COMPLETION",
    payload: {
        filePath: normalizePath(filePath),
        line,
        column,
        entries,
        base,
    },
})

export const setCompletionBase = (base: string) => ({
    type: "SET_AUTO_COMPLETION_BASE",
    payload: {
        base,
    },
})

export const setDetailedCompletionEntry = (detailedEntry: Oni.Plugin.CompletionInfo) => ({
    type: "SET_AUTO_COMPLETION_DETAILS",
    payload: {
        detailedEntry,
    },
})

export const setCursorLineOpacity = (opacity: number) => ({
    type: "SET_CURSOR_LINE_OPACITY",
    payload: {
        opacity,
    },
})

export const setCursorColumnOpacity = (opacity: number) => ({
    type: "SET_CURSOR_COLUMN_OPACITY",
    payload: {
        opacity,
    },
})

export function setConfigValue<K extends keyof IConfigurationValues>(k: K, v: IConfigurationValues[K]): Actions.ISetConfigurationValue<K> {
    return {
        type: "SET_CONFIGURATION_VALUE",
        payload: {
            key: k,
            value: v,
        },
    }
}

const _setCursorPosition = (cursorPixelX: any, cursorPixelY: any, fontPixelWidth: any, fontPixelHeight: any, cursorCharacter: string, cursorPixelWidth: number) => ({
    type: "SET_CURSOR_POSITION",
    payload: {
        pixelX: cursorPixelX,
        pixelY: cursorPixelY,
        fontPixelWidth,
        fontPixelHeight,
        cursorCharacter,
        cursorPixelWidth,
    },
})

const _setColors = (foregroundColor: string, backgroundColor: string) => ({
    type: "SET_COLORS",
    payload: { foregroundColor, backgroundColor },
})

const _nextAutoCompletion = () => ({
    type: "NEXT_AUTO_COMPLETION",
})

const _previousAutoCompletion = () => ({
    type: "PREVIOUS_AUTO_COMPLETION",
})
