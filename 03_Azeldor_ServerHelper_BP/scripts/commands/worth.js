import { world, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const formatName = (id) => {
    const name = id.includes(":") ? id.split(":")[1] : id;
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");
};

const commandInformation = {
    name: "worth",
    description: "Find the worth of your held item, or something else",
    usage: [
        { name: "item", type: CustomCommandParamType.ItemType, optional: true },
        { name: "amount", type: CustomCommandParamType.Integer, optional: true }
    ]
};

registerCommand(commandInformation, (origin, item, amount) => {
    const player = origin.sourceEntity;
    if (!player) return;

    const sellItems = H.getData("sellshop_items") || {};
    let itemId;
    let itemAmount = amount ?? 1;
    let itemData;

    if (item) {
        itemId = item.id;
    } else {
        const container = player.getComponent("minecraft:inventory").container;
        const heldItem = container.getItem(player.selectedSlotIndex);
        if (!heldItem) {
            player.sendMessage({ rawtext: [{ translate: "command.worth.not_holding" }] });
            return;
        }
        itemId = heldItem.typeId;
        if (!amount) itemAmount = heldItem.amount;
    }

    itemData = sellItems[itemId];
    if (!itemData) {
        player.sendMessage({ rawtext: [{ translate: "command.worth.not_sellable" }] });
        return;
    }

    const totalWorth = itemData.price * itemAmount;
    const displayName = formatName(itemId);
    const currency = itemData.scoreboard;

    player.sendMessage({ rawtext: [{ translate: "message.worth.result", with: [String(itemAmount), displayName, String(totalWorth), currency] }] });
});

export default commandInformation;
