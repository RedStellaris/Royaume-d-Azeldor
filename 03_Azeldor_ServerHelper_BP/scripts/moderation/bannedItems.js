import { system, world } from "@minecraft/server"
import * as H from "../general/helpers"

system.runInterval(() => {
    const bannedItems = H.getData("banned_items", {});
    let hasBannedItems = false;
    for (const _ in bannedItems) {
        hasBannedItems = true;
        break;
    }
    
    if (!hasBannedItems) return;
    const shouldKick = world.getDynamicProperty("itemkick");

    for (const player of world.getAllPlayers()) {
        if (!player.isValid || H.isOp(player)) continue;

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) continue;

        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) continue;

            if (bannedItems[item.typeId]) {
                inventory.setItem(i, undefined);
                player.sendMessage({rawtext: [{translate: "general.bannedItem", with: [item.typeId]}]})
                H.playDenied(player);
                H.addLog("BannedItem", { pId: player.id, pName: player.name, item: item.typeId });
                
                if (shouldKick) {
                    player.runCommand("kick @s %ui.kick.banned");
                    break;
                }
            }
        }
    }
}, 20);