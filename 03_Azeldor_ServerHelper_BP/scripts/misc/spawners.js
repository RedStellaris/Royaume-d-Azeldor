import { system, world, EquipmentSlot, ItemStack } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers"

const UI_LORE = "ui_item";
const ENTITY_TYPE = "sh:spawner";
const ENTITY_TYPEV2 = "sh:spawnerv2";
const SPAWNER = "§s§p§a§w§n§e§r";
const SPAWNER_IN_USE = "§s§p§a§w§n§e§r§1";
const SPAWNERV2 = "§s§p§a§w§n§e§r§2";
const SPAWNER_IN_USEV2 = "§s§p§a§w§n§e§r§3";
const CHUNK_SIZE = 8000;

let activeSpawnersCache = null;

const blockMismatchStreak = {};
const BLOCK_MISMATCH_CONFIRM_THRESHOLD = 10;

const getActiveSpawners = () => {
    if (!activeSpawnersCache) {
        const raw = world.getDynamicProperty("activespawners");
        try {
            activeSpawnersCache = raw ? JSON.parse(raw) : {};
        } catch {
            activeSpawnersCache = {};
        }
    }
    return activeSpawnersCache;
};

const saveActiveSpawners = (data) => {
    activeSpawnersCache = data;
    world.setDynamicProperty("activespawners", JSON.stringify(data));
};

function getsellShopItems() {
    return H.getData("sellshop_items") || {};
}

world.afterEvents.worldLoad.subscribe(() => {
    activeSpawnersCache = null;
});

function getLargeData(baseKey) {
    let fullString = "";
    let index = 0;
    while (true) {
        const chunk = world.getDynamicProperty(`${baseKey}_${index}`);
        if (chunk === undefined) break;
        fullString += chunk;
        index++;
    }
    if (fullString === "") return null;
    try { return JSON.parse(fullString); } catch { return null; }
}

function setLargeData(baseKey, value) {
    let index = 0;
    if (value === null) {
        while (world.getDynamicProperty(`${baseKey}_${index}`) !== undefined) {
            world.setDynamicProperty(`${baseKey}_${index}`, undefined);
            index++;
        }
        return;
    }

    const fullString = JSON.stringify(value);
    while (world.getDynamicProperty(`${baseKey}_${index}`) !== undefined) {
        world.setDynamicProperty(`${baseKey}_${index}`, undefined);
        index++;
    }

    for (let i = 0; i < fullString.length; i += CHUNK_SIZE) {
        const chunk = fullString.substring(i, i + CHUNK_SIZE);
        world.setDynamicProperty(`${baseKey}_${Math.floor(i / CHUNK_SIZE)}`, chunk);
    }
}

function ui_item(item) {
    if (!item) return false;
    const lore = item.getLore();
    return lore && lore.length > 0 && lore[0].startsWith(UI_LORE);
}

function giveOrDropItem(player, item) {
    const container = player.getComponent("inventory").container;
    const leftover = container.addItem(item.clone());
    if (leftover) player.dimension.spawnItem(leftover, player.location);
}

function purgeIllegalItems(player) {
    const cursor = player.getComponent("cursor_inventory");
    if (cursor?.item && ui_item(cursor.item)) cursor.clear();

    const inv = player.getComponent("inventory").container;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (item && ui_item(item)) inv.setItem(i, undefined);
    }
}

function cleanupUI(player, entity, isSimple) {
    if (!player || !entity.isValid) return;
    const container = entity.getComponent("inventory").container;
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && !ui_item(item)) {
            if (!isSimple) giveOrDropItem(player, item);
            container.setItem(i, undefined);
        } else if (item && ui_item(item)) {
            container.setItem(i, undefined);
        }
    }
}

function getDistanceSquared(loc1, loc2) {
    const dx = loc1.x - loc2.x;
    const dy = loc1.y - loc2.y;
    const dz = loc1.z - loc2.z;
    return dx * dx + dy * dy + dz * dz;
}

