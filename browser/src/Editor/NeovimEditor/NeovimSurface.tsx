/**
 * NeovimSurface.tsx
 *
 * UI layer for the Neovim editor surface
 */

import * as React from "react"
import { connect } from "react-redux"

import { IEvent } from "oni-types"

import { NeovimInstance, NeovimScreen } from "./../../neovim"
import { INeovimRenderer } from "./../../Renderer"
import FileDropHandler from "./FileDropHandler"

import { TypingPredictionManager } from "./../../Services/TypingPredictionManager"
import { Cursor } from "./../../UI/components/Cursor"
import { CursorLine } from "./../../UI/components/CursorLine"
import { InstallHelp } from "./../../UI/components/InstallHelp"
import { TabsConnectedCockpit } from "./../../UI/components/TabsConnectedCockpit"
import { ToolTips } from "./../../UI/components/ToolTip"

import { StackLayer } from "../../UI/components/common"
import { setViewport } from "./../NeovimEditor/NeovimEditorActions"
import { NeovimBufferLayers } from "./NeovimBufferLayersView"
import { NeovimEditorLoadingOverlay } from "./NeovimEditorLoadingOverlay"
import { NeovimInput } from "./NeovimInput"
import { NeovimRenderer } from "./NeovimRenderer"

export interface INeovimSurfaceProps {
    autoFocus: boolean
    neovimInstance: NeovimInstance
    renderer: INeovimRenderer
    screen: NeovimScreen
    typingPrediction: TypingPredictionManager

    onActivate: IEvent<void>

    onKeyDown?: (key: string) => void
    onBufferClose?: (bufferId: number) => void
    onBufferSelect?: (bufferId: number) => void
    onFileDrop?: (files: FileList) => void
    onImeStart: () => void
    onImeEnd: () => void
    onBounceStart: () => void
    onBounceEnd: () => void
    onTabClose?: (tabId: number) => void
    onTabSelect?: (tabId: number) => void
    setViewport: any
}

class NeovimSurface extends React.Component<INeovimSurfaceProps> {
    private observer: any
    private _editor: HTMLDivElement

    public componentDidMount(): void {
        // tslint:disable-next-line
        this.observer = new window["ResizeObserver"](([entry]: any) => {
            this.setDimensions(entry.contentRect.width, entry.contentRect.height)
        })

        this.observer.observe(this._editor)
    }

    public setDimensions = (width: number, height: number) => {
        this.props.setViewport(width, height)
    }

    public render(): JSX.Element {
        return (
            <FileDropHandler handleFiles={this.props.onFileDrop}>
                {({ setRef }) => (
                    <div className="container vertical full" ref={setRef}>
                        <div className="container fixed">
                            <TabsConnectedCockpit
                                onBufferSelect={this.props.onBufferSelect}
                                onBufferClose={this.props.onBufferClose}
                                onTabClose={this.props.onTabClose}
                                onTabSelect={this.props.onTabSelect}
                            />
                        </div>
                        <div className="container full">
                            <div className="stack" ref={(e: HTMLDivElement) => (this._editor = e)}>
                                <NeovimRenderer
                                    renderer={this.props.renderer}
                                    neovimInstance={this.props.neovimInstance}
                                    screen={this.props.screen}
                                />
                            </div>
                            <StackLayer>
                                <Cursor typingPrediction={this.props.typingPrediction} />
                                <CursorLine lineType={"line"} />
                                <CursorLine lineType={"column"} />
                            </StackLayer>
                            <NeovimInput
                                startActive={this.props.autoFocus}
                                onActivate={this.props.onActivate}
                                typingPrediction={this.props.typingPrediction}
                                neovimInstance={this.props.neovimInstance}
                                screen={this.props.screen}
                                onBounceStart={this.props.onBounceStart}
                                onBounceEnd={this.props.onBounceEnd}
                                onImeStart={this.props.onImeStart}
                                onImeEnd={this.props.onImeEnd}
                                onKeyDown={this.props.onKeyDown}
                            />
                            <NeovimBufferLayers />
                            <StackLayer>
                                <ToolTips />
                            </StackLayer>
                            <NeovimEditorLoadingOverlay />
                            <InstallHelp />
                        </div>
                    </div>
                )}
            </FileDropHandler>
        )
    }
}
export default connect(null, { setViewport })(NeovimSurface)
