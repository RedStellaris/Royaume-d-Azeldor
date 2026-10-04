import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";

const ENTITY_ID = "sh:bazaar_ent";
const OPENER_ITEM = "sh:bazaar";
const TITLE_IDLE = "§l§eBazaar§r\n§5Removing in:§r 5s";
const TITLE_IN_USE = "§l§eBazaar§r\n§2§lIN USE";
const UI_LORE = "ui_item";
const MAX_PRICE = 1000000;

const SORT_MODES = ["High to Low", "Low to High", "Newest", "Oldest"];
const SORT_ITEM_IDS = ["sh:high_to_low", "sh:low_to_high", "sh:newest", "sh:oldest"];

const TITLE_PERMANENT = "§l§eBazaar§r\n§eTap to browse";

function resetPermanentMarket(ent) {
    ent.setDynamicProperty("owner_id", undefined);
    ent.setDynamicProperty("view_mode", 0);
    ent.setDynamicProperty("current_page", 0);
    ent.setDynamicProperty("search_query", "");
    ent.nameTag = TITLE_PERMANENT;
    ent.getComponent("inventory").container.clearAll();
}

function getbuyShopItems() {
    let raw = world.getDynamicProperty("buyshop_items");
    try { 
        return raw ? JSON.parse(raw) : {}; 
    } catch (e) { 
        return {}; 
    }
}

function getTradeableCurrencies() {
    try {
        const raw = world.getDynamicProperty("tradeables");
        if (!raw) {
            return ["Error"];
        }
        
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "object" && parsed !== null) return Object.keys(parsed);
        
        return [String(parsed)];
    } catch (e) { 
        return ["error"]; 
    }
}

function sleep(ticks) {
    return new Promise((resolve) => system.runTimeout(resolve, ticks));
}

async function resetInteraction(entity) {
    if (!entity.isValid) return;
    const loc = { ...entity.location };
    entity.teleport({ x: loc.x, y: loc.y + 99, z: loc.z });
    
    if (!entity.isValid) {
        return; 
    }
    system.run(() => entity.teleport(loc))
    await sleep(4);
}

function getDistanceSq(loc1, loc2) {
    return (loc1.x - loc2.x) ** 2 + (loc1.y - loc2.y) ** 2 + (loc1.z - loc2.z) ** 2;
}

function ui_item(item) {
    if (!item) return false;
    const lore = item.getLore();
    return lore.length > 0 && lore[0].startsWith(UI_LORE);
}

function getPageDigits(page) {
    const displayNum = (page + 1).toString().padStart(2, "0");
    const d1 = new ItemStack(`sh:ui_num${displayNum[0]}`);
    const d2 = new ItemStack(`sh:ui_num${displayNum[1]}`);
    d1.setLore([UI_LORE]);
    d2.setLore([UI_LORE]);
    return [d1, d2];
}

function giveOrDropItem(player, itemData) {
    const container = player.getComponent("inventory").container;
    const tempStack = new ItemStack(itemData.typeId, 1);
    const maxStack = tempStack.maxAmount;
    let remaining = itemData.amount;

    while (remaining > 0) {
        const currentAmount = Math.min(remaining, maxStack);
        const itemStack = new ItemStack(itemData.typeId, currentAmount);

        if (itemData.name) itemStack.nameTag = itemData.name;
        if (itemData.lore && Array.isArray(itemData.lore)) itemStack.setLore(itemData.lore);

        const leftover = container.addItem(itemStack);
        if (leftover && leftover.amount > 0) {
            player.dimension.spawnItem(leftover, player.location);
        }

        remaining -= currentAmount;
    }
}

