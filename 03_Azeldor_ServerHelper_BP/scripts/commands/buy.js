import { world, system, CustomCommandParamType, ItemStack } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

function getBalance(player, scoreboard) {
    try {
        const objective = world.scoreboard.getObjective(scoreboard);
        return objective.getScore(player) ?? 0;
    } catch { return 0; }
}

const commandInformation = {
    name: "buy",
    description: "Purchase an item from the shop",
    usage: [
        { name: "item", type: CustomCommandParamType.ItemType, optional: false },
        { name: "amount", type: CustomCommandParamType.Integer, optional: false }
    ]
};

registerCommand(commandInformation, (origin, itemInput, amount) => {
    const player = origin.sourceEntity;
    if (!player) return;

    if (amount <= 0) {
        player.sendMessage({ rawtext: [{ translate: "command.buy.invalid_amount" }] });
        return;
    }

    const buyItems = H.getData("buyshop_items") || {};
    const searchId = itemInput.id.toLowerCase();

    const shopEntryKey = Object.keys(buyItems).find(id => id.toLowerCase() === searchId);
    const itemData = buyItems[shopEntryKey];

    if (!itemData) {
        player.sendMessage({ rawtext: [{ translate: "command.buy.item_unavailable", with: [searchId] }] });
        return;
    }

    const totalCost = amount * itemData.price;
    const currentBalance = getBalance(player, itemData.scoreboard);

    if (currentBalance < totalCost) {
        player.sendMessage({ rawtext: [{ translate: "command.buy.insufficient_funds", with: [String(totalCost), itemData.scoreboard] }] });
        return;
    }

    system.run(() => {
        const displayName = itemData.displayName ?? searchId;
        const objective = world.scoreboard.getObjective(itemData.scoreboard);

        if (objective) {
            objective.addScore(player, -totalCost);
        }

        const container = player.getComponent("minecraft:inventory").container;
        const refStack = new ItemStack(searchId, 1);
        const maxStack = refStack.maxAmount;

        let remaining = amount;
        let totalFailed = 0;

        while (remaining > 0) {
            const giveAmount = Math.min(remaining, maxStack);
            const stackToGive = new ItemStack(searchId, giveAmount);
            const remainder = container.addItem(stackToGive);

            if (remainder) {
                totalFailed += remainder.amount;
            }
            remaining -= giveAmount;
        }

        const refund = totalFailed * itemData.price;
        const successAmount = amount - totalFailed;

        if (refund > 0 && objective) {
            objective.addScore(player, refund);
        }

        if (successAmount > 0) {
            player.sendMessage({ rawtext: [{ translate: "message.buy.success", with: [String(successAmount), displayName, String(totalCost - refund), itemData.scoreboard] }] });
            player.runCommand("playsound random.levelup @s");
        } else {
            player.sendMessage({ rawtext: [{ translate: "command.buy.no_space", with: [String(refund)] }] });
        }
    });
});

export default commandInformation;
