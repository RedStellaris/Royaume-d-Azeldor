import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "admin",
    description: "Gives the admin menu item",
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
        const inventory = player.getComponent("inventory").container;
        let hasMenu = false;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item?.typeId === "sh:admin_menu") {
                hasMenu = true;
                break;
            }
        }

        if (hasMenu) {
            player.sendMessage({ rawtext: [{ translate: "message.admin_menu.already_have" }] });
            player.runCommand("playsound note.bass @s");
        } else {
            player.runCommand("give @s sh:admin_menu");
            player.sendMessage({ rawtext: [{ translate: "message.admin_menu.received" }] });
            player.runCommand("playsound random.orb @s");
        }
    });
});

export default commandInformation;