function getPageDigits(page) {
    try {
        const displayNum = (page + 1).toString().padStart(2, "0");
        const d1 = new ItemStack(`sh:ui_num${displayNum[0]}`);
        const d2 = new ItemStack(`sh:ui_num${displayNum[1]}`);
        d1.setLore([UI_LORE]);
        d2.setLore([UI_LORE]);
        return [d1, d2];
    } catch (e) {
        const fallback = new ItemStack("minecraft:paper");
        fallback.nameTag = `§ePage ${page + 1}`;
        fallback.setLore([UI_LORE]);
        return [fallback, fallback];
    }
}

function createItemFromData(info) {
    if (!info || !info.typeId) return undefined;
    try {
        const stack = new ItemStack(info.typeId, info.amount || 1);
        if (info.nameTag) stack.nameTag = info.nameTag;
        return stack;
    } catch (e) { return undefined; }
}

function saveSpawnerInventory(entity, key) {
    if (!entity.isValid || !key) return;
    const container = entity.getComponent("inventory").container;
    const page = entity.getDynamicProperty("current_page") ?? 0;

    let allItems = getLargeData(`spawner_inv_${key}`) ?? [];
    const startIndex = page * 48;
    let changes = false;

    for (let i = 0; i < 48; i++) {
        const item = container.getItem(i);
        const storageIndex = startIndex + i;

        if (item && !ui_item(item)) {
            const itemData = { typeId: item.typeId, amount: item.amount, nameTag: item.nameTag };
            if (JSON.stringify(allItems[storageIndex]) !== JSON.stringify(itemData)) {
                allItems[storageIndex] = itemData;
                changes = true;
            }
        } else if (allItems[storageIndex]) {
            allItems[storageIndex] = null;
            changes = true;
        }
    }
    if (changes) setLargeData(`spawner_inv_${key}`, allItems);
}

function addItemsToVirtualStorage(key, itemStack, totalAmount, spawnerData) {
    let allItems = getLargeData(`spawner_inv_${key}`) ?? [];
    let remaining = totalAmount;
    const maxStackSize = 64;

    for (let i = 0; i < allItems.length; i++) {
        if (remaining <= 0) break;
        const slot = allItems[i];
        if (slot && slot.typeId === itemStack.typeId && !slot.nameTag) {
            if (slot.amount < maxStackSize) {
                const space = maxStackSize - slot.amount;
                const add = Math.min(space, remaining);
                slot.amount += add;
                remaining -= add;
            }
        }
    }

    let idx = 0;
    while (remaining > 0) {
        while (idx < 480 && allItems[idx] !== null && allItems[idx] !== undefined) idx++;
        if (idx >= 480) break;
        const add = Math.min(maxStackSize, remaining);
        allItems[idx] = { typeId: itemStack.typeId, amount: add };
        remaining -= add;
    }

    setLargeData(`spawner_inv_${key}`, allItems);

    try {
        if (spawnerData) {
            const dim = world.getDimension(spawnerData.dimension);
            const existing = dim.getEntities({ type: ENTITY_TYPEV2, location: spawnerData.location, maxDistance: 2 });
            if (existing.length > 0 && existing[0].nameTag === SPAWNER_IN_USEV2) {
                setupSpawnerUI(existing[0], key);
            }
        }
    } catch (e) { console.warn(e); }
}

