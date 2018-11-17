import { EventCallback, IDisposable, IEvent } from "oni-types"
import { SideCockpitManager } from "./SideCockpitManager"

import * as Oni from "oni-api"

export function activate(oni: any): any {
    const sideCockpitManager = new SideCockpitManager(oni)

    oni.commands.registerCommand(
        new Command("sideCockpit.open", "Open side cockpit", "Open side cockpit pane", () => {
            sideCockpitManager.open()
        }),
    )

    sideCockpitManager.open()

    return sideCockpitManager as any
}

class Command implements Oni.Commands.ICommand {
    constructor(
        public command: string,
        public name: string,
        public detail: string,
        public execute: Oni.Commands.CommandCallback,
    ) {}
}