function purgeIllegalItems(player) {
    let purged = false;
    const cursor = player.getComponent("cursor_inventory");
    if (cursor?.item && ui_item(cursor.item)) {
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

function addBalance(player, scoreboard, amount) {
    player.runCommand(`scoreboard players add @s "${scoreboard}" ${amount}`);
}

function removeBalance(player, scoreboard, amount) {
    try {
        const obj = world.scoreboard.getObjective(scoreboard);
        const bal = obj ? (obj.getScore(player.scoreboardIdentity) ?? 0) : 0;
        if (bal < amount) {
            return false;
        }
        player.runCommand(`scoreboard players remove @s "${scoreboard}" ${amount}`);
        return true;
    } catch (e) { 
        return false; 
    }
}

async function handleInstantTrade(player, itemId, mode, entity) {
    const data = H.getData(itemId) || { buy: [], sell: [] };
    const orderBook = mode === "BUY" ? data.sell : data.buy;

    const totalMarketStock = orderBook.reduce((acc, val) => acc + val.a, 0);
    if (totalMarketStock <= 0) {
        return player.sendMessage({ rawtext: [{ translate: 'bazaar.error.market_empty' }] });
    }

    entity.setDynamicProperty("menu_open", true);
    await resetInteraction(entity);
    
    if (!entity.isValid || !player.isValid) return;

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: mode === "BUY" ? 'bazaar.title.instant_buy' : 'bazaar.title.instant_sell' }] })
        .textField({ rawtext: [{ translate: mode === "BUY" ? 'bazaar.textfield.quantity_buy' : 'bazaar.textfield.quantity_sell', with: [String(totalMarketStock)] }] }, { translate: 'bazaar.textfield.enter_amount' });

    const res = await form.show(player);

    if (entity.isValid) entity.setDynamicProperty("menu_open", false);
    if (res.canceled) {
        return;
    }

    let tradeQty = Math.max(parseInt(res.formValues[0]) || 0, 1);
    tradeQty = Math.min(tradeQty, totalMarketStock);

    orderBook.sort((a, b) => mode === "BUY" ? a.p - b.p : b.p - a.p);

    let processedCount = 0;

    for (let i = 0; i < orderBook.length && tradeQty > 0; i++) {
        const order = orderBook[i];
        if (order.a <= 0) continue;

        const canTake = Math.min(tradeQty, order.a);
        const matchSB = order.sb || "money";

        if (mode === "BUY") {
            const cost = canTake * order.p;
            if (!removeBalance(player, matchSB, cost)) {
                player.sendMessage({ rawtext: [{ translate: 'bazaar.error.insufficient_funds', with: [matchSB] }] });
                break;
            }
            giveOrDropItem(player, { typeId: itemId, amount: canTake });
            order.c = (order.c || 0) + cost;
        } else {
            if (countItem(player, itemId) < canTake) {
                player.sendMessage({ rawtext: [{ translate: 'bazaar.error.ran_out_items' }] });
                break;
            }
            const earnings = canTake * order.p;
            removeItem(player, itemId, canTake);
            addBalance(player, matchSB, earnings);
            order.c = (order.c || 0) + canTake;
        }

        order.a -= canTake;
        tradeQty -= canTake;
        processedCount += canTake;
    }

    data.buy = data.buy.filter(o => !(o.a <= 0 && (o.c || 0) <= 0));
    data.sell = data.sell.filter(o => !(o.a <= 0 && (o.c || 0) <= 0));

    H.setData(itemId, data);
    player.sendMessage({ rawtext: [{ translate: 'bazaar.success.processed', with: [String(processedCount)] }] });
    player.playSound("random.levelup");
}

async function showOrderModal(player, itemId, entity) {
    entity.setDynamicProperty("menu_open", true);
    await resetInteraction(entity);
    if (!entity.isValid || !player.isValid) return;

    const currencies = getTradeableCurrencies();

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'bazaar.title.setup_order' }] })
        .textField({rawtext: [{ translate: 'bazaar.label.quantity' }]}, {rawtext: [{ translate: 'bazaar.placeholder.amount' }]})
        .textField({rawtext: [{ translate: 'bazaar.label.price' }]}, { translate: 'bazaar.placeholder.price' })
        .dropdown({rawtext: [{ translate: 'bazaar.label.currency' }]}, currencies, {defaultValueIndex: 0})
        .dropdown(
            {rawtext: [{ translate: 'bazaar.label.order_type' }]}, 
            [{ translate: 'bazaar.dropdown.sell_offer' }, { translate: 'bazaar.dropdown.buy_order' }], 
            { defaultValueIndex: 0 }
        );

    const res = await form.show(player);
    if (entity.isValid) entity.setDynamicProperty("menu_open", false);
    if (res.canceled) {
        return;
    }

    let [qtyStr, prcStr, currIdx, typeIdx] = res.formValues;
    const qty = Math.min(Math.max(parseInt(qtyStr) || 0, 1), 10000);
    const price = Math.min(Math.max(parseInt(prcStr) || 0, 1), MAX_PRICE);
    const selectedSB = currencies[currIdx];
    const isSell = typeIdx === 0;

    if (isSell) {
        if (countItem(player, itemId) < qty) {
            return player.sendMessage({ rawtext: [{ translate: 'bazaar.error.not_enough_list' }] });
        }
        removeItem(player, itemId, qty);
    } else {
        if (!removeBalance(player, selectedSB, qty * price)) {
            return player.sendMessage({ rawtext: [{ translate: 'bazaar.error.insufficient_order' }] });
        }
    }

    const data = H.getData(itemId) || { buy: [], sell: [] };
    (isSell ? data.sell : data.buy).push({ o: player.id, n: player.name, p: price, a: qty, c: 0, sb: selectedSB, ts: Date.now() });
    H.setData(itemId, data);
    player.sendMessage({ rawtext: [{ translate: 'bazaar.success.order_placed' }] });
}

