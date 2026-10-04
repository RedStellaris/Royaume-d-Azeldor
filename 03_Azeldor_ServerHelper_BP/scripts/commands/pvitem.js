import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "pvitem",
    description: "Gives the Private Vault item",
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

        const isMenuEnabled = world.getDynamicProperty("pv");
        if (!isMenuEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.pv.disabled" }] });
            return;
        }

        const inventory = player.getComponent("inventory").container;
        let hasMenu = false;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item?.typeId === "sh:pv") {
                hasMenu = true;
                break;
            }
        }

        if (hasMenu) {
            player.sendMessage({ rawtext: [{ translate: "message.pv_item.already_have" }] });
            player.runCommand("playsound note.bass @s");
        } else {
            player.runCommand("give @s sh:pv");
            player.sendMessage({ rawtext: [{ translate: "message.pv_item.received" }] });
            player.runCommand("playsound random.orb @s");
        }
    });
});

export default commandInformation;