function handleSellAll(player, entity, key, isSimple) {
    system.run(() => {
        const sellItems = getsellShopItems();
        let totalPayouts = {};
        let itemsSold = 0;

        if (isSimple && key) {
            let allItems = getLargeData(`spawner_inv_${key}`) ?? [];
            let changes = false;

            for (let i = 0; i < allItems.length; i++) {
                const itemData = allItems[i];
                if (!itemData || itemData.nameTag) continue;

                const cleanId = itemData.typeId.replace("minecraft:", "");
                const shopData = sellItems[itemData.typeId] || sellItems[cleanId];
                
                if (shopData) {
                    const amount = itemData.amount;
                    const payout = amount * shopData.price;
                    totalPayouts[shopData.scoreboard] = (totalPayouts[shopData.scoreboard] || 0) + payout;
                    itemsSold += amount;
                    allItems[i] = null;
                    changes = true;
                }
            }
            if (changes) setLargeData(`spawner_inv_${key}`, allItems);
        } else {
            const container = entity.getComponent("inventory").container;
            for (let i = 0; i < container.size; i++) {
                const item = container.getItem(i);
                if (!item || ui_item(item)) continue;

                const cleanId = item.typeId.replace("minecraft:", "");
                const shopData = sellItems[item.typeId] || sellItems[cleanId];
                
                if (shopData) {
                    const amount = item.amount;
                    const payout = amount * shopData.price;
                    totalPayouts[shopData.scoreboard] = (totalPayouts[shopData.scoreboard] || 0) + payout;
                    itemsSold += amount;
                    container.setItem(i, undefined);
                }
            }
        }

        if (itemsSold === 0) {
            player.sendMessage({ rawtext: [{ translate: "spawner.message.no_sellable" }] });
            player.playSound("note.bass");
            return;
        }

        player.sendMessage({ rawtext: [{ translate: "spawner.message.sell_summary" }] });
        for (const [obj, amount] of Object.entries(totalPayouts)) {
            player.runCommand(`scoreboard players add @s "${obj}" ${amount}`);
            player.sendMessage({ rawtext: [{ translate: "spawner.message.sell_payout", with: [amount.toString(), obj.toString()] }] });
        }
        player.sendMessage({ rawtext: [{ translate: "spawner.message.total_sold", with: [itemsSold.toString()] }] });
        player.playSound("random.levelup");

        setupSpawnerUI(entity, key);
    });
}

