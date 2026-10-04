import { world, system, ItemStack, EnchantmentTypes, Potions } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers"

const ENTITY_ID = "sh:auction_house_ent";
const TITLE_IDLE = "§l§6Auction House§r\n§5Removing in:§r 5s";
const TITLE_IN_USE = "§l§6Auction House§r\n§2§lIN USE";
const UI_LORE = "ui_item";

const CATEGORIES = [
    { id: "ah_all", name: "All" },
    { id: "ah_blocks", name: "Blocks" },
    { id: "ah_tools", name: "Tools" },
    { id: "ah_armor", name: "Armor" },
    { id: "ah_consumables", name: "Consumables" },
    { id: "ah_misc", name: "Misc" },
    { id: "ah_modded", name: "Modded" }
];

const SORT_MODES = ["High to Low", "Low to High", "Newest", "Oldest"];
const SORT_ITEM_IDS = ["sh:high_to_low", "sh:low_to_high", "sh:newest", "sh:oldest"];

const stripCodes = (str) => str.replace(/§[0-9a-fk-or]/gi, "");

const TITLE_PERMANENT = "§l§6Auction House§r\n§eTap to browse";

function resetPermanentMarket(ent) {
    ent.setDynamicProperty("owner_id", undefined);
    ent.setDynamicProperty("view_mode", 0);
    ent.setDynamicProperty("current_page", 0);
    ent.setDynamicProperty("search_query", "");
    ent.nameTag = TITLE_PERMANENT;
    ent.getComponent("inventory").container.clearAll();
}

function getCategoryItems(categoryKey) {
    let items = [];
    const stored = H.getData(categoryKey);
    for (const id in stored) {
        items.push(stored[id]);
    }
    return items;
}

function sleep(ticks) {
    return new Promise((resolve) => {
        system.runTimeout(resolve, ticks);
    });
}

async function resetInteraction(entity) {
    if (!entity.isValid) {
        return;
    }
    const loc = { ...entity.location };
    entity.teleport({ x: loc.x, y: loc.y + 99, z: loc.z });
    entity.teleport(loc);
    await sleep(4);
}

function getDistance(loc1, loc2) {
    return Math.sqrt(Math.pow(loc1.x - loc2.x, 2) + Math.pow(loc1.y - loc2.y, 2) + Math.pow(loc1.z - loc2.z, 2));
}

function ui_item(item) {
    if (!item) return false;
    const lore = item.getLore();
    return lore.length > 0 && lore.includes(UI_LORE);
}

function getPageDigits(page) {
    const displayNum = (page + 1).toString().padStart(2, "0");
    const d1 = new ItemStack(`sh:ui_num${displayNum[0]}`);
    const d2 = new ItemStack(`sh:ui_num${displayNum[1]}`);
    d1.setLore([UI_LORE]);
    d2.setLore([UI_LORE]);
    return [d1, d2];
}

function purgeIllegalItems(player) {
    let purged = false;
    const cursor = player.getComponent("cursor_inventory");
    if (cursor.item && ui_item(cursor.item)) {
        cursor.clear();
        purged = true;
    }

    const inv = player.getComponent("inventory").container;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (item && ui_item(item)) {
            inv.setItem(i, undefined);
            purged = true;
        }
    }
}

function getEnabledCategories() {
    const showModded = world.getDynamicProperty("ahModItems") ?? true;
    return CATEGORIES.filter(cat => !(cat.id === "ah_modded" && showModded === false));
}

