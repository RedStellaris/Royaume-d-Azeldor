import { system, world } from "@minecraft/server";
import * as H from "../general/helpers";

const BANNED_ITEMS = new Set([
    "minecraft:bedrock",
    "minecraft:barrier",
    "minecraft:command_block",
    "minecraft:repeating_command_block",
    "minecraft:chain_command_block",
    "minecraft:structure_block",
    "minecraft:allow",
    "minecraft:deny",
    "minecraft:border_block",
    "minecraft:command_block_minecart"
]);

const lastReported = new Map();

world.afterEvents.playerLeave.subscribe((ev) => {
    lastReported.delete(ev.playerId);
});

let cachedTrackedString = null;
let cachedTrackedItems = {};

function getTrackedItems() {
    const raw = world.getDynamicProperty("tracked_items");
    
    if (raw === cachedTrackedString) return cachedTrackedItems;
    
    cachedTrackedString = raw;
    try {
        cachedTrackedItems = raw ? JSON.parse(raw) : {};
    } catch {
        cachedTrackedItems = {};
    }
    return cachedTrackedItems;
}

system.runInterval(() => {
    const tracked = getTrackedItems();

    for (const player of world.getPlayers()) {
        if (H.isOp(player)) continue;

        const inventoryComp = player.getComponent("minecraft:inventory");
        if (!inventoryComp) continue;

        const inventory = inventoryComp.container;
        const currentCounts = {};
        let itemsCleared = false;


        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) continue;

            if (BANNED_ITEMS.has(item.typeId)) {
                const itemName = item.typeId.replace("minecraft:", "");
                const alertMsg = { rawtext: [{ translate: "antidupe.alert.illegal_item", with: [player.name, itemName] }] };
                alertAdmins(alertMsg);

                inventory.setItem(i, undefined);
                itemsCleared = true;
                continue;
            }

            if (tracked[item.typeId] !== undefined) {
                currentCounts[item.typeId] = (currentCounts[item.typeId] || 0) + item.amount;
            }
        }

        if (itemsCleared) {
            player.playSound("note.bass", { pitch: 0.5, volume: 1.0 });
        }

        const playerId = player.id;
        if (!lastReported.has(playerId)) {
            lastReported.set(playerId, {});
            system.runTimeout(() => {lastReported.delete(playerId)}, 200)
        }
        const reportedItems = lastReported.get(playerId);

        for (const [itemId, threshold] of Object.entries(tracked)) {
            const count = currentCounts[itemId] || 0;

            if (count >= threshold) {
                const lastAmount = reportedItems[itemId] || 0;

                if (count !== lastAmount) {
                    const warningMsg = { rawtext: [{ translate: "antidupe.alert.item_threshold", with: [player.name, String(count), itemId.replace("minecraft:", "")] }] };
                    alertAdmins(warningMsg);
                    reportedItems[itemId] = count;
                    H.addLog("AntiDupe", { pId: playerId, pName: player.name, item: itemId });

                    if (world.getDynamicProperty("dupekick")) {
                        player.dimension.runCommand(`kick "${player.name}" %antidupe.kick.reason`);
                    }
                }
            }
        }
    }
}, 20);

function alertAdmins(message) {
    for (const player of world.getPlayers()) {
        if (H.isOp(player)) {
            player.sendMessage(message);
        }
    }
}