function getFilteredItems(entity) {
    const shopItems = getbuyShopItems();
    const itemKeys = Object.keys(shopItems);
    const catIdx = entity.getDynamicProperty("cat_index") ?? 0;
    const sQuery = entity.getDynamicProperty("search_query")?.toLowerCase() || "";
    const categories = [...new Set(itemKeys.map(id => shopItems[id].category || "Misc"))];
    const activeCat = categories[catIdx] || "Misc";

    return itemKeys.filter(id => {
        const matchesSearch = (shopItems[id].displayName || id).toLowerCase().includes(sQuery);
        const matchesCat = (shopItems[id].category || "Misc") === activeCat;
        return sQuery ? matchesSearch : matchesCat;
    });
}

function getMyOrders(playerId) {
    const shopItems = getbuyShopItems();
    const results = [];
    for (const itemId in shopItems) {
        const data = H.getData(itemId) || { buy: [], sell: [] };
        data.buy.forEach((ord, i) => { if (ord.o === playerId) results.push({ itemId, type: "BUY", data: ord, idx: i }); });
        data.sell.forEach((ord, i) => { if (ord.o === playerId) results.push({ itemId, type: "SELL", data: ord, idx: i }); });
    }
    return results;
}

function setupBazaarSlots(entity) {
    if (!entity.isValid) return;
    const container = entity.getComponent("inventory").container;
    const page = entity.getDynamicProperty("current_page") ?? 0;
    const viewMode = entity.getDynamicProperty("view_mode") ?? 0;
    const catIdx = entity.getDynamicProperty("cat_index") ?? 0;
    const sortIdx = entity.getDynamicProperty("sort_index") ?? 0;
    const ownerId = entity.getDynamicProperty("owner_id");
    const player = world.getEntity(ownerId);
    
    if (!player) {
        return;
    }

    const shopItems = getbuyShopItems();
    const categories = [...new Set(Object.keys(shopItems).map(id => shopItems[id].category || "Misc"))];
    const activeCatName = categories[catIdx] || "Misc";

    container.clearAll();

    const displayList = (viewMode === 0) ? getFilteredItems(entity) : getMyOrders(ownerId);
    const startIdx = page * 48;
    let itemsShown = 0;

    for (let i = 0; i < 48; i++) {
        const entry = displayList[startIdx + i];
        if (!entry) continue;
        itemsShown++;

        if (viewMode === 0) {
            const data = H.getData(entry) || { buy: [], sell: [] };
            const activeSells = data.sell.filter(o => o.a > 0).sort((a, b) => a.p - b.p);
            const activeBuys = data.buy.filter(o => o.a > 0).sort((a, b) => b.p - a.p);

            const bP = activeSells[0];
            const sP = activeBuys[0];

            const item = new ItemStack(entry);
            item.nameTag = `§e§l${shopItems[entry].displayName || entry}`;

            item.setLore([
                UI_LORE,
                `§7Buy: §e${bP ? bP.p : "---"}`,
                `§7Sell: §e${sP ? sP.p : "---"}`,
                "",
                "§eClick to trade!"
            ]);
            container.setItem(i, item);
        } else {
            const item = new ItemStack(entry.itemId);
            const isBuy = entry.type === "BUY";
            const itemName = shopItems[entry.itemId].displayName || entry.itemId;

            item.nameTag = `§e§l${isBuy ? "Buy Order" : "Sell Offer"}: §f${itemName}`;

            const lore = [
                UI_LORE,
                `§7Price: §e${entry.data.p} §7(${entry.data.sb})`,
                `§7Remaining: §f${entry.data.a}`
            ];

            if (entry.data.c > 0) {
                lore.push(
                    "",
                    `§aClaim ${entry.data.c} ${isBuy ? "Items" : entry.data.sb}`
                );
            } else {
                lore.push("", "§cClick to cancel");
            }

            item.setLore(lore);
            container.setItem(i, item);
        }
    }
    entity.setDynamicProperty("rendered_count", itemsShown);

    const setBtn = (slot, text, typeId) => {
        const item = new ItemStack(typeId);
        item.nameTag = `§r§l${text}`;
        item.setLore([UI_LORE]);
        container.setItem(slot, item);
    };

    setBtn(48, viewMode === 0 ? "View Orders" : "View Market", viewMode === 0 ? "sh:all_listings" : "sh:my_listings");
    setBtn(49, `Category: ${activeCatName}`, "sh:category");
    setBtn(50, `Search: ${entity.getDynamicProperty("search_query") || "None"}`, "sh:search");
    setBtn(51, `Sort: ${SORT_MODES[sortIdx]}`, SORT_ITEM_IDS[sortIdx]);
    setBtn(54, "Previous Page", "sh:previous_page");
    setBtn(55, "Next Page", "sh:next_page");

    const [d1, d2] = getPageDigits(page);
    container.setItem(56, d1); container.setItem(57, d2);
}

