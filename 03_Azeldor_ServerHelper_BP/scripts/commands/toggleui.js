import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "toggleui",
    description: "Toggles whether to use the custom UI tag or not",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player || !(player instanceof Player)) return;

    if (!H.isOp(player)) {
        player.sendMessage({ rawtext: [{ translate: "command.general.no_permission" }] });
        return;
    }

    system.run(() => {
        const currentState = world.getDynamicProperty("customTagVisible") ?? true;
        const newState = !currentState;

        world.setDynamicProperty("customTagVisible", newState);

        player.sendMessage({ rawtext: [{ translate: newState ? "message.toggleui.enabled" : "message.toggleui.disabled" }] });
    });
});

export default commandInformation;
