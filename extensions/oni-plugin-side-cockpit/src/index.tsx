import { EventCallback, IDisposable, IEvent } from "oni-types"
import { CockpitManager } from "./CockpitManager"

import * as Oni from "oni-api"

export function activate(oni: any): any {
    if (!oni.configuration.getValue("experimental.sideCockpit.enabled", false)) {
        return
    }

    const cockpitManager = new CockpitManager(oni)

    oni.commands.registerCommand(
        new Command("sideCockpit.init", "Cockpit: Init", "Init Cockpit pane", () => {
            cockpitManager.init()
        }),
    )

    oni.commands.registerCommand(
        new Command("sideCockpit.toggle", "Cockpit: Toggle", "Toggle Cockpit pane", () => {
            cockpitManager.toggle()
        }),
    )

    oni.commands.registerCommand(
        new Command(
            "sideCockpit.setMasterFile",
            "Cockpit: Set Master file",
            "Set current file as master file",
            () => {
                cockpitManager.setMasterFile()
            },
        ),
    )

    oni.commands.registerCommand(
        new Command(
            "sideCockpit.pushToCockpit",
            "Cockpit: Push to Cockpit",
            "Push current buffer to Cockpit",
            () => {
                cockpitManager.show()
                cockpitManager.pushToCockpit()
            },
        ),
    )

    oni.commands.registerCommand(
        new Command(
            "sideCockpit.pushToEditor",
            "Cockpit: Push to Editor",
            "Push current cockpit buffer to Editor",
            () => {
                cockpitManager.show()
                cockpitManager.pushToEditor()
            },
        ),
    )

    oni.commands.registerCommand(
        new Command(
            "sideCockpit.swapEditors",
            "Cockpit: Swap Editors",
            "Swap sides so user can edit left or right",
            () => {
                cockpitManager.show()
                cockpitManager.swapEditors()
            },
        ),
    )

    cockpitManager.init()

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
