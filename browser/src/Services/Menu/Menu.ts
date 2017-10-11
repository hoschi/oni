/**
 * Menu.ts
 *
 * Implements API surface area for working with the status bar
 */

import { bindActionCreators, createStore } from "redux"

import { Event, IEvent } from "./../../Event"

import * as ActionCreators from "./MenuActionCreators"
import { reducer } from "./MenuReducer"
import * as State from "./MenuState"

export const menuStore = createStore(reducer, State.createDefaultState())

export const menuActions: typeof ActionCreators = bindActionCreators(ActionCreators as any, menuStore.dispatch)

export class MenuManager {
    private _id: number = 0

    public create(): Menu {
        this._id++
        return new Menu(this._id.toString())
    }

    public isMenuOpen(): boolean {
        return !!menuStore.getState().menu
    }

    public nextMenuItem(): void {
        menuActions.nextMenuItem()
    }

    public previousMenuItem(): void {
        menuActions.previousMenuItem()
    }

    public closeActiveMenu(): void {
        menuActions.hidePopupMenu()
    }

    public selectMenuItem(idx?: number): void {
        const menuState = menuStore.getState()

        if (menuState && menuState.menu) {
            menuState.menu.onSelectItem(idx)
        }
    }
}

export class Menu {
    private _onItemSelected = new Event<any>()
    private _onFilterTextChanged = new Event<string>()

    public get onItemSelected(): IEvent<any> {
        return this._onItemSelected
    }

    public get onFilterTextChanged(): IEvent<any> {
        return this._onFilterTextChanged
    }

    constructor(private _id: string) {
    }

    public setLoading(isLoading: boolean): void {
        menuActions.setMenuLoading(this._id, isLoading)
    }

    public setItems(items: Oni.Menu.MenuOption[]): void {
        menuActions.setMenuItems(this._id, items)
    }

    public show(): void {
        // TODO: Pass in callbacks for events here
        menuActions.showPopupMenu(this._id, {
            onSelectItem: (idx: number) => this._onItemSelectedHandler(idx),
        })
    }

    private _onItemSelectedHandler(idx?: number): void {

        const menuState = menuStore.getState()
        const index = (typeof idx === "number") ? idx : menuState.menu.selectedIndex

        const selectedOption = menuState.menu.filteredOptions[index]

        this._onItemSelected.dispatch(selectedOption)

        this.hide()
    }

    public hide(): void {
        menuActions.hidePopupMenu()
    }
}

export const menuManager = new MenuManager()