function setupSpawnerUI(entity, key) {
    if (!entity.isValid) return;
    const container = entity.getComponent("inventory").container;
    container.clearAll();

    const isSimple = !!world.getDynamicProperty("simple_spawners");
    let infoSpawner;

    if (key) {
        const activeSpawners = getActiveSpawners();
        const spawnerData = activeSpawners[key];
        if (spawnerData) {
            const cleanName = spawnerData.mob.replace("minecraft:", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
            infoSpawner = new ItemStack("sh:mob_spawner", 1);
            infoSpawner.nameTag = `§b§l${cleanName}`;
            infoSpawner.setLore([UI_LORE, `§7Amount in stack: §e${spawnerData.size}`]);
        }
    }

    if (isSimple && key) {
        const page = entity.getDynamicProperty("current_page") ?? 0;
        const startIndex = page * 48;
        const allItems = getLargeData(`spawner_inv_${key}`) ?? [];

        for (let i = 0; i < 48; i++) {
            const itemData = allItems[startIndex + i];
            if (itemData) {
                const itemStack = createItemFromData(itemData);
                if (itemStack) container.setItem(i, itemStack);
            }
        }

        const sellBtn = new ItemStack("sh:all_listings", 1);
        sellBtn.nameTag = "§e§lSell All Loot";
        sellBtn.setLore([UI_LORE, "§7Sells all sellable items", "§7stored in this spawner."]);
        container.setItem(48, sellBtn);

        const addBtn = new ItemStack("minecraft:emerald_block", 1);
        addBtn.nameTag = "§a§lAdd to Stack";
        addBtn.setLore([UI_LORE]);
        container.setItem(49, addBtn);

        const remBtn = new ItemStack("minecraft:redstone_block", 1);
        remBtn.nameTag = "§c§lRemove from Stack";
        remBtn.setLore([UI_LORE]);
        container.setItem(50, remBtn);

        if (infoSpawner) container.setItem(51, infoSpawner);

        try {
            const [d1, d2] = getPageDigits(page);
            container.setItem(52, d1);
            container.setItem(53, d2);
        } catch (e) { }

        const backBtn = new ItemStack("sh:previous_page", 1);
        backBtn.nameTag = "§6Previous Page";
        backBtn.setLore([UI_LORE]);
        container.setItem(54, backBtn);

        const nextBtn = new ItemStack("sh:next_page", 1);
        nextBtn.nameTag = "§dNext Page";
        nextBtn.setLore([UI_LORE]);
        container.setItem(55, nextBtn);
    } else {
        const addBtn = new ItemStack("minecraft:emerald_block", 1);
        addBtn.nameTag = "§a§lAdd to Stack";
        addBtn.setLore([UI_LORE]);
        container.setItem(0, addBtn);

        const remBtn = new ItemStack("minecraft:redstone_block", 1);
        remBtn.nameTag = "§c§lRemove from Stack";
        remBtn.setLore([UI_LORE]);
        container.setItem(1, remBtn);

        if (infoSpawner) container.setItem(2, infoSpawner);
    }
}

async function handleSpawnerClick(entity, player, slotIndex, key) {
    const data = getActiveSpawners();
    if (!data[key]) return;

    const mobType = data[key].mob;
    const useSimple = !!world.getDynamicProperty("simple_spawners");

    if (!useSimple) {
        if (slotIndex === 0) await showAddSpawnerUI(player, key, mobType, entity);
        else if (slotIndex === 1) await showRemoveSpawnerUI(player, key, mobType, entity);
        else if (slotIndex === 2) handleSellAll(player, entity, key, false);
    } else {
        if (slotIndex === 48) handleSellAll(player, entity, key, true);
        else if (slotIndex === 49) await showAddSpawnerUI(player, key, mobType, entity);
        else if (slotIndex === 50) await showRemoveSpawnerUI(player, key, mobType, entity);
        else if (slotIndex === 54) {
            const page = entity.getDynamicProperty("current_page") ?? 0;
            if (page > 0) {
                entity.setDynamicProperty("current_page", page - 1);
                player.playSound("random.click");
            }
        } else if (slotIndex === 55) {
            const page = entity.getDynamicProperty("current_page") ?? 0;
            if (page < 9) {
                entity.setDynamicProperty("current_page", page + 1);
                player.playSound("random.click");
            }
        }
    }
}

function updateMobStackDisplay(entity, size) {
    const cleanName = entity.typeId.replace("minecraft:", "").replace(/_/g, " ").toUpperCase();
    entity.setDynamicProperty("stack_size", size);
    entity.nameTag = size > 1 ? `§b${size}§dx §f${cleanName}` : "";
}

function generateAndStoreLoot(dimension, mobType, multiplier, key, spawnerData) {
    try {
        const tempMob = dimension.spawnEntity(mobType, spawnerData.location);
        const drops = world.getLootTableManager().generateLootFromEntity(tempMob);

        if (tempMob && tempMob.isValid) {
            const rideable = tempMob.getComponent("minecraft:rideable");
            if (rideable) {
                for (const rider of rideable.getRiders()) {
                    if (rider && rider.isValid) rider.remove();
                }
            }
            tempMob.remove();
        }

        if (!drops) return;

        for (const drop of drops) {
            if (!drop) continue;
            addItemsToVirtualStorage(key, drop, drop.amount * multiplier, spawnerData);
        }
    } catch (e) { console.warn(e); }
}

let isTickRunning = false;
let localTickCounter = 0;

system.runInterval(async () => {
    if (isTickRunning) return;
    isTickRunning = true;
    localTickCounter++;

    try {
        const activeSpawners = getActiveSpawners();
        const useSimple = !!world.getDynamicProperty("simple_spawners");

        const activeTag = useSimple ? SPAWNER_IN_USEV2 : SPAWNER_IN_USE;
        const seenIds = new Set();
        const inUseEntities = [];
        for (const p of world.getAllPlayers()) {
            if (!p.isValid) continue;
            let nearby;
            try {
                nearby = p.dimension.getEntities({ name: activeTag, location: p.location, maxDistance: 12 });
            } catch (e) { continue; }
            for (const ent of nearby) {
                if (seenIds.has(ent.id)) continue;
                seenIds.add(ent.id);
                inUseEntities.push(ent);
            }
        }

        {
            for (const ent of inUseEntities) {
                if (!ent.isValid) continue;

                try {
                    const tag = ent.getTags().find(t => t.startsWith("spawner_"));
                    if (!tag) continue;

                    const parts = tag.split("_");
                    const key = `${parts[1]},${parts[2]},${parts[3]},${ent.dimension.id}`;
                    const ownerId = ent.getDynamicProperty("owner_id");

                    let player;
                    try { player = world.getEntity(ownerId); } catch (e) { }
                    if (!player && typeof ownerId === "string") {
                        player = world.getPlayers({ name: ownerId })[0];
                    }

                    if (!ownerId || !player || getDistanceSquared(player.location, ent.location) > 25) {
                        const resetTag = useSimple ? SPAWNERV2 : SPAWNER;
                        if (useSimple) saveSpawnerInventory(ent, key);
                        cleanupUI(player, ent, useSimple);
                        ent.nameTag = resetTag;
                        const trueOwner = activeSpawners[key]?.owner_id;
                        if (trueOwner) ent.setDynamicProperty("owner_id", trueOwner);
                        continue;
                    }

                    purgeIllegalItems(player);
                    if (useSimple) saveSpawnerInventory(ent, key);

                    const container = ent.getComponent("inventory").container;
                    const slotsToCheck = useSimple ? [48, 49, 50, 51, 52, 53, 54, 55] : [0, 1, 2];

                    for (const i of slotsToCheck) {
                        const item = container.getItem(i);
                        if ((i === 51 || i === 52 || i === 53 || i === 2) && (!item || !ui_item(item))) {
                            setupSpawnerUI(ent, key);
                            break;
                        } else if (item && !ui_item(item)) {
                            giveOrDropItem(player, item);
                            setupSpawnerUI(ent, key);
                            break;
                        } else if (!item) {
                            await handleSpawnerClick(ent, player, i, key);
                            setupSpawnerUI(ent, key);
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`[spawner] Skipped an in-use spawner entity this cycle due to an error: ${e}`);
                }
            }

            let dataUpdated = false;
            for (const key in activeSpawners) {
                const spawner = activeSpawners[key];
                let dim;
                try { dim = world.getDimension(spawner.dimension); } catch (e) { continue; }
                const loc = spawner.location;

                try {
                    const block = dim.getBlock(loc);
                    if (!block) {
                        continue;
                    }
                    if (block.typeId !== "sh:mob_spawner") {
                        blockMismatchStreak[key] = (blockMismatchStreak[key] || 0) + 1;
                        if (blockMismatchStreak[key] < BLOCK_MISMATCH_CONFIRM_THRESHOLD) {
                            continue;
                        }
                        delete blockMismatchStreak[key];
                        delete activeSpawners[key];
                        dataUpdated = true;
                        console.warn(`[spawner] Removed spawner data at ${key} after confirming the block is no longer sh:mob_spawner.`);
                        continue;
                    }
                    blockMismatchStreak[key] = 0;
                    const tag = `spawner_${loc.x}_${loc.y}_${loc.z}`;
                    const targetType = useSimple ? ENTITY_TYPEV2 : ENTITY_TYPE;
                    const obsoleteType = useSimple ? ENTITY_TYPE : ENTITY_TYPEV2;

                    if (localTickCounter % 10 === 0) {
                        const outdated = dim.getEntities({ type: obsoleteType, tags: [tag] }).filter(e => e.isValid);
                        for (const outEnt of outdated) {
                            if (obsoleteType === ENTITY_TYPE) {
                                const container = outEnt.getComponent("inventory")?.container;
                                if (container) {
                                    for (let i = 0; i < container.size; i++) {
                                        const item = container.getItem(i);
                                        if (item && !ui_item(item)) {
                                            dim.spawnItem(item.clone(), { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 });
                                        }
                                    }
                                }
                            }
                            outEnt.remove();
                        }

                        const existing = dim.getEntities({ type: targetType, tags: [tag] }).filter(e => e.isValid);
                        if (existing.length === 0) {
                            let ent = dim.spawnEntity(targetType, { x: loc.x + 0.5, y: loc.y, z: loc.z + 0.5 });
                            ent.addTag(tag);
                            ent.nameTag = useSimple ? SPAWNERV2 : SPAWNER;
                            if (spawner.owner_id) ent.setDynamicProperty("owner_id", spawner.owner_id);
                            setupSpawnerUI(ent, key);
                        }
                    }

                    if (!spawner.nextSpawn || Date.now() >= spawner.nextSpawn) {
                        const playersNearby = dim.getPlayers({ location: loc, maxDistance: 16 });
                        if (playersNearby.length === 0) continue;

                        if (useSimple) {
                            generateAndStoreLoot(dim, spawner.mob, spawner.size, key, spawner);
                        } else {
                            const existingMobs = dim.getEntities({ type: spawner.mob, location: loc, maxDistance: 8 });
                            if (existingMobs.length > 0) {
                                const target = existingMobs[0];
                                const size = (target.getDynamicProperty("stack_size") ?? 1) + spawner.size;
                                updateMobStackDisplay(target, size);
                            } else {
                                const spawnLoc = { x: loc.x + 0.5, y: loc.y, z: loc.z + 0.5 };
                                let mob = dim.spawnEntity(spawner.mob, spawnLoc);
                                if (spawner.size > 1) updateMobStackDisplay(mob, spawner.size);
                            }
                        }

                        spawner.nextSpawn = Date.now() + 20000;
                        dataUpdated = true;
                    }
                } catch (e) { }
            }
            if (dataUpdated) saveActiveSpawners(activeSpawners);
        }
    } finally {
        isTickRunning = false;
    }
}, 2);

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity } = event;
    if (deadEntity.typeId === ENTITY_TYPE || deadEntity.typeId === ENTITY_TYPEV2) {
        const droppedItems = deadEntity.dimension.getEntities({ type: "minecraft:item", location: deadEntity.location, maxDistance: 3 });
        for (const item of droppedItems) {
            item.remove();
        }
    }
});

