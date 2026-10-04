import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import { PlayerMainMenu } from "../player/playerUi";
import * as H from "../general/helpers";

const commandInformation = {
    name: "menu",
    description: "Opens the player menu",
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

        const isMenuEnabled = world.getDynamicProperty("pmenu");
        if (!isMenuEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.menu.disabled" }] });
            return;
        }

        PlayerMainMenu(player)
    });
});

export default commandInformation;