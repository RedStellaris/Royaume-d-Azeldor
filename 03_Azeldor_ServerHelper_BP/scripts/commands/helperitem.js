import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "helperitem",
    description: "Gives the helper the Helper Menu item",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player || !(player instanceof Player)) return;

    system.run(() => {
        const menuItemCommandsEnabled = world.getDynamicProperty("menuItemCommands");
        if (!menuItemCommandsEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.menu_item_commands.disabled" }] });
            return;
        }

        const isMenuEnabled = world.getDynamicProperty("helper");
        if (!isMenuEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.helper_item.disabled" }] });
            return;
        }

        const inventory = player.getComponent("inventory").container;
        let hasMenu = false;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item?.typeId === "sh:helper_menu") {
                hasMenu = true;
                break;
            }
        }

        if (hasMenu) {
            player.sendMessage({ rawtext: [{ translate: "message.helper_menu.already_have" }] });
            player.runCommand("playsound note.bass @s");
        } else {
            player.runCommand("give @s sh:helper_menu");
            player.sendMessage({ rawtext: [{ translate: "message.helper_menu.received" }] });
            player.runCommand("playsound random.orb @s");
        }
    });
});

export default commandInformation;