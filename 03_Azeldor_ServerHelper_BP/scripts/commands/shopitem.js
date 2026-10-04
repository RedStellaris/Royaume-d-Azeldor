import { world, system } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "shopitem",
    description: "Gives the shop item",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;

    system.run(() => {
        const inventory = player.getComponent("minecraft:inventory").container;
        let hasShop = false;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item && item.typeId === "sh:shop") {
                hasShop = true;
                break;
            }
        }

        const economyEnabled = world.getDynamicProperty("economy") === true;

        if (economyEnabled && hasShop) {
            player.sendMessage({ rawtext: [{ translate: "message.shop_item.already_have" }] });
        } else if (!economyEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.shop.disabled" }] });
        } else if (economyEnabled && !hasShop) {
            player.runCommand("give @s sh:shop");
            player.sendMessage({ rawtext: [{ translate: "message.shop_item.received" }] });
        }
    });
});

export default commandInformation;
