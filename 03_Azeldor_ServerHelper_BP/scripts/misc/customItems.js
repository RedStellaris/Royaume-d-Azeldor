import { world, system, BlockPermutation, EquipmentSlot } from "@minecraft/server";
import * as H from "../general/helpers"

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const equipment = player.getComponent("minecraft:equippable");
        if (!equipment) continue;

        const headItem = equipment.getEquipment(EquipmentSlot.Head);
        if (headItem?.typeId === "sh:miner_helmet") {
            player.addEffect("haste", 100, { amplifier: 0, showParticles: false });
            player.addEffect("night_vision", 400, { amplifier: 0, showParticles: false });
        }

        const feetItem = equipment.getEquipment(EquipmentSlot.Feet);
        if (feetItem?.typeId === "sh:farmer_boots") {
            player.addEffect("saturation", 100, { amplifier: 0, showParticles: false });
            player.addEffect("speed", 100, { amplifier: 0, showParticles: false });
        }
    }
}, 40);

const CROP_MAP = {
    "minecraft:wheat": "minecraft:wheat_seeds",
    "minecraft:carrots": "minecraft:carrot",
    "minecraft:potatoes": "minecraft:potato",
    "minecraft:beetroots": "minecraft:beetroot_seeds",
    "minecraft:nether_wart": "minecraft:nether_wart",
    "minecraft:cocoa": "minecraft:cocoa_beans"
};

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { block, brokenBlockPermutation, player, itemStackBeforeBreak: item } = event;
    if (!item || item.typeId !== "sh:auto_hoe") return;

    const blockId = brokenBlockPermutation.type.id;
    const seedId = CROP_MAP[blockId];

    if (seedId) {
        const inventory = player.getComponent("minecraft:inventory").container;
    
        for (let i = 0; i < inventory.size; i++) {
            const slotItem = inventory.getItem(i);
            
            if (slotItem && slotItem.typeId === seedId) {
                const { x, y, z } = block.location;
                const dimension = player.dimension;

                system.run(() => {
                    const targetBlock = dimension.getBlock({ x, y, z });
                    targetBlock.setPermutation(BlockPermutation.resolve(blockId));
                    if (slotItem.amount > 1) {
                        slotItem.amount -= 1;
                        inventory.setItem(i, slotItem);
                    } else {
                        inventory.setItem(i, undefined);
                    }
                    
                    const equippable = player.getComponent("minecraft:equippable");
                    const heldItem = equippable.getEquipment("Mainhand");

                    if (heldItem && heldItem.typeId === "sh:auto_hoe") {
                        const durability = heldItem.getComponent("minecraft:durability");
                        if (durability) {
                            if (durability.damage + 1 >= durability.maxDurability) {
                                equippable.setEquipment("Mainhand", undefined);
                                player.playSound("random.break");
                            } else {
                                durability.damage += 1;
                                equippable.setEquipment("Mainhand", heldItem);
                            }
                        }
                    }
                });
                break; 
            }
        }
    }
});

function addBalance(player, scoreboard, amount) {
    player.runCommand(`scoreboard players add @s "${scoreboard}" ${amount}`);
}

function getsellShopItems() {
    let raw = world.getDynamicProperty("sellshop_items");
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

world.afterEvents.itemStartUseOn.subscribe((event) => {
    const { source: player, itemStack, block } = event;

    if (itemStack?.typeId !== "sh:sell_wand") return;

    const container = block.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const { x, z } = block.location;
    const claims = H.getData("worldclaims", {});
    let canSell = false;

    for (const ownerId in claims) {
        const c = claims[ownerId];
        const isInside = x >= Math.min(c.x1, c.x2) && x <= Math.max(c.x1, c.x2) &&
                         z >= Math.min(c.z1, c.z2) && z <= Math.max(c.z1, c.z2);

        if (isInside) {
            if (player.id === ownerId) {
                canSell = true;
            }
            break;
        }
    }

    if (!world.getDynamicProperty("landclaim")) canSell = true;

    if (!canSell) {
        player.sendMessage({ rawtext: [{ translate: "message.sellwand.not_owner" }] });
        return;
    }

    event.cancel = true;

    system.run(() => {
        const sellItems = getsellShopItems();
        let totalPayouts = {};
        let itemsSold = 0;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item) continue;

            const sellData = sellItems[item.typeId];
            if (sellData) {
                const payout = item.amount * sellData.price;
                const currency = sellData.scoreboard;

                totalPayouts[currency] = (totalPayouts[currency] || 0) + payout;
                itemsSold += item.amount;

                container.setItem(i, undefined);
            }
        }

        if (itemsSold > 0) {
            for (const [currency, amount] of Object.entries(totalPayouts)) {
                addBalance(player, currency, amount);
            }

            const totalMoney = Object.values(totalPayouts).reduce((a, b) => a + b, 0);

            player.sendMessage({ 
                rawtext: [{ 
                    translate: "message.sellwand.success", 
                    with: [String(itemsSold), String(totalMoney)] 
                }] 
            });
            player.runCommand(`playsound random.levelup @s`);

            handleWandDurability(player);
        } else {
            player.sendMessage({ rawtext: [{ translate: "message.sellwand.empty" }] });
        }
    });
});

function handleWandDurability(player) {
    const equippable = player.getComponent("minecraft:equippable");
    const wand = equippable.getEquipment("Mainhand");

    if (wand && wand.typeId === "sh:sell_wand") {
        const durability = wand.getComponent("minecraft:durability");
        if (durability) {
            if (durability.damage + 1 >= durability.maxDurability) {
                equippable.setEquipment("Mainhand", undefined);
                player.playSound("random.break");
            } else {
                durability.damage += 1;
                equippable.setEquipment("Mainhand", wand);
            }
        }
    }
}