async function handleBazaarClick(entity, player, slot) {
    const page = entity.getDynamicProperty("current_page") ?? 0;
    const viewMode = entity.getDynamicProperty("view_mode") ?? 0;

    if (slot < 48) {
        if (viewMode === 0) {
            const items = getFilteredItems(entity);
            const id = items[page * 48 + slot];
            resetInteraction(entity);
            if (id) system.run(() => openBazaarTradeMenu(player, id, entity));
        } else {
            const myOrders = getMyOrders(player.id);
            const entry = myOrders[page * 48 + slot];
            if (!entry) return;

            const bzData = H.getData(entry.itemId) || { buy: [], sell: [] };
            const list = (entry.type === "BUY") ? bzData.buy : bzData.sell;
            const order = list[entry.idx];

            if (order.c > 0) {
                if (entry.type === "BUY") giveOrDropItem(player, { typeId: entry.itemId, amount: order.c });
                else addBalance(player, order.sb, order.c);
                order.c = 0;
                player.sendMessage({ rawtext: [{ translate: 'bazaar.success.earnings_claimed' }] });
                player.playSound("random.levelup");
            } else {
                if (entry.type === "BUY") addBalance(player, order.sb, order.a * order.p);
                else giveOrDropItem(player, { typeId: entry.itemId, amount: order.a });
                list.splice(entry.idx, 1);
                player.sendMessage({ rawtext: [{ translate: 'bazaar.success.order_cancelled' }] });
                player.playSound("random.pop");
            }

            bzData.buy = bzData.buy.filter(o => !(o.a <= 0 && (o.c || 0) <= 0));
            bzData.sell = bzData.sell.filter(o => !(o.a <= 0 && (o.c || 0) <= 0));
            H.setData(entry.itemId, bzData);
        }
        return;
    }

    switch (slot) {
        case 48: {
            entity.setDynamicProperty("view_mode", viewMode === 0 ? 1 : 0);
            player.playSound("random.click");
            break;
        }
        case 49: {
            const shopItems = getbuyShopItems();
            const cats = [...new Set(Object.keys(shopItems).map(id => shopItems[id].category || "Misc"))];

            if (cats.length > 0) {
                const currentIndex = entity.getDynamicProperty("cat_index") ?? 0;
                const nextIndex = (currentIndex + 1) % cats.length;
                entity.setDynamicProperty("cat_index", nextIndex);
                player.playSound("random.click");
            } else {
                entity.setDynamicProperty("cat_index", 0);
                player.playSound("note.bass");
            }
            break;
        }
        case 50: {
            system.run(() => handleSearchInput(player, entity));
            player.playSound("random.click");
            break;
        }
        case 51: {
            entity.setDynamicProperty("sort_index", ((entity.getDynamicProperty("sort_index") ?? 0) + 1) % SORT_MODES.length);
            player.playSound("random.click");
            break;
        }
        case 54: {
            if (page > 0) {
                entity.setDynamicProperty("current_page", page - 1);
                player.playSound("random.click");
            }
            break;
        }
        case 55: {
            entity.setDynamicProperty("current_page", page + 1);
            player.playSound("random.click");
            break;
        }
    }
    setupBazaarSlots(entity);
}

