import * as Oni from "oni-api"
import * as React from "react"

export class SideCockpitManager implements Oni.IWindowSplit {
    private _split: Oni.WindowSplitHandle

    constructor(private _oni: Oni.Plugin.Api) {}

    public open(): void {
        const editorSplit = this._oni.windows.activeSplitHandle
        this._split = this._oni.windows.createSplit("vertical", this)
        editorSplit.focus()
    }

    public render(): JSX.Element {
        return (
            <div>
                <h1>Cockpit</h1>
                <div className="enable-mouse">
                    test: <button onClick={() => this._oni.log.info("sc: test")}>click me</button>
                </div>
            </div>
        )
    }
}