async function resetUi(entity) {
    if (!entity || !entity.isValid) return;
    const loc = { ...entity.location };
    entity.teleport({ x: loc.x, y: loc.y + 5, z: loc.z });
    system.run(() => entity.teleport(loc));
    await new Promise(r => system.runTimeout(r, 4));
}

async function closePlayerContainerUI(player) {
    if (!player) return;
    const currentLoc = { ...player.location };
    player.teleport({ x: currentLoc.x, y: currentLoc.y - 5, z: currentLoc.z });
    
    await new Promise(resolve => system.runTimeout(resolve, 1));
    
    player.teleport(currentLoc);
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const { target, player } = event;
    const useSimple = !!world.getDynamicProperty("simple_spawners");

    if ((target.typeId === ENTITY_TYPE && !useSimple) || (target.typeId === ENTITY_TYPEV2 && useSimple)) {
        const inUseTag = useSimple ? SPAWNER_IN_USEV2 : SPAWNER_IN_USE;
        const currentOwnerId = target.getDynamicProperty("owner_id");

        if (target.nameTag === inUseTag && currentOwnerId !== player.name) {
            let activeUser = world.getPlayers({ name: currentOwnerId })[0];
            if (activeUser && getDistanceSquared(activeUser.location, target.location) <= 25) {
                event.cancel = true;
                player.sendMessage({ rawtext: [{ translate: "spawner.message.in_use" }] });
                return;
            }
        }

        let key = "";
        const tag = target.getTags().find(t => t.startsWith("spawner_"));
        if (tag) {
            const parts = tag.split("_");
            key = `${parts[1]},${parts[2]},${parts[3]},${target.dimension.id}`;
        }

        const activeSpawners = getActiveSpawners();
        const dbSpawner = activeSpawners[key];
        const trueOwner = dbSpawner ? dbSpawner.owner_id : currentOwnerId;

        if ((trueOwner && trueOwner !== player.name && !H.isOp(player)) && world.getDynamicProperty("protectedspawner")) {
            event.cancel = true;
            player.sendMessage({ rawtext: [{ translate: "spawner.message.protected" }] });
            return;
        }

        if (player.isSneaking && dbSpawner) {
            const equipment = player.getComponent("minecraft:equippable");
            const mainhandSlot = equipment?.getEquipmentSlot(EquipmentSlot.Mainhand);
            const item = mainhandSlot?.getItem();

            if (item && item.typeId === "sh:mob_spawner" && item.getLore()?.[0] === dbSpawner.mob) {
                event.cancel = true;

                const maxStack = world.getDynamicProperty("maxspawnerstack") ?? 999;
                const spaceLeft = maxStack - dbSpawner.size;

                if (spaceLeft > 0) {
                    const amountToAdd = Math.min(spaceLeft, item.amount);

                    system.run(() => {
                        const freshData = getActiveSpawners();
                        if (freshData[key]) {
                            freshData[key].size += amountToAdd;
                            saveActiveSpawners(freshData);
                        }

                        if (amountToAdd === item.amount) {
                            mainhandSlot.setItem(undefined);
                        } else {
                            item.amount -= amountToAdd;
                            mainhandSlot.setItem(item);
                        }

                        player.playSound("random.levelup");
                        player.sendMessage({ rawtext: [{ translate: "spawner.message.added", with: [amountToAdd.toString()] }] });
                    });
                } else {
                    system.run(() => {
                        player.sendMessage({ rawtext: [{ translate: "spawner.message.full" }] });
                    });
                }
                return;
            }
        }

        system.run(() => {
            if (!target.isValid) return;
            target.nameTag = inUseTag;
            target.setDynamicProperty("owner_id", player.name);
            target.setDynamicProperty("current_page", 0);
            setupSpawnerUI(target, key);
        });
    }
});

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
    const { player, block } = event;
    const item = player.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand).getItem();

    if (!item || item.typeId !== "sh:mob_spawner" || !item.getLore()?.length) return;

    const mobType = item.getLore()[0];
    const currentPos = block.location;
    const currentDim = block.dimension.id;
    const activeSpawners = getActiveSpawners();

    let sameTypeNearbyCount = 0;

    for (const key in activeSpawners) {
        const spawner = activeSpawners[key];
        if (spawner.dimension === currentDim && spawner.mob === mobType) {
            if (getDistanceSquared(spawner.location, currentPos) <= 256) sameTypeNearbyCount++;
        }
    }

    if (sameTypeNearbyCount >= 1) {
        event.cancel = true;
        system.run(() => player.sendMessage({ rawtext: [{ translate: "spawner.message.limit" }] }));
        return;
    }

    const { x, y, z } = block.location;
    const key = `${x},${y},${z},${currentDim}`;
    const useSimple = !!world.getDynamicProperty("simple_spawners");

    system.run(() => {
        const freshData = getActiveSpawners();
        freshData[key] = { mob: mobType, location: { x, y, z }, dimension: currentDim, size: 1, owner_id: player.name };
        saveActiveSpawners(freshData);

        const targetType = useSimple ? ENTITY_TYPEV2 : ENTITY_TYPE;
        let entity = block.dimension.spawnEntity(targetType, { x: x + 0.5, y: y, z: z + 0.5 });
        entity.addTag(`spawner_${x}_${y}_${z}`);
        entity.nameTag = useSimple ? SPAWNERV2 : SPAWNER;
        entity.setDynamicProperty("owner_id", player.name);
    });
});

