import { NeovimEditor } from "./../Editor/NeovimEditor"
import * as PluginManager from "./../Plugins/PluginManager"

import { configuration, Configuration } from "./Configuration"

import * as Colors from "./Colors"
import * as Completion from "./Completion"
import * as Diagnostics from "./Diagnostics"
import * as Language from "./Language"
import * as Menu from "./Menu"
import * as Overlay from "./Overlay"
import * as Snippets from "./Snippets"
import * as Themes from "./Themes"
import * as TokenColors from "./TokenColors"
import * as Workspace from "./Workspace"

export class NeovimEditorFactory {
    constructor(
        private _colors: Colors.IColors,
        private _completionProviders: Completion.CompletionProviders,
        private _configuration: Configuration,
        private _diagnostics: Diagnostics.IDiagnosticsDataSource,
        private _languageManager: Language.LanguageManager,
        private _menuManager: Menu.MenuManager,
        private _overlayManager: Overlay.OverlayManager,
        private _pluginManager: PluginManager.PluginManager,
        private _snippetManager: Snippets.SnippetManager,
        private _themeManager: Themes.ThemeManager,
        private _tokenColors: TokenColors.TokenColors,
        private _workspace: Workspace.Workspace,
    ) {}

    public createEditor() {
        return new NeovimEditor(
            this._colors,
            this._completionProviders,
            this._configuration,
            this._diagnostics,
            this._languageManager,
            this._menuManager,
            this._overlayManager,
            this._pluginManager,
            this._snippetManager,
            this._themeManager,
            this._tokenColors,
            this._workspace,
        )
    }
}

let _neovimEditorFactory: NeovimEditorFactory = null

export const activate = (): void => {
    // TODO this can be probably done without the need of a class
    _neovimEditorFactory = new NeovimEditorFactory(
        Colors.getInstance(),
        Completion.getInstance(),
        configuration,
        Diagnostics.getInstance(),
        Language.getInstance(),
        Menu.getInstance(),
        Overlay.getInstance(),
        PluginManager.getInstance(),
        Snippets.getInstance(),
        Themes.getThemeManagerInstance(),
        TokenColors.getInstance(),
        Workspace.getInstance(),
    )
}

export const getInstance = (): NeovimEditorFactory => {
    return _neovimEditorFactory
}
