import { world, system, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const MAX_PRICE = 1000000;

const stripCodes = (str) => str.replace(/§./g, "");

function countItem(player, itemId) {
    const inv = player.getComponent("inventory").container;
    let count = 0;
    const targetId = itemId.includes(":") ? itemId : `minecraft:${itemId}`;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (item?.typeId === targetId) count += item.amount;
    }
    return count;
}

function removeItem(player, itemId, amount) {
    const cmdId = itemId.startsWith("minecraft:") ? itemId.slice(10) : itemId;
    player.runCommand(`clear @s ${cmdId} -1 ${amount}`);
}

function removeBalance(player, scoreboard, amount) {
    try {
        const obj = world.scoreboard.getObjective(scoreboard);
        if (!obj) return false;

        let bal = 0;
        try {
            bal = obj.getScore(player) ?? 0;
        } catch {
            bal = 0;
        }

        const cost = Number(amount);
        if (bal < cost) return false;

        obj.setScore(player, bal - cost);
        return true;
    } catch (e) {
        console.warn(`Private Vault Balance Error: ${e}`);
        return false;
    }
}

const commandInformation = {
    name: "order",
    description: "Create a buy/sell order in the private vault",
    usage: [
        { name: "item", type: CustomCommandParamType.ItemType, optional: false },
        { name: "type", type: ["buy", "sell"], optional: false },
        { name: "amount", type: CustomCommandParamType.Integer, optional: false },
        { name: "price", type: CustomCommandParamType.Integer, optional: false },
        { name: "currency", type: CustomCommandParamType.String, optional: false }
    ]
};

registerCommand(commandInformation, (origin, item, type, amount, price, currency) => {
    const player = origin.sourceEntity;
    if (!player) return;

    if (!item || !type || amount === undefined || price === undefined || !currency) {
        player.sendMessage({ rawtext: [{ translate: "command.order.invalid_usage" }] });
        return;
    }

    const isSell = (type === "sell");
    const qty = Math.min(Math.max(amount || 0, 1), 10000);
    const finalPrice = Math.min(Math.max(price || 0, 1), MAX_PRICE);
    const itemId = item.id;

    system.run(() => {
        if (!player.isValid) return;

        const searchName = currency.toLowerCase();
        const allObjectives = world.scoreboard.getObjectives();
        const objective = allObjectives.find(obj =>
            obj.id.toLowerCase() === searchName ||
            stripCodes(obj.displayName).toLowerCase() === searchName
        );

        if (!objective) {
            player.sendMessage({ rawtext: [{ translate: "command.general.currency_not_found", with: [currency] }] });
            return;
        }

        const selectedSB = objective.id;

        if (isSell) {
            if (countItem(player, itemId) < qty) {
                player.sendMessage({ rawtext: [{ translate: "command.order.not_enough_items" }] });
                return;
            }
            removeItem(player, itemId, qty);
        } else {
            const totalCost = qty * finalPrice;
            if (!removeBalance(player, selectedSB, totalCost)) {
                player.sendMessage({ rawtext: [{ translate: "command.order.insufficient_funds" }] });
                return;
            }
        }

        const parsed = H.getData(`bz_${itemId}`) || {};
        const data = {
            buy: Array.isArray(parsed.buy) ? parsed.buy : [],
            sell: Array.isArray(parsed.sell) ? parsed.sell : []
        };

        const orderEntry = {
            o: player.id,
            n: player.name,
            p: finalPrice,
            a: qty,
            c: 0,
            sb: selectedSB,
            ts: Date.now()
        };

        if (isSell) {
            data.sell.push(orderEntry);
        } else {
            data.buy.push(orderEntry);
        }

        H.setData(`bz_${itemId}`, data);

        player.sendMessage({ rawtext: [{ translate: "message.order.placed" }] });
    });
});

export default commandInformation;