function collectNearbyBazaarEntities() {
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
    const purgedPlayers = new Set();

    {
        const entities = collectNearbyBazaarEntities();
        for (const ent of entities) {
            if (!ent.isValid) continue;
            
            const ownerId = ent.getDynamicProperty("owner_id");
            const player = ownerId ? world.getEntity(ownerId) : undefined;
            
            if (!ownerId || !player || getDistanceSq(player.location, ent.location) > 25) {
                if (ent.getDynamicProperty("menu_open")) continue;
                if (ent.getDynamicProperty("permanent") === true) {
                    if (ownerId) resetPermanentMarket(ent);
                    continue;
                }
                ent.remove();
                continue;
            }
            
            if (ent.nameTag !== TITLE_IN_USE) continue;

            const container = ent.getComponent("inventory").container;
            const renderedCount = ent.getDynamicProperty("rendered_count") ?? 0;

            if (!purgedPlayers.has(player.id)) {
                purgeIllegalItems(player);
                purgedPlayers.add(player.id);
            }

            for (let i = 0; i <= 55; i++) {
                if (i === 52 || i === 53) continue;

                const item = container.getItem(i);

                if (item && !ui_item(item)) {
                    giveOrDropItem(player, {
                        typeId: item.typeId,
                        amount: item.amount,
                        name: item.nameTag,
                        lore: item.getLore()
                    });
                    container.setItem(i, undefined);
                    setupBazaarSlots(ent);
                    continue;
                }

                if (((i < renderedCount) || (i >= 48)) && !item) {
                    handleBazaarClick(ent, player, i);
                    setupBazaarSlots(ent);
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

            const ownerId = ent.getDynamicProperty("owner_id");
            const player = ownerId ? world.getEntity(ownerId) : undefined;

            if (!ownerId || !player || getDistanceSq(player.location, ent.location) > 25) {
                if (ent.getDynamicProperty("menu_open")) continue;
                if (ent.getDynamicProperty("permanent") === true) {
                    if (ownerId) resetPermanentMarket(ent);
                    continue;
                }
                ent.remove();
            }
        }
    }
}, 100);

async function openBazaarTradeMenu(player, itemId, entity) {
    entity.setDynamicProperty("menu_open", true);
    await resetInteraction(entity);
    if (!entity.isValid) return;

    const data = H.getData(itemId) || { buy: [], sell: [] };
    const bestS = data.sell.filter(o => o.a > 0).sort((a, b) => a.p - b.p)[0];
    const bestB = data.buy.filter(o => o.a > 0).sort((a, b) => b.p - a.p)[0];

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'bazaar.title.trade', with: [itemId.split(":")[1]] }] })
        .button({ rawtext: [{ translate: 'bazaar.button.buy_instantly', with: ["\n" + String(bestS?.p ?? "---")] }] })
        .button({ rawtext: [{ translate: 'bazaar.button.sell_instantly', with: ["\n" + String(bestB?.p ?? "---")] }] })
        .button({ rawtext: [{ translate: 'bazaar.button.create_order' }] })
        .show(player).then(res => {
            if (entity.isValid) entity.setDynamicProperty("menu_open", false);
            if (res.canceled) {
                return;
            }
            
            if (res.selection === 0) system.run(() => handleInstantTrade(player, itemId, "BUY", entity));
            if (res.selection === 1) system.run(() => handleInstantTrade(player, itemId, "SELL", entity));
            if (res.selection === 2) system.run(() => showOrderModal(player, itemId, entity));
        });
}

async function handleSearchInput(player, entity) {
    entity.setDynamicProperty("menu_open", true);
    await resetInteraction(entity);
    if (!entity.isValid) return;

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'bazaar.title.search' }] })
        .textField({ translate: 'bazaar.label.enter_item_name' }, "e.g. Iron");
    
    const res = await form.show(player);
    if (entity.isValid) entity.setDynamicProperty("menu_open", false);
    
    if (!res.canceled) {
        entity.setDynamicProperty("search_query", res.formValues[0]);
        setupBazaarSlots(entity);
    }
}

world.beforeEvents.itemUse.subscribe(ev => {
    if (ev.itemStack.typeId !== OPENER_ITEM) return;
    const player = ev.source;

    const isMenuEnabled = world.getDynamicProperty("bazaar");
    if (!isMenuEnabled) {
        player.sendMessage({ rawtext: [{ translate: 'bazaar.error.disabled' }] });
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
        system.run(() => player.sendMessage({ rawtext: [{ translate: 'bazaar.error.already_active' }] }));
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

            ent = player.dimension.spawnEntity(ENTITY_ID, {
                x: spawnX,
                y: spawnY,
                z: spawnZ
            });
        }
        
        ent.teleport(ent.location, { facingLocation: player.location });

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
            setupBazaarSlots(target);
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
        setupBazaarSlots(target);
    }, 3);
});