async function showAddSpawnerUI(player, key, mobType, entity) {
    entity.setDynamicProperty("busy", true);
    
    await closePlayerContainerUI(player);
    await resetUi(player);

    system.run(() => {
        const maxStack = world.getDynamicProperty("maxspawnerstack") ?? 999;
        const available = processInventorySpawners(player, mobType, 0);
        const data = getActiveSpawners();
        const currentSize = data[key]?.size ?? 0;

        const title = { rawtext: [{ text: H.customUi() }, { translate: "spawner.ui.stack.title" }] };
        const label = { rawtext: [
            { translate: "spawner.ui.label.current" },
            { text: `§e${currentSize}/${maxStack}\n` },
            { translate: "spawner.ui.label.available" },
            { text: `§b${available}x\n\n` },
            { translate: "spawner.ui.label.amount" }
        ]};

        const form = new ModalFormData().title(title).textField(label, "1");

        form.show(player).then(response => {
            entity.setDynamicProperty("busy", false);
            if (response.canceled) return;
            let amount = parseInt(response.formValues[0]);
            if (amount + currentSize > maxStack) return player.sendMessage({ rawtext: [{ translate: "spawner.message.max_stack", with: [maxStack.toString()] }] });
            if (isNaN(amount) || amount <= 0 || available < amount) return;

            processInventorySpawners(player, mobType, amount);
            const freshData = getActiveSpawners();
            if (freshData[key]) {
                freshData[key].size += amount;
                saveActiveSpawners(freshData);
                player.playSound("random.levelup");
            }
        });
    });
}

