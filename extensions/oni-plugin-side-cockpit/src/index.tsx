import { EventCallback, IDisposable, IEvent } from "oni-types"
import { CockpitManager } from "./CockpitManager"

import * as Oni from "oni-api"

export function activate(oni: any): any {
    const cockpitManager = new CockpitManager(oni)

    oni.commands.registerCommand(
        new Command("sideCockpit.open", "Open side cockpit", "Open side cockpit pane", () => {
            cockpitManager.open()
        }),
    )

    cockpitManager.open()

    return cockpitManager as any
}

class Command implements Oni.Commands.ICommand {
    constructor(
        public command: string,
        public name: string,
        public detail: string,
        public execute: Oni.Commands.CommandCallback,
    ) {}
}
