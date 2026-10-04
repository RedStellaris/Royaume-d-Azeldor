import { world, system, ItemStack, CustomCommandParamType, EnchantmentTypes, Potions } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const stripCodes = (str) => str.replace(/§[0-9a-fk-or]/gi, "");


function getBalance(player, scoreboard) {
    try {
        return world.scoreboard.getObjective(scoreboard).getScore(player.scoreboardIdentity) ?? 0;
    } catch { return 0; }
}

function removeBalance(player, scoreboard, amount) {
    let bal = getBalance(player, scoreboard);
    if (bal < amount) return false;
    player.runCommand(`scoreboard players remove @s "${scoreboard}" ${amount}`);
    return true;
}

const commandInformation = {
    name: "crate",
    description: "Open a crate for random rewards",
    usage: [
        { name: "crate_name", type: CustomCommandParamType.String, optional: false },
        { name: "amount", type: CustomCommandParamType.Integer, optional: true }
    ]
};

function openLogic(crates, foundCrateId, sender) {
    const activeCrate = crates[foundCrateId];
    const crateItemsData = H.getData("crateItems") || {};
    const itemsList = crateItemsData[foundCrateId] || [];

    if (itemsList.length === 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.crate.empty" }] });
        return false;
    }

    const inventory = sender.getComponent("minecraft:inventory")?.container;
    if (!inventory || inventory.emptySlotsCount === 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.inventory_full" }] });
        return false;
    }

    if (!removeBalance(sender, activeCrate.scoreboard, activeCrate.cost)) {
        sender.sendMessage({ rawtext: [{ translate: "command.crate.not_enough_currency", with: [activeCrate.scoreboard] }] });
        return false;
    }

    const totalChance = itemsList.reduce((sum, item) => sum + (item.chance || 0), 0);

    let random = Math.random() * totalChance;
    let runningTotal = 0;
    let wonItem = null;

    for (const item of itemsList) {
        runningTotal += item.chance;
        if (random <= runningTotal) {
            wonItem = item;
            break;
        }
    }

    if (wonItem) {
        try {
            const itemStack = H.createItemStackFromData(wonItem, wonItem.amount);
            if (itemStack) {
                inventory.addItem(itemStack);
                sender.sendMessage({ rawtext: [{ translate: "message.crate.won", with: [wonItem.name, String(wonItem.amount), String(wonItem.chance), String(totalChance)] }] });
            }
        } catch (e) {
            console.error(`Failed to grant won item ${wonItem.id || wonItem.potion}: ${e}`);
        }
    }

    return true;
}

registerCommand(commandInformation, (origin, crateName, amount) => {
    const sender = origin.sourceEntity;

    if (!sender || !sender.isValid) return;

    const crates = H.getData("crates") || {};
    const targetCrate = crateName.toLowerCase();

    let foundCrateId = null;

    for (const id in crates) {
        const cleanName = stripCodes(String(crates[id].name || id)).toLowerCase();
        if (cleanName.startsWith(targetCrate)) {
            foundCrateId = id;
            break;
        }
    }

    system.run(() => {
        if (foundCrateId) {
            const totalToOpen = (amount && amount > 0) ? amount : 1;

            for (let i = 0; i < totalToOpen; i++) {
                const success = openLogic(crates, foundCrateId, sender);

                if (!success) {
                    if (i > 0) {
                        sender.sendMessage({ rawtext: [{ translate: "message.crate.stopped_after", with: [String(i)] }] });
                    }
                    break;
                }
            }
        } else {
            sender.sendMessage({ rawtext: [{ translate: "command.crate.not_found" }] });
        }
    });
});

export default commandInformation;
