import * as React from "react"
import * as Oni from "oni-api"

export interface ICockpitEditorProps {
    editor: Oni.Editor
}

/**
 * Render a neovim editor.
 */
export class CockpitEditor extends React.PureComponent<ICockpitEditorProps, {}> {
    public render(): JSX.Element {
        return <div className="container full">{this.props.editor.render()}</div>
    }
}
