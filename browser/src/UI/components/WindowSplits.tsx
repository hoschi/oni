/**
 * WindowSplits.tsx
 *
 * UI that hosts all the `Editor` instances
 */

import * as React from "react"
import { connect } from "react-redux"
import { AutoSizer } from "react-virtualized"

import { WindowSplitHost } from "./WindowSplitHost"

import {
    IAugmentedSplitInfo,
    ISplitInfo,
    layoutFromSplitInfo,
    LayoutResultInfo,
    leftDockSelector,
    WindowManager,
    WindowState,
} from "./../../Services/WindowManager"

import { noop } from "./../../Utility"

export interface IWindowSplitsProps extends IWindowSplitsContainerProps {
    activeSplitId: string
    splitRoot: ISplitInfo<IAugmentedSplitInfo>
    leftDock: IAugmentedSplitInfo[]
}

export interface IWindowSplitsContainerProps {
    windowManager: WindowManager
}

export interface IDockProps {
    activeSplitId: string
    splits: IAugmentedSplitInfo[]
}

export class Dock extends React.PureComponent<IDockProps, {}> {
    public render(): JSX.Element {
        const docks = this.props.splits.map((s, i) => {
            return (
                <div style={{ display: "flex", flexDirection: "row" }} key={s.id}>
                    <WindowSplitHost
                        key={i}
                        id={s.id}
                        containerClassName="split"
                        split={s}
                        isFocused={this.props.activeSplitId === s.id}
                        onClick={noop}
                    />
                    <div className="split-spacer vertical" />
                </div>
            )
        })

        return <div className="dock container fixed horizontal">{docks}</div>
    }
}

export interface IWindowSplitViewProps {
    activeSplitId: string
    split: ISplitInfo<IAugmentedSplitInfo>
    windowManager: WindowManager
}

const px = (num: number): string => num.toString() + "px"

const rectangleToStyleProperties = (
    item: LayoutResultInfo,
    totalHeight: number,
): React.CSSProperties => {
    const halfPadding = 3
    const { rectangle: rect, split } = item
    const topPosition = rect.y === 0 ? 0 : Math.ceil(rect.y) + halfPadding

    const bottomPadding = Math.ceil(rect.y + rect.height) >= totalHeight ? 0 : halfPadding * 2
    return {
        position: split.isSoftHidden ? "fixed" : "absolute",
        top: px(topPosition),
        left: px(Math.ceil(rect.x) + halfPadding),
        width: px(Math.floor(rect.width) - halfPadding * 2),
        height: px(Math.floor(rect.height) - bottomPadding),
        zIndex: split.isSoftHidden ? -1 : undefined,
    }
}

export class WindowSplitView extends React.PureComponent<IWindowSplitViewProps, {}> {
    public render(): JSX.Element {
        const className = "container horizontal full"

        // TODO: Add drag handles here to allow for resizing!
        return (
            <div className={className}>
                <AutoSizer>
                    {({ height, width }) => {
                        const items = layoutFromSplitInfo(this.props.split, width, height)
                        const vals: JSX.Element[] = Object.values(items).map(item => {
                            const style = rectangleToStyleProperties(item, height)
                            return (
                                <div style={style} key={item.split.id}>
                                    <WindowSplitHost
                                        id={item.split.id}
                                        containerClassName="editor"
                                        split={item.split}
                                        isFocused={this.props.activeSplitId === item.split.id}
                                        onClick={() => {
                                            this.props.windowManager.focusSplit(item.split.id)
                                        }}
                                    />
                                </div>
                            )
                        })
                        return <div style={{ position: "relative" }}>{vals}</div>
                    }}
                </AutoSizer>
            </div>
        )
    }
}

export class WindowSplitsView extends React.PureComponent<IWindowSplitsProps, {}> {
    public render() {
        if (!this.props.splitRoot) {
            return null
        }

        const containerStyle: React.CSSProperties = {
            display: "flex",
            flexDirection: "row",
            width: "100%",
            height: "100%",
        }

        return (
            <div style={containerStyle}>
                <div className="container horizontal full">
                    <Dock splits={this.props.leftDock} activeSplitId={this.props.activeSplitId} />
                    <WindowSplitView
                        split={this.props.splitRoot}
                        windowManager={this.props.windowManager}
                        activeSplitId={this.props.activeSplitId}
                    />
                </div>
            </div>
        )
    }
}

const mapStateToProps = (
    state: WindowState,
    containerProps: IWindowSplitsContainerProps,
): IWindowSplitsProps => {
    return {
        ...containerProps,
        activeSplitId: state.focusedSplitId,
        leftDock: leftDockSelector(state),
        splitRoot: state.primarySplit,
    }
}

export const WindowSplits = connect(mapStateToProps)(WindowSplitsView)
