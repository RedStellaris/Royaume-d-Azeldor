import { world, system } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "sellall",
    description: "Sells all sellable items in your inventory",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;

    system.run(() => {
        const inventory = player.getComponent("minecraft:inventory").container;
        const sellItems = H.getData("sellshop_items") || {};

        let totalPayouts = {};
        let itemsSold = 0;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) continue;

            const itemData = sellItems[item.typeId];
            if (itemData) {
                const amount = item.amount;
                const payout = amount * itemData.price;
                const scoreboard = itemData.scoreboard;

                totalPayouts[scoreboard] = (totalPayouts[scoreboard] || 0) + payout;
                itemsSold += amount;

                inventory.setItem(i, undefined);
            }
        }

        if (itemsSold === 0) {
            player.sendMessage({ rawtext: [{ translate: "command.sellall.none_found" }] });
            H.playDenied(player);
            return;
        }

        player.sendMessage({ rawtext: [{ translate: "message.sellall.summary_header" }] });
        for (const [obj, amount] of Object.entries(totalPayouts)) {
            player.runCommand(`scoreboard players add @s "${obj}" ${amount}`);
            player.sendMessage({ rawtext: [{ translate: "message.sellall.line", with: [String(amount), obj] }] });
        }

        player.sendMessage({ rawtext: [{ translate: "message.sellall.total", with: [String(itemsSold)] }] });
        H.playSuccess(player);
        H.spawnRewardParticle(player.dimension, player.location);
    });
});

export default commandInformation;