async function showRemoveSpawnerUI(player, key, mobType, entity) {
    entity.setDynamicProperty("busy", true);

    await closePlayerContainerUI(player);
    await resetUi(player);

    system.run(async () => {
        const data = getActiveSpawners();
        if (!data[key]) { entity.setDynamicProperty("busy", false); return; }

        const title = { rawtext: [{ text: H.customUi() }, { translate: "spawner.ui.unstack.title" }] };
        const label = { rawtext: [
            { translate: "spawner.ui.label.current" },
            { text: `§e${data[key].size}\n\n` },
            { translate: "spawner.ui.label.amount" }
        ]};

        const form = new ModalFormData().title(title).textField(label, "1");

        const response = await form.show(player);
        entity.setDynamicProperty("busy", false);
        if (response.canceled) return;

        const amount = parseInt(response.formValues[0]) || 0;
        if (amount <= 0 || amount > data[key].size) return;

        let remainingToGive = amount;
        while (remainingToGive > 0) {
            const giveAmount = Math.min(remainingToGive, 64);
            const itemStack = new ItemStack("sh:mob_spawner", giveAmount);
            itemStack.setLore([mobType]);
            giveOrDropItem(player, itemStack);
            remainingToGive -= giveAmount;
        }

        const fresh = getActiveSpawners();
        if (amount === fresh[key].size) {
            const loc = fresh[key].location;
            const dim = world.getDimension(fresh[key].dimension);
            const isSimple = !!world.getDynamicProperty("simple_spawners");
            if (isSimple) {
                const allItems = getLargeData(`spawner_inv_${key}`);
                if (allItems) {
                    for (const itemData of allItems) {
                        const stack = createItemFromData(itemData);
                        if (stack) giveOrDropItem(player, stack);
                    }
                    setLargeData(`spawner_inv_${key}`, null);
                }
            }
            delete fresh[key];
            saveActiveSpawners(fresh);
            dim.setBlockType(loc, "minecraft:air");
            if (entity.isValid) entity.remove();
        } else {
            fresh[key].size -= amount;
            saveActiveSpawners(fresh);
        }
    });
}

