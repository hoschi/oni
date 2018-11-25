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
        return (
            <div style={{ border: "1px solid blue" }}>
                <div style={{ width: 500, height: 800 }}>{this.props.editor.render()}</div>
            </div>
        )
    }
}
