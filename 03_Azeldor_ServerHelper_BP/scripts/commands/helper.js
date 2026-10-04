import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import { helperMenu } from "../misc/helperMenu";
import * as H from "../general/helpers";

const commandInformation = {
    name: "helper",
    description: "Opens the helper menu",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player || !(player instanceof Player)) return;

    system.run(() => {
        const menuCommandsEnabled = world.getDynamicProperty("menuCommands");
        if (!menuCommandsEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.menu_commands.disabled" }] });
            return;
        }

        const isMenuEnabled = world.getDynamicProperty("helper");
        if (!isMenuEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.helper.disabled" }] });
            return;
        }

        if (!player.hasTag("helper") && !H.isOp(player)) {
            player.sendMessage({ rawtext: [{ translate: "command.helper.no_permission" }] });
            return;
        }

        helperMenu(player);
    });
});

export default commandInformation;