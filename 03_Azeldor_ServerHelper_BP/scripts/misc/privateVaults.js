import { world, system, ItemStack, EnchantmentTypes, Potions } from "@minecraft/server";
import * as H from "../general/helpers";

const ENTITY_ID = "sh:pv";
const TITLE_IDLE = "§l§2Private Vault§r\n§5Removing in:§r 5s";
const TITLE_IN_USE = "§l§2Private Vault§r\n§2§lIN USE";
const UI_LORE = "ui_item";

function ui_item(item) {
    if (!item) return false;
    const lore = item.getLore();
    return lore.length > 0 && lore.some(l => l.startsWith(UI_LORE));
}

function purgeIllegalItems(player) {
    const cursor = player.getComponent("cursor_inventory");
    if (cursor?.item && ui_item(cursor.item)) {
        cursor.clear();
    }

    const inv = player.getComponent("inventory")?.container;
    if (!inv) return;
    
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (item && ui_item(item)) {
            inv.setItem(i, undefined);
        }
    }
}

async function resetInteraction(entity) {
    if (!entity.isValid) return;
    const loc = { ...entity.location };
    entity.teleport({ x: loc.x, y: loc.y + 5, z: loc.z });
    system.runTimeout(() => {
        if (entity.isValid) entity.teleport(loc);
    }, 1);
}

function getDistance(loc1, loc2) {
    return Math.hypot(loc1.x - loc2.x, loc1.y - loc2.y, loc1.z - loc2.z);
}

function getPageDigits(page) {
    const displayNum = (page + 1).toString().padStart(2, "0");
    const d1 = new ItemStack(`sh:ui_num${displayNum[0]}`);
    const d2 = new ItemStack(`sh:ui_num${displayNum[1]}`);
    d1.setLore([UI_LORE]);
    d2.setLore([UI_LORE]);
    return [d1, d2];
}

function createItemFromData(info) {
    if (!info) return undefined;
    let stack;

    if (info.potion) {
        try {
            const effectType = Potions.getAllEffectTypes().find(e => e.id === info.potion);
            const deliveryType = Potions.getAllDeliveryTypes().find(d => d.id === info.delivery);
            if (effectType && deliveryType) {
                stack = Potions.resolve(effectType, deliveryType);
            }
        } catch (e) { }
    }

    if (!stack && info.typeId) {
        try {
            stack = new ItemStack(info.typeId, info.amount || 1);
        } catch (e) { return undefined; }
    }

    if (stack) {
        stack.amount = info.amount || 1;

        if (info.enchants) {
            const enchantable = stack.getComponent("minecraft:enchantable");
            if (enchantable) {
                for (const [id, level] of Object.entries(info.enchants)) {
                    const type = EnchantmentTypes.get(id);
                    if (type) enchantable.addEnchantment({ type, level });
                }
            }
        }

        if (info.nameTag) stack.nameTag = info.nameTag;

        if (info.lore) {
            const arr = Array.isArray(info.lore) ? info.lore : [info.lore];
            const cleanLore = arr.filter(l => !l.startsWith(UI_LORE));
            if (cleanLore.length > 0) stack.setLore(cleanLore);
        }
    }

    return stack;
}

function setupAuctionHouseSlots(entity) {
    if (!entity.isValid) return;
    const container = entity.getComponent("inventory")?.container;
    if (!container) return;

    const page = entity.getDynamicProperty("current_page") ?? 0;
    const ownerId = entity.getDynamicProperty("owner_id");
    const player = world.getEntity(ownerId);
    if (!player) return;

    container.clearAll();

    const startIndex = page * 54;
    const allItems = getLargeData(player, "pv_items");
    if (allItems) {
        try {
            for (let i = 0; i < 54; i++) {
                const itemData = allItems[startIndex + i];
                if (itemData) {
                    const itemStack = createItemFromData(itemData);
                    if (itemStack) container.setItem(i, itemStack);
                }
            }
        } catch (e) { }
    }

    const setBtn = (slot, name, typeId) => {
        const item = new ItemStack(typeId);
        item.nameTag = `§r§l${name}`;
        item.setLore([UI_LORE]);
        container.setItem(slot, item);
    };

    setBtn(54, "§6Previous", "sh:previous_page");
    setBtn(55, "§dNext", "sh:next_page");

    const [d1, d2] = getPageDigits(page);
    container.setItem(56, d1);
    container.setItem(57, d2);
}

