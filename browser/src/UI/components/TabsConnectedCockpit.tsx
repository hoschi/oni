import * as React from "react"
import { Store } from "redux"

import * as Log from "oni-core-logging"

import { IFakeCockpitManagerState } from "./../../CockpitTypes"
import { getInstance as getPluginManagerInstance } from "./../../Plugins/PluginManager"

import { TabsContainer } from "./Tabs"

export interface IProps {
    onBufferSelect?: (bufferId: number) => void
    onBufferClose?: (bufferId: number) => void

    onTabSelect?: (tabId: number) => void
    onTabClose?: (tabId: number) => void
}

interface State {
    cockpitState?: IFakeCockpitManagerState
}

export class TabsConnectedCockpit extends React.Component<IProps, State> {
    constructor(props: IProps) {
        super(props)
        this.state = {
            cockpitState: null,
        }
    }
    public componentDidMount() {
        const pm = getPluginManagerInstance()
        if (pm.loaded) {
            // editor in cockpit, not main one
            return
        }

        pm.pluginsAllLoaded.subscribe(() => {
            const cockpitPlugin = pm.getPlugin("oni-plugin-side-cockpit")
            if (!cockpitPlugin) {
                Log.info(`sc - cockpit plugin not found!`)
                return
            }
            Log.info(`sc - cockpit plugin found`)
            const store = cockpitPlugin.store as Store<IFakeCockpitManagerState>
            store.subscribe(() => {
                this.setState({ cockpitState: store.getState() })
            })
            this.setState({ cockpitState: store.getState() })
        })
    }

    public render() {
        return (
            <TabsContainer
                cockpitState={this.state.cockpitState}
                onBufferSelect={this.props.onBufferSelect}
                onBufferClose={this.props.onBufferClose}
                onTabClose={this.props.onTabClose}
                onTabSelect={this.props.onTabSelect}
            />
        )
    }
}
