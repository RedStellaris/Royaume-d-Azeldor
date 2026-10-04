import { world, system } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "sellhand",
    description: "Sells the item currently in your hand",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;

    system.run(() => {
        const inventory = player.getComponent("minecraft:inventory").container;
        const item = inventory.getItem(player.selectedSlotIndex);

        if (!item) {
            player.sendMessage({ rawtext: [{ translate: "command.sellhand.not_holding" }] });
            H.playDenied(player);
            return;
        }

        const sellItems = H.getData("sellshop_items") || {};
        const itemData = sellItems[item.typeId];

        if (!itemData) {
            player.sendMessage({ rawtext: [{ translate: "command.sellhand.not_sellable" }] });
            H.playDenied(player);
            return;
        }

        const amount = item.amount;
        const payout = amount * itemData.price;
        const name = itemData.displayName ?? item.typeId;

        inventory.setItem(player.selectedSlotIndex, undefined);
        player.runCommand(`scoreboard players add @s "${itemData.scoreboard}" ${payout}`);

        player.sendMessage({ rawtext: [{ translate: "message.sellhand.sold", with: [String(amount), name, String(payout), itemData.scoreboard] }] });
        H.playSuccess(player);
        H.spawnRewardParticle(player.dimension, player.location);
    });
});

export default commandInformation;
