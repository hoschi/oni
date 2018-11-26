import { EventCallback, IDisposable, IEvent } from "oni-types"
import { CockpitManager } from "./CockpitManager"

import * as Oni from "oni-api"

export function activate(oni: any): any {
    const cockpitManager = new CockpitManager(oni)

    oni.commands.registerCommand(
        new Command("sideCockpit.open", "Cockpit: Open", "Open Cockpit pane", () => {
            cockpitManager.open()
        }),
    )
    oni.commands.registerCommand(
        new Command(
            "sideCockpit.pushToCockpit",
            "Cockpit: Push to Cockpit",
            "Push current buffer to Cockpit",
            () => {
                cockpitManager.pushToCockpit()
            },
        ),
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
