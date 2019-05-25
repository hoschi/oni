import { Commands } from "oni-api"
import * as React from "react"
import { Provider } from "react-redux"

import { ISessionStore, Sessions } from "./"

interface SessionPaneProps {
    commands: Commands.Api
    store: ISessionStore
}

/**
 * Class SessionsPane
 *
 * A Side bar pane for Oni's Session Management
 *
 */
export default class SessionsPane {
    public isSoftHidden: boolean = false
    private _store: ISessionStore
    private _commands: Commands.Api

    constructor({ store, commands }: SessionPaneProps) {
        this._commands = commands
        this._store = store

        this._setupCommands()
    }

    get id() {
        return "oni.sidebar.sessions"
    }

    public get title() {
        return "Sessions"
    }

    public enter() {
        this._store.dispatch({ type: "ENTER" })
    }

    public leave() {
        this._store.dispatch({ type: "LEAVE" })
    }

    public render() {
        return (
            <Provider store={this._store}>
                <Sessions />
            </Provider>
        )
    }

    private _isActive = () => {
        const state = this._store.getState()
        return state.active && !state.creating
    }

    private _deleteSession = () => {
        this._store.dispatch({ type: "DELETE_SESSION" })
    }

    private _setupCommands() {
        this._commands.registerCommand({
            command: "oni.sessions.delete",
            name: "Sessions: Delete the current session",
            detail: "Delete the current or selected session",
            enabled: this._isActive,
            execute: this._deleteSession,
        })
    }
}