function formatTimeLeft(expiry) {
    const diff = expiry - Date.now();
    if (diff <= 0) return "§cExpired";
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

function formatPrice(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
}

function deleteListing(categoryKey, listingId) {
    const db = H.getData(categoryKey);
    if (db[listingId]) {
        delete db[listingId];
        H.setData(categoryKey, db);
    }
}

function createItemFromData(info) {
    if (!info) return undefined;
    let stack;

    if (info.potion) {
        try {
            const allEffects = Potions.getAllEffectTypes();
            const allDeliveries = Potions.getAllDeliveryTypes();

            const searchEffect = info.potion.toLowerCase().replace("minecraft:", "");
            const searchDelivery = (info.delivery || "Consume").toLowerCase().replace("minecraft:", "");

            const effectType = allEffects.find(e => e.id.toLowerCase().includes(searchEffect));
            const deliveryType = allDeliveries.find(d => d.id.toLowerCase().includes(searchDelivery));

            if (effectType && deliveryType) {
                stack = Potions.resolve(effectType, deliveryType);
            }
        } catch (e) {
        }
    }

    if (!stack && info.typeId) {
        try {
            stack = new ItemStack(info.typeId, info.amount || 1);
        } catch (e) {
            return undefined;
        }
    }

    if (stack) {
        stack.amount = info.amount || 1;
        if (info.name) stack.nameTag = info.name;

        if (info.enchants) {
            const enchantable = stack.getComponent("minecraft:enchantable");
            if (enchantable) {
                for (const [id, level] of Object.entries(info.enchants)) {
                    const type = EnchantmentTypes.get(id);
                    if (type) {
                        try {
                            enchantable.addEnchantment({ type, level });
                        } catch (e) {
                        }
                    }
                }
            }
        }
    }
    return stack;
}

function giveOrDropItem(player, itemData) {
    const container = player.getComponent("inventory").container;
    const itemStack = createItemFromData(itemData);
    if (!itemStack) {
        return;
    }

    if (itemData.lore) {
        let cleanLore = [];
        if (Array.isArray(itemData.lore)) {
            cleanLore = itemData.lore.filter(l => !l.startsWith(UI_LORE));
        } else if (typeof itemData.lore === 'string') {
            cleanLore = [itemData.lore].filter(l => !l.startsWith(UI_LORE));
        }
        if (cleanLore.length > 0) itemStack.setLore(cleanLore);
    }

    const leftover = container.addItem(itemStack);
    if (leftover) {
        player.dimension.spawnItem(leftover, player.location);
    }
}

function formatEnchantName(id) {
    const name = id.split(":")[1] || id;
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function showSearchMenu(player, entity) {
    await resetInteraction(entity);
    const currentQuery = entity.getDynamicProperty("search_query") ?? "";
    const currentType = entity.getDynamicProperty("search_type") ?? 0;

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.ah.search.title" }] })
        .dropdown({ rawtext: [{ translate: "ui.ah.search.dropdown" }] }, [
            { rawtext: [{ translate: "ui.ah.search.option.item" }] },
            { rawtext: [{ translate: "ui.ah.search.option.seller" }] }
        ], { defaultValueIndex: currentType })
        .textField(
            { rawtext: [{ translate: "ui.ah.search.keywords" }] },
            { rawtext: [{ translate: "ui.ah.search.placeholder" }] },
            { defaultValue: currentQuery }
        );

    const response = await form.show(player);
    if (response.canceled) {
        return;
    }

    const [type, query] = response.formValues;
    entity.setDynamicProperty("search_type", type);
    entity.setDynamicProperty("search_query", query || "");
    entity.setDynamicProperty("current_page", 0);

    setupAuctionHouseSlots(entity);
    player.playSound("random.orb");
}

function handleAHClick(entity, player, slotIndex) {
    const currentPage = entity.getDynamicProperty("current_page") ?? 0;
    const viewMode = entity.getDynamicProperty("view_mode") ?? 0;
    let currentCatIdx = entity.getDynamicProperty("cat_index") ?? 0;

    const enabledCats = getEnabledCategories();
    if (currentCatIdx >= enabledCats.length) {
        currentCatIdx = 0;
        entity.setDynamicProperty("cat_index", 0);
    }

    const activeCategoryKey = enabledCats[currentCatIdx]?.id || CATEGORIES[0].id;

    if (slotIndex >= 0 && slotIndex <= 47) {
        const items = getFilteredAndSortedItems(entity, player);
        const itemData = items[currentPage * 48 + slotIndex];

        if (!itemData) {
            return;
        }

        const targetCategory = itemData.category || activeCategoryKey;

        if (viewMode === 1) {
            if (itemData.sellerId !== player.id) return;
            if (itemData.sold) {
                const objective = world.scoreboard.getObjective(itemData.currencyId);
                if (objective) objective.addScore(player, itemData.price);
                deleteListing(targetCategory, itemData.id);
                player.sendMessage({ rawtext: [{ translate: 'message.ah.claimed', with: [formatPrice(itemData.price), itemData.currencyId] }] });
                player.playSound("random.levelup");
            } else {
                giveOrDropItem(player, itemData);
                deleteListing(targetCategory, itemData.id);
                player.sendMessage({ rawtext: [{ translate: 'message.ah.reclaimed' }] });
                player.playSound("random.pop");
            }
        }
        else {
            if (itemData.sellerId === player.id) {
                player.sendMessage({ rawtext: [{ translate: 'message.ah.own_listing' }] });
                return;
            }

            const objective = world.scoreboard.getObjective(itemData.currencyId);
            if (!objective) {
                return player.sendMessage({ rawtext: [{ translate: 'message.ah.currency_error' }] });
            }

            let balance = 0;
            try { balance = objective.getScore(player) ?? 0; } catch (e) { balance = 0; }

            if (balance < itemData.price) {
                return player.sendMessage({ rawtext: [{ translate: 'message.error.insufficient_funds' }] });
            }

            objective.addScore(player, -itemData.price);
            const db = H.getData(targetCategory);
            if (db[itemData.id]) {
                db[itemData.id].sold = true;
                db[itemData.id].category = targetCategory;
                H.setData(targetCategory, db);
            }

            giveOrDropItem(player, itemData);
            player.sendMessage({ rawtext: [{ translate: 'message.ah.purchased', with: [itemData.name || itemData.typeId, formatPrice(itemData.price), itemData.currencyId] }] });
            player.playSound("random.levelup");
        }
        setupAuctionHouseSlots(entity);
        return;
    }

    switch (slotIndex) {
        case 48:
            entity.setDynamicProperty("view_mode", viewMode === 0 ? 1 : 0);
            entity.setDynamicProperty("current_page", 0);
            player.playSound("random.click");
            break;
        case 49:
            const nextIdx = (currentCatIdx + 1) % enabledCats.length;
            entity.setDynamicProperty("cat_index", nextIdx);
            entity.setDynamicProperty("current_page", 0);
            player.playSound("random.click");
            break;
        case 50:
            showSearchMenu(player, entity);
            break;
        case 51:
            const nextSort = ((entity.getDynamicProperty("sort_index") ?? 0) + 1) % SORT_MODES.length;
            entity.setDynamicProperty("sort_index", nextSort);
            player.playSound("random.click");
            break;
        case 54:
            if (currentPage > 0) {
                entity.setDynamicProperty("current_page", currentPage - 1);
                player.playSound("random.click");
            }
            break;
        case 55:
            const total = getFilteredAndSortedItems(entity, player).length;
            if (total > (currentPage + 1) * 48) {
                entity.setDynamicProperty("current_page", currentPage + 1);
                player.playSound("random.click");
            }
            break;
    }
}

function getFilteredAndSortedItems(entity, player) {
    const catIdx = entity.getDynamicProperty("cat_index") ?? 0;
    const sortIdx = entity.getDynamicProperty("sort_index") ?? 0;
    const viewMode = entity.getDynamicProperty("view_mode") ?? 0;
    const searchQuery = entity.getDynamicProperty("search_query")?.toLowerCase() || "";
    const searchType = entity.getDynamicProperty("search_type") ?? 0;

    const enabledCats = getEnabledCategories();
    const safeIdx = (catIdx >= enabledCats.length) ? 0 : catIdx;
    const catId = enabledCats[safeIdx].id;
    const now = Date.now();

    let rawItems = [];
    if (catId === "ah_all") {
        for (const cat of enabledCats) {
            if (cat.id === "ah_all") continue;
            const catItems = getCategoryItems(cat.id);
            catItems.forEach(i => i.category = cat.id);
            rawItems.push(...catItems);
        }
    } else {
        rawItems = getCategoryItems(catId);
    }

    let items = [...rawItems];
    if (viewMode === 1) {
        items = items.filter(i => i.sellerId === player.id);
    } else {
        items = items.filter(i => !i.sold && i.expiry > now);
    }

    if (searchQuery) {
        if (searchType === 0) {
            items = items.filter(i => {
                const fallbackName = i.typeId.includes(":")
                    ? i.typeId.split(":")[1].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
                    : i.typeId;

                const displayName = i.name || fallbackName;

                let loreText = "";
                if (i.lore) {
                    if (Array.isArray(i.lore)) {
                        loreText = i.lore.filter(l => !l.startsWith(UI_LORE)).join(" ").toLowerCase();
                    } else if (typeof i.lore === 'string') {
                        loreText = i.lore.toLowerCase();
                    }
                }

                return stripCodes(displayName).toLowerCase().includes(searchQuery) || stripCodes(loreText).includes(searchQuery);
            });
        } else {
            items = items.filter(i => (i.seller || "").toLowerCase().includes(searchQuery));
        }
    }

    items.sort((a, b) => {
        if (sortIdx === 0) return b.price - a.price;
        if (sortIdx === 1) return a.price - b.price;
        if (sortIdx === 2) return b.expiry - a.expiry;
        return a.expiry - b.expiry;
    });

    return items;
}

function setupAuctionHouseSlots(entity) {
    if (!entity.isValid) {
        return;
    }
    const container = entity.getComponent("inventory").container;
    const page = entity.getDynamicProperty("current_page") ?? 0;
    const catIdx = entity.getDynamicProperty("cat_index") ?? 0;
    const sortIdx = entity.getDynamicProperty("sort_index") ?? 0;
    const viewMode = entity.getDynamicProperty("view_mode") ?? 0;
    const ownerId = entity.getDynamicProperty("owner_id");
    const player = world.getEntity(ownerId);

    if (!player) {
        return;
    }

    const searchQuery = entity.getDynamicProperty("search_query") || "None";
    const searchType = entity.getDynamicProperty("search_type") ?? 0;
    const searchTypeStr = searchType === 0 ? "Name" : "Seller";

    const enabledCats = getEnabledCategories();
    const safeIdx = catIdx >= enabledCats.length ? 0 : catIdx;
    const listingsIcon = viewMode === 0 ? "sh:all_listings" : "sh:my_listings";

    container.clearAll();

    const setBtn = (slot, name, typeId) => {
        const item = new ItemStack(typeId);
        item.nameTag = `§r§l${name}`;
        item.setLore([UI_LORE]);
        container.setItem(slot, item);
    };

    setBtn(48, viewMode === 0 ? "§cView: §fAll Items" : "§6View: §fMy Listings", listingsIcon);
    setBtn(49, `§aCategory: §f${enabledCats[safeIdx].name}`, "sh:category");
    setBtn(50, `§eSearch (${searchTypeStr}): §f${searchQuery}`, "sh:search");
    setBtn(51, `§bSort: §f${SORT_MODES[sortIdx]}`, SORT_ITEM_IDS[sortIdx]);
    setBtn(54, "§6Previous", "sh:previous_page");
    setBtn(55, "§dNext", "sh:next_page");

    const [d1, d2] = getPageDigits(page);
    container.setItem(56, d1);
    container.setItem(57, d2);
    refreshAuctionGrid(entity);
}

function refreshAuctionGrid(entity) {
    const container = entity.getComponent("inventory").container;
    const page = entity.getDynamicProperty("current_page") ?? 0;
    const ownerId = entity.getDynamicProperty("owner_id");
    const player = world.getEntity(ownerId);
    if (!player) return;

    const items = getFilteredAndSortedItems(entity, player);
    const startIdx = page * 48;
    const now = Date.now();

    let itemsShown = 0;

    for (let i = 0; i < 48; i++) {
        const data = items[startIdx + i];
        if (data) {
            itemsShown++;
            const item = createItemFromData(data);
            if (!item) continue;

            const isMine = data.sellerId === player.id;

            const lore = [
                UI_LORE,
                `§7Quantity: §f${data.amount}`,
                `§8Seller: §b${data.seller || "Unknown"}`
            ];

            if (data.lore) {
                let cleanLore = [];
                if (Array.isArray(data.lore)) {
                    cleanLore = data.lore.filter(l => !l.startsWith(UI_LORE));
                } else if (typeof data.lore === 'string') {
                    cleanLore = [data.lore].filter(l => !l.startsWith(UI_LORE));
                }
                if (cleanLore.length > 0) {
                    lore.push("");
                    lore.push(...cleanLore);
                }
            }

            if (data.enchants && Object.keys(data.enchants).length > 0) {
                lore.push("");
                for (const [id, level] of Object.entries(data.enchants)) {
                    lore.push(`§b${formatEnchantName(id)} ${level}`);
                }
            }

            const fallbackName = data.typeId.includes(":")
                ? data.typeId.split(":")[1].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
                : data.typeId;

            const displayName = data.name || fallbackName;

            if (isMine) {
                if (data.sold) {
                    item.nameTag = `§a§l[SOLD] §r${displayName}`;
                    lore.push(`§eClaim: §f${formatPrice(data.price)} ${data.currencyId}`);
                } else if (data.expiry <= now) {
                    item.nameTag = `§c§l[EXPIRED] §r${displayName}`;
                    lore.push(`§eClick to reclaim`);
                } else {
                    item.nameTag = `§b§l[ACTIVE] §r${displayName}`;
                    lore.push(`§6Price: ${formatPrice(data.price)} ${data.currencyId}`, `§eTime: ${formatTimeLeft(data.expiry)}`);
                }
            } else {
                item.nameTag = `§r${displayName}`;
                lore.push(`§6Price: §e${formatPrice(data.price)} ${data.currencyId}`, `§eTime: §f${formatTimeLeft(data.expiry)}`);
            }

            item.setLore(lore);
            container.setItem(i, item);
        } else {
            container.setItem(i, undefined);
        }
    }
    entity.setDynamicProperty("rendered_count", itemsShown);
}

function collectNearbyMarketEntities() {
    const seen = new Map();
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;
        let nearby;
        try {
            nearby = player.dimension.getEntities({ type: ENTITY_ID, location: player.location, maxDistance: 8 });
        } catch (e) { continue; }
        for (const ent of nearby) seen.set(ent.id, ent);
    }
    return seen.values();
}

system.runInterval(() => {
    {
        const entities = collectNearbyMarketEntities();
        for (const ent of entities) {
            if (!ent.isValid) continue;
            const isPermanent = ent.getDynamicProperty("permanent") === true;
            const ownerId = ent.getDynamicProperty("owner_id");
            const player = ownerId ? world.getEntity(ownerId) : undefined;

            if (!ownerId || !player || getDistance(player.location, ent.location) > 5) {
                if (isPermanent) {
                    if (ownerId) resetPermanentMarket(ent);
                    continue;
                }
                ent.remove();
                continue;
            }

            if (ent.nameTag !== TITLE_IN_USE) continue;

            const container = ent.getComponent("inventory").container;
            const renderedCount = ent.getDynamicProperty("rendered_count") ?? 0;

            purgeIllegalItems(player);

            for (let i = 0; i <= 55; i++) {
                if (i === 52 || i === 53) continue;

                const item = container.getItem(i);
                let clicked = false;

                if (item && !ui_item(item)) {
                    const itemData = {
                        typeId: item.typeId,
                        amount: item.amount,
                        name: item.nameTag,
                        lore: item.getLore()
                    };

                    const enchantable = item.getComponent("minecraft:enchantable");
                    if (enchantable) {
                        const enchants = enchantable.getEnchantments();
                        if (enchants.length > 0) {
                            itemData.enchants = {};
                            enchants.forEach(e => itemData.enchants[e.type.id] = e.level);
                        }
                    }

                    const potionComp = item.getComponent("minecraft:potion");
                    if (potionComp) {
                        itemData.potion = potionComp.potionType?.id || potionComp.potionEffectType?.id;
                        itemData.delivery = potionComp.potionDeliveryType?.id || "minecraft:bottle";
                    }

                    giveOrDropItem(player, itemData);
                    container.setItem(i, undefined);
                    setupAuctionHouseSlots(ent);
                    continue;
                }

                if (i >= 48) {
                    if (!item) clicked = true;
                } else if (i < 48) {
                    if (i < renderedCount && !item) {
                        clicked = true;
                    }
                }

                if (clicked) {
                    handleAHClick(ent, player, i);
                    setupAuctionHouseSlots(ent);
                    break;
                }
            }
        }
    }
}, 2);

system.runInterval(() => {
    for (const dimension of ["overworld", "nether", "the_end"]) {
        let entities;
        try {
            entities = world.getDimension(dimension).getEntities({ type: ENTITY_ID });
        } catch (e) { continue; }
        for (const ent of entities) {
            if (!ent.isValid) continue;
            const isPermanent = ent.getDynamicProperty("permanent") === true;
            const ownerId = ent.getDynamicProperty("owner_id");
            const player = ownerId ? world.getEntity(ownerId) : undefined;

            if (!ownerId || !player || getDistance(player.location, ent.location) > 5) {
                if (isPermanent) {
                    if (ownerId) resetPermanentMarket(ent);
                    continue;
                }
                ent.remove();
            }
        }
    }
}, 100);

world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId !== "sh:ah") return;
    const player = ev.source;

    const isMenuEnabled = world.getDynamicProperty("ah");
    if (!isMenuEnabled) {
        player.sendMessage({ rawtext: [{ translate: 'message.ah.disabled' }] });
        return;
    }

    let alreadyExists = false;
    for (const dim of ["overworld", "nether", "the_end"]) {
        const existing = world.getDimension(dim).getEntities({ type: ENTITY_ID });
        if (existing.some(ent => ent.getDynamicProperty("owner_id") === player.id)) {
            alreadyExists = true;
            break;
        }
    }

    if (alreadyExists) {
        ev.cancel = true;
        system.run(() => player.sendMessage({ rawtext: [{ translate: 'message.ah.already_active' }] }));
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
            if (rayHit.face === "East") spawnX += 1;
            if (rayHit.face === "Up") spawnY += 2;
            if (rayHit.face === "South") spawnZ += 1;
            if (rayHit.face === "West") spawnX -= 1;
            if (rayHit.face === "Down") spawnY -= 1;
            if (rayHit.face === "North") spawnZ -= 1;

            ent = player.dimension.spawnEntity(ENTITY_ID, { x: spawnX, y: spawnY, z: spawnZ });
        }
        ent.teleport(ent.location, { facingLocation: player.location })

        ent.nameTag = TITLE_IDLE;
        ent.setDynamicProperty("owner_id", player.id);
        ent.setDynamicProperty("current_page", 0);
        ent.setDynamicProperty("cat_index", 0);
        ent.setDynamicProperty("sort_index", 0);
        ent.setDynamicProperty("view_mode", 0);

        system.runTimeout(() => {
            if (ent.isValid && ent.nameTag === TITLE_IDLE) {
                ent.remove();
            }
        }, 100);
    });
});

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { target, player } = event;
    if (target.typeId !== ENTITY_ID) return;

    system.runTimeout(() => {
        if (!target.isValid) return;
        const isPermanent = target.getDynamicProperty("permanent") === true;
        const ownerId = target.getDynamicProperty("owner_id");

        if (isPermanent) {
            const currentUser = ownerId ? world.getEntity(ownerId) : undefined;
            if (currentUser && currentUser.id !== player.id && getDistance(currentUser.location, target.location) <= 5) {
                player.sendMessage({ rawtext: [{ translate: 'message.ah.in_use' }] });
                return;
            }
            target.setDynamicProperty("owner_id", player.id);
            target.nameTag = TITLE_IN_USE;
            setupAuctionHouseSlots(target);
            return;
        }

        if (player.id != ownerId) {
            player.teleport({ x: player.location.x, y: player.location.y + 5, z: player.location.z });
            system.runTimeout(() => {
                player.teleport({ x: player.location.x, y: player.location.y - 5, z: player.location.z });
            }, 1)

            player.sendMessage({ rawtext: [{ translate: 'message.ah.wrong_owner' }] });
            return;
        }
        target.nameTag = TITLE_IN_USE;
        setupAuctionHouseSlots(target);
    }, 3);
});