function processInventorySpawners(player, mobType, amount = 0) {
    const inv = player.getComponent("inventory").container;
    let count = 0; let remaining = amount;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (!item || item.typeId !== "sh:mob_spawner") continue;
        if (item.getLore()?.[0] === mobType) {
            if (amount === 0) count += item.amount;
            else if (remaining > 0) {
                const take = Math.min(item.amount, remaining);
                if (item.amount === take) inv.setItem(i, undefined);
                else { item.amount -= take; inv.setItem(i, item); }
                remaining -= take; count += take;
            }
        }
    }
    return count;
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    const { hitEntity, damagingEntity } = event;
    if (damagingEntity?.typeId !== "minecraft:player") return;

    const useSimple = !!world.getDynamicProperty("simple_spawners");

    if (hitEntity.typeId === ENTITY_TYPE || hitEntity.typeId === ENTITY_TYPEV2) {
        let key = "";
        const tag = hitEntity.getTags().find(t => t.startsWith("spawner_"));

        if (!tag) {
            if (hitEntity.isValid) hitEntity.remove();
            return;
        }

        const parts = tag.split("_");
        key = `${parts[1]},${parts[2]},${parts[3]},${hitEntity.dimension.id}`;

        const activeSpawners = getActiveSpawners();
        const spawnerData = activeSpawners[key];

        if (!spawnerData) {
            if (hitEntity.isValid) hitEntity.remove();
            return;
        }

        if (spawnerData.size > 1) {
            damagingEntity.sendMessage({ rawtext: [{ translate: "spawner.message.multiple" }] });
        } else if (spawnerData.size === 1) {
            const loc = spawnerData.location;
            const dim = world.getDimension(spawnerData.dimension);

            const itemStack = new ItemStack("sh:mob_spawner", 1);
            itemStack.setLore([spawnerData.mob]);
            giveOrDropItem(damagingEntity, itemStack);

            if (useSimple) {
                const allItems = getLargeData(`spawner_inv_${key}`);
                if (allItems) {
                    for (const itemData of allItems) {
                        const stack = createItemFromData(itemData);
                        if (stack) giveOrDropItem(damagingEntity, stack);
                    }
                    setLargeData(`spawner_inv_${key}`, null);
                }
            }

            delete activeSpawners[key];
            saveActiveSpawners(activeSpawners);

            try { dim.setBlockType(loc, "minecraft:air"); } catch (e) { }
            if (hitEntity.isValid) hitEntity.remove();
        }
    }
});