function handleAHClick(entity, player, slotIndex) {
    const currentPage = entity.getDynamicProperty("current_page") ?? 0;

    if (slotIndex === 54 && currentPage > 0) {
        entity.setDynamicProperty("current_page", currentPage - 1);
        player.playSound("random.click");
    } else if (slotIndex === 55 && currentPage < (world.getDynamicProperty("pv_amount") ?? 1) - 1) {
        entity.setDynamicProperty("current_page", currentPage + 1);
        player.playSound("random.click");
    }

    setupAuctionHouseSlots(entity);
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;
        let entities;
        try {
            entities = player.dimension.getEntities({ type: ENTITY_ID, location: player.location, maxDistance: 8 });
        } catch (e) { continue; }

        for (const ent of entities) {
            if (!ent.isValid) continue;
            const ownerId = ent.getDynamicProperty("owner_id");
            if (ownerId !== player.id) continue;

            if (getDistance(player.location, ent.location) > 5) {
                saveVaultItems(ent, player);
                ent.remove();
                continue;
            }

            if (ent.nameTag !== TITLE_IN_USE) continue;

            const container = ent.getComponent("inventory")?.container;
            if (!container) continue;

            purgeIllegalItems(player);

            for (let i = 0; i <= 57; i++) {
                const item = container.getItem(i);

                if (i < 54) {
                    if (item && ui_item(item)) {
                        container.setItem(i, undefined);
                        setupAuctionHouseSlots(ent);
                        break;
                    }
                } else {
                    if (!item) {
                        saveVaultItems(ent, player);
                        handleAHClick(ent, player, i);
                        break;
                    }
                    if (item && !ui_item(item)) {
                        player.getComponent("inventory")?.container?.addItem(item);
                        container.setItem(i, undefined);
                        setupAuctionHouseSlots(ent);
                        break;
                    }
                }
            }
        }
    }
}, 2);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;
        let entities;
        try {
            entities = player.dimension.getEntities({ type: ENTITY_ID, location: player.location, maxDistance: 8 });
        } catch (e) { continue; }
        for (const ent of entities) {
            if (ent.isValid && ent.nameTag === TITLE_IN_USE && ent.getDynamicProperty("owner_id") === player.id) {
                saveVaultItems(ent, player);
            }
        }
    }
}, 20);

system.runInterval(() => {
    for (const dimId of ["overworld", "nether", "the_end"]) {
        let entities;
        try {
            entities = world.getDimension(dimId).getEntities({ type: ENTITY_ID });
        } catch (e) { continue; }
        for (const ent of entities) {
            if (!ent.isValid) continue;
            const ownerId = ent.getDynamicProperty("owner_id");
            const owner = ownerId ? world.getEntity(ownerId) : undefined;
            if (!owner || !owner.isValid || getDistance(owner.location, ent.location) > 5) {
                if (owner?.isValid) saveVaultItems(ent, owner);
                ent.remove();
            }
        }
    }
}, 100);

function getLargeData(player, baseKey) {
    let fullString = "";
    let index = 0;
    while (true) {
        const chunk = player.getDynamicProperty(`${baseKey}_${index}`);
        if (chunk === undefined) break;
        fullString += chunk;
        index++;
    }
    if (fullString === "") return null;
    try { return JSON.parse(fullString); } catch { return null; }
}

function setLargeData(player, baseKey, value) {
    const fullString = JSON.stringify(value);
    const CHUNK_SIZE = 8000;
    let index = 0;

    while (player.getDynamicProperty(`${baseKey}_${index}`) !== undefined) {
        player.setDynamicProperty(`${baseKey}_${index}`, undefined);
        index++;
    }

    for (let i = 0; i < fullString.length; i += CHUNK_SIZE) {
        const chunk = fullString.substring(i, i + CHUNK_SIZE);
        player.setDynamicProperty(`${baseKey}_${Math.floor(i / CHUNK_SIZE)}`, chunk);
    }
}

function saveVaultItems(entity, player) {
    if (!entity.isValid) return;
    const container = entity.getComponent("inventory")?.container;
    if (!container) return;
    
    const page = entity.getDynamicProperty("current_page") ?? 0;
    let allItems = getLargeData(player, "pv_items") ?? [];
    const startIndex = page * 54;
    let changes = false;

    for (let i = 0; i < 54; i++) {
        const item = container.getItem(i);
        const storageIndex = startIndex + i;

        if (item && !ui_item(item)) {
            if (item.typeId.includes("shulker_box")) {
                const pInv = player.getComponent("inventory")?.container;
                if (pInv) {
                    const leftover = pInv.addItem(item);
                    if (leftover) {
                        player.dimension.spawnItem(leftover, player.location);
                    }
                }
                container.setItem(i, undefined);
                player.sendMessage({ rawtext: [{ translate: "message.pv.shulker_denied" }] });
                H.playDenied(player);
                
                if (allItems[storageIndex]) {
                    allItems[storageIndex] = null;
                    changes = true;
                }
                continue;
            }

            const itemData = {
                typeId: item.typeId,
                amount: item.amount,
                nameTag: item.nameTag
            };

            const lore = item.getLore();
            if (lore && lore.length > 0) {
                const cleanLore = lore.filter(l => !l.startsWith(UI_LORE));
                if (cleanLore.length > 0) itemData.lore = cleanLore;
            }

            const enchantable = item.getComponent("minecraft:enchantable");
            if (enchantable) {
                const enchants = enchantable.getEnchantments();
                if (enchants.length > 0) {
                    itemData.enchants = {};
                    enchants.forEach(e => { itemData.enchants[e.type.id] = e.level; });
                }
            }

            const potionComp = item.getComponent("minecraft:potion");
            if (potionComp) {
                itemData.potion = potionComp.potionEffectType?.id;
                itemData.delivery = potionComp.potionDeliveryType?.id;
            }

            if (!allItems[storageIndex] || JSON.stringify(allItems[storageIndex]) !== JSON.stringify(itemData)) {
                allItems[storageIndex] = itemData;
                changes = true;
            }
        } else if (allItems[storageIndex]) {
            allItems[storageIndex] = null;
            changes = true;
        }
    }

    if (changes) {
        setLargeData(player, "pv_items", allItems);
    }
}

world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId !== "sh:pv") return;
    const player = ev.source;

    if (!world.getDynamicProperty("pv")) {
        player.sendMessage({ rawtext: [{ translate: "message.pv.disabled" }] });
        H.playDenied(player);
        return;
    }

    const existing = player.dimension.getEntities({ type: ENTITY_ID });
    if (existing.some(ent => ent.isValid && ent.getDynamicProperty("owner_id") === player.id)) {
        ev.cancel = true;
        system.run(() => {
            player.sendMessage({ rawtext: [{ translate: "message.pv.already_active" }] });
            H.playDenied(player);
        });
        return;
    }

    ev.cancel = true;

    system.run(() => {
        let ent;
        const rayHit = player.dimension.getBlockFromRay(player.getHeadLocation(), player.getViewDirection(), {
            maxDistance: 8,
            includePassableBlocks: true,
            includeLiquidBlocks: false
        });

        if (!rayHit) {
            ent = player.dimension.spawnEntity(ENTITY_ID, player.location);
        } else {
            const block = rayHit.block;
            let spawnX = block.location.x + 0.5;
            let spawnY = block.location.y - 1;
            let spawnZ = block.location.z + 0.5;

            switch (rayHit.face) {
                case "East": spawnX += 1; break;
                case "Up": spawnY += 2; break;
                case "South": spawnZ += 1; break;
                case "West": spawnX -= 1; break;
                case "Down": spawnY -= 1; break;
                case "North": spawnZ -= 1; break;
            }

            ent = player.dimension.spawnEntity(ENTITY_ID, { x: spawnX, y: spawnY, z: spawnZ });
        }
        
        ent.teleport(ent.location, { facingLocation: player.location });
        ent.nameTag = TITLE_IDLE;
        ent.setDynamicProperty("owner_id", player.id);
        ent.setDynamicProperty("current_page", 0);
        ent.setDynamicProperty("cat_index", 0);
        ent.setDynamicProperty("sort_index", 0);
        ent.setDynamicProperty("view_mode", 0);

        system.runTimeout(() => {
            if (ent.isValid && ent.nameTag === TITLE_IDLE) ent.remove();
        }, 100);
    });
});

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { target, player } = event;
    if (target.typeId === ENTITY_ID) {
        if (player.id != target.getDynamicProperty("owner_id")) {
            player.sendMessage({ rawtext: [{ translate: "message.pv.not_yours" }] });
            H.playDenied(player);
            resetInteraction(player);
            return;
        }
        target.nameTag = TITLE_IN_USE;
        setupAuctionHouseSlots(target);
    }
});