import { world, ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";

const getCustomTag = () => {
    return world.getDynamicProperty("customTagVisible") ?? true ? "§c§u§s§t§o§m" : "";
};

const UI_CONFIG = {
    BUY_TITLE_KEY: "ui.market.buy.title",
    SELL_TITLE_KEY: "ui.market.sell.title",
    BACK_BUTTON: { rawtext: [{ translate: "ui.button.back" }] },
    PRICE_TAG: "§a",
    CURRENCY_TAG: "§g",
    DESC_TAG: "§8",
    DIVIDER: "§7--------------------"
};

function toCmdItemId(typeId) {
    return typeId.startsWith("minecraft:") ? typeId.slice(10) : typeId;
}

function giveItem(player, itemId, amount, extraData = {}) {
    const container = player.getComponent("minecraft:inventory").container;

    const baseId = itemId.split("::")[0];
    const targetId = baseId.includes(":") ? baseId : `minecraft:${baseId}`;

    const itemData = { id: targetId, ...extraData };
    
    const referenceStack = H.createItemStackFromData(itemData, 1);
    
    if (!referenceStack) {
        console.warn(`[Shop] Failed to construct item stack for ${targetId}`);
        return amount;
    }

    const maxStack = referenceStack.maxAmount;
    let remaining = amount;
    let totalFailed = 0;

    while (remaining > 0) {
        const giveAmount = Math.min(remaining, maxStack);
        
        const stackToGive = H.createItemStackFromData(itemData, giveAmount);
        const remainder = container.addItem(stackToGive);

        if (remainder) {
            totalFailed += remainder.amount;
        }

        remaining -= giveAmount;
    }
    return totalFailed;
}

function removeItem(player, itemId, amount) {
    return player.runCommand(`clear @s ${toCmdItemId(itemId)} -1 ${amount}`);
}

function countItem(player, itemId) {
    try {
        const container = player.getComponent("minecraft:inventory").container;
        let count = 0;
        const targetId = itemId.includes(":") ? itemId : `minecraft:${itemId}`;
        for (let i = 0; i < container.size; i++) {
            const slot = container.getItem(i);
            if (slot?.typeId === targetId) count += slot.amount;
        }
        return count;
    } catch { return 0; }
}

function getsellShopItems() {
    let raw = world.getDynamicProperty("sellshop_items");
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function getbuyShopItems() {
    let raw = world.getDynamicProperty("buyshop_items");
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

world.afterEvents.itemUse.subscribe((event) => {
    const item = event.itemStack.typeId;
    const player = event.source;

    if (item === "sh:shop") {
        if (world.getDynamicProperty("economy") !== true) {
            player.sendMessage({ rawtext: [{ translate: "message.market.economy_disabled" }] });
            player.runCommand("clear @s sh:shop");
            return;
        }
        OpenMainMenu(player);
    }
});

export function AdminUnloadItemSetToShop(player, shopType) {
    const rawItemSets = H.getData("itemSets", {});
    const itemSetIds = Object.keys(rawItemSets);

    if (itemSetIds.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "message.admin.shop.no_sets" }] });
        return;
    }

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.market.admin.upload.title", with: [shopType.toUpperCase()] }] })
        .dropdown({ rawtext: [{ translate: "ui.market.admin.upload.select_set" }] }, itemSetIds)
        .textField({ rawtext: [{ translate: "ui.market.admin.upload.category" }] }, "Main", "Main")
        .textField({ rawtext: [{ translate: "ui.market.admin.upload.price" }] }, "500", "500")
        .textField({ rawtext: [{ translate: "ui.market.admin.upload.scoreboard" }] }, "coins", "coins")
        .textField({ rawtext: [{ translate: "ui.market.admin.upload.texture" }] }, "textures/items/...", "")
        .show(player).then(res => {
            if (res.canceled) return;

            const selectedSetId = itemSetIds[res.formValues[0]];
            const category = res.formValues[1] || "Main";
            const price = parseInt(res.formValues[2]);
            const scoreboard = res.formValues[3] || "coins";
            const texture = res.formValues[4] || undefined;

            if (isNaN(price) || price < 0) {
                return player.sendMessage({ rawtext: [{ translate: "message.market.invalid_price" }] });
            }

            const selectedSet = rawItemSets[selectedSetId];
            const propKey = `${shopType}shop_items`;

            let rawShop = world.getDynamicProperty(propKey);
            let shopData = {};
            try { shopData = rawShop ? JSON.parse(rawShop) : {}; } catch (e) { }

            let addedCount = 0;

            for (const item of selectedSet.items) {
                const cleanName = item.typeId.replace("minecraft:", "");

                const shopEntry = {
                    displayName: cleanName,
                    category: category,
                    price: price,
                    scoreboard: scoreboard,
                    texture: texture
                };

                if (item.enchants) shopEntry.enchants = item.enchants;
                if (item.potion) {
                    shopEntry.potion = item.potion;
                    shopEntry.delivery = item.delivery;
                }

                const hasCustomTraits = item.enchants || item.potion;
                const uniqueKey = hasCustomTraits
                    ? `${item.typeId}_${Math.random().toString(36).substr(2, 5)}`
                    : item.typeId;

                shopData[uniqueKey] = shopEntry;
                addedCount++;
            }

            world.setDynamicProperty(propKey, JSON.stringify(shopData));
            player.sendMessage({ rawtext: [{ translate: "message.market.admin.upload.success", with: [String(addedCount), shopType] }] });
        });
}

export function OpenMainMenu(player) {
    const balanceData = H.getData("balances", {});
    let rawtextBody = [{ translate: "ui.market.welcome" }];

    let balanceEntries = [];
    for (const key in balanceData) {
        const objectiveId = balanceData[key];
        const objective = world.scoreboard.getObjective(objectiveId);

        let score = 0;
        if (objective) {
            try {
                score = objective.getScore(player.scoreboardIdentity) ?? 0;
            } catch (e) {
                score = 0;
            }
        }
        balanceEntries.push({ translate: "ui.market.balance.entry", with: [objectiveId, score.toLocaleString()] });
    }

    if (balanceEntries.length > 0) {
        rawtextBody.push({ translate: "ui.market.balance.header" });
        rawtextBody.push(...balanceEntries);
    } else {
        rawtextBody.push({ translate: "ui.market.balance.none" });
    }

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: "ui.market.main.title" }] })
        .body({ rawtext: rawtextBody })
        .button({ rawtext: [{ translate: "ui.market.main.buy" }] }, "textures/ui/creative_icon")
        .button({ rawtext: [{ translate: "ui.market.main.sell" }] }, "textures/ui/inventory_icon")
        .button({ rawtext: [{ translate: "ui.market.main.trade" }] }, "textures/items/emerald")
        .show(player).then(r => {
            if (r.canceled) return;
            switch (r.selection) {
                case 0: showCategories(player, "buy"); break;
                case 1: showCategories(player, "sell"); break;
                case 2: trade(player); break;
            }
        });
}

function trade(player) {
    let tradeables = JSON.parse(world.getDynamicProperty("tradeables") ?? "[]");

    if (tradeables.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "message.market.no_tradeables" }] });
        return;
    }

    let menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: "ui.market.trade.select_currency" }] })
        .body({ rawtext: [{ translate: "ui.market.trade.prompt_currency" }] });

    for (const scoreboard of tradeables) {
        menu.button({ rawtext: [{ translate: "ui.market.trade.currency_btn", with: [scoreboard] }] });
    }

    menu.show(player).then(r => {
        if (r.canceled) return OpenMainMenu(player);
        const selectedCurrency = tradeables[r.selection];
        tradeplayer(player, selectedCurrency);
    });
}

function tradeplayer(player, currencyId) {
    const players = world.getAllPlayers().filter(p => p.name !== player.name);

    if (players.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "message.market.no_players" }] });
        return;
    }

    let menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: "ui.market.trade.select_player" }] })
        .body({ rawtext: [{ translate: "ui.market.trade.prompt_player", with: [currencyId] }] });

    for (const target of players) {
        menu.button({ rawtext: [{ translate: "ui.market.trade.player_btn", with: [target.name] }] }, "textures/ui/multiplayer_glyph_color");
    }

    menu.show(player).then(r => {
        if (r.canceled) return trade(player);
        const targetPlayer = players[r.selection];
        tradeAmount(player, targetPlayer, currencyId);
    });
}

function tradeAmount(player, target, currencyId) {
    const objective = world.scoreboard.getObjective(currencyId);
    let currentBalance = 0;
    try { currentBalance = objective.getScore(player) ?? 0; } catch (e) { currentBalance = 0; }

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: "ui.market.trade.amount.title", with: [currencyId] }] })
        .textField({ rawtext: [{ translate: "ui.market.trade.amount.field", with: [target.name, String(currentBalance)] }] }, "0")
        .show(player).then(r => {
            if (r.canceled) return;
            const amount = parseInt(r.formValues[0]);

            if (isNaN(amount) || amount <= 0) {
                player.sendMessage({ rawtext: [{ translate: "message.market.invalid_number" }] });
                return;
            }

            if (currentBalance < amount) {
                player.sendMessage({ rawtext: [{ translate: "message.market.insufficient_funds" }] });
                return;
            }

            objective.addScore(player, -amount);
            objective.addScore(target, amount);

            player.sendMessage({ rawtext: [{ translate: "message.market.trade.sent", with: [String(amount), currencyId, target.name] }] });
            target.sendMessage({ rawtext: [{ translate: "message.market.trade.received", with: [player.name, String(amount), currencyId] }] });

            player.runCommand(`playsound random.levelup @s`);
            target.runCommand(`playsound random.levelup @s`);
            H.spawnRewardParticle(player.dimension, player.location);
            H.spawnRewardParticle(target.dimension, target.location);
        });
}

function showCategories(player, type) {
    const items = type === "buy" ? getbuyShopItems() : getsellShopItems();
    const keys = Object.keys(items);
    if (keys.length === 0) return player.sendMessage({ rawtext: [{ translate: "message.market.no_items" }] });

    const categories = [...new Set(keys.map(id => items[id].category || "Main"))];
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: type === "buy" ? UI_CONFIG.BUY_TITLE_KEY : UI_CONFIG.SELL_TITLE_KEY }] })
        .body({ rawtext: [{ translate: "ui.market.select_category" }] });

    categories.forEach(cat => {
        const topItemKey = keys.find(id => (items[id].category || "Main") === cat && items[id].texture);
        const iconPath = topItemKey ? items[topItemKey].texture : undefined;

        const buttonText = { rawtext: [{ translate: "ui.market.category.btn", with: [cat] }] };

        if (iconPath) {
            form.button(buttonText, iconPath);
        } else {
            form.button(buttonText);
        }
    });

    form.button(UI_CONFIG.BACK_BUTTON, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === categories.length) return OpenMainMenu(player);
        showCategoryItems(player, categories[r.selection], items, type);
    });
}

function showCategoryItems(player, category, allItems, type) {
    const filteredKeys = Object.keys(allItems)
        .filter(id => (allItems[id].category || "Main") === category)
        .sort((a, b) => allItems[a].price - allItems[b].price);

    const balanceData = H.getData("balances", {});
    let rawtextBody = [{ translate: "ui.market.choose_item" }, { text: `\n§r— — — — — — — — — —\n` }];

    let balanceEntries = [];
    for (const key in balanceData) {
        const objectiveId = balanceData[key];
        const objective = world.scoreboard.getObjective(objectiveId);
        let score = 0;
        if (objective) {
            try {
                score = objective.getScore(player.scoreboardIdentity) ?? 0;
            } catch (e) { score = 0; }
        }
        balanceEntries.push({ translate: "ui.market.balance.entry", with: [objectiveId, score.toLocaleString()] });
    }

    if (balanceEntries.length > 0) {
        rawtextBody.push({ translate: "ui.market.balance.header_your" });
        rawtextBody.push(...balanceEntries);
    } else {
        rawtextBody.push({ translate: "ui.market.balance.none" });
    }
    rawtextBody.push({ text: `\n` });

    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: "ui.market.category.title", with: [category.toUpperCase()] }] })
        .body({ rawtext: rawtextBody });

    filteredKeys.forEach(id => {
        const entry = allItems[id];
        const priceString = `${UI_CONFIG.PRICE_TAG}${entry.price} ${UI_CONFIG.CURRENCY_TAG}${entry.scoreboard}`;
        const btnText = { rawtext: [{ translate: "ui.market.item.btn", with: [entry.displayName, priceString] }] };

        if (entry.texture) {
            form.button(btnText, entry.texture);
        } else {
            form.button(btnText);
        }
    });

    form.button(UI_CONFIG.BACK_BUTTON, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === filteredKeys.length) return showCategories(player, type);
        const itemId = filteredKeys[r.selection];
        type === "buy" ? showBuyQuantity(player, itemId, allItems[itemId]) : showSellQuantity(player, itemId, allItems[itemId]);
    });
}

function showBuyQuantity(player, itemId, itemData) {
    const amounts = [1, 4, 16, 32, 64];
    const name = itemData.displayName ?? itemId;
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: "ui.market.buy.confirm_title" }] })
        .body({ rawtext: [{ text: `${UI_CONFIG.DIVIDER}\n` }, { translate: "ui.market.item.label" }, { text: ` §f${name}\n${UI_CONFIG.DIVIDER}` }] });

    amounts.forEach(num => {
        const total = num * itemData.price;
        form.button({ rawtext: [{ translate: "ui.market.buy.quantity_btn", with: [String(num), String(total), itemData.scoreboard] }] });
    });
    form.button(UI_CONFIG.BACK_BUTTON, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === amounts.length) return showCategoryItems(player, itemData.category, getbuyShopItems(), "buy");

        const amount = amounts[r.selection];
        const cost = amount * itemData.price;

        if (H.removeBalance(player, itemData.scoreboard, cost)) {
            const failedAmount = giveItem(player, itemId, amount, itemData);
            const successAmount = amount - failedAmount;

            if (failedAmount > 0) {
                const refund = failedAmount * itemData.price;
                H.addBalance(player, itemData.scoreboard, refund);

                if (successAmount > 0) {
                    player.sendMessage({ rawtext: [{ translate: "message.market.buy.partial_full", with: [String(successAmount), name, String(refund), itemData.scoreboard, String(failedAmount)] }] });
                    H.playPurchase(player);
                } else {
                    player.sendMessage({ rawtext: [{ translate: "message.market.buy.completely_full", with: [String(refund), itemData.scoreboard] }] });
                    H.playDenied(player);
                }
            } else {
                player.sendMessage({ rawtext: [{ translate: "message.market.buy.success", with: [String(amount), name, String(cost), itemData.scoreboard] }] });
                H.playPurchase(player);
                H.spawnRewardParticle(player.dimension, player.location);
            }
        } else {
            player.sendMessage({ rawtext: [{ translate: "message.market.insufficient_funds_msg" }] });
            H.playDenied(player);
        }
        showBuyQuantity(player, itemId, itemData);
    });
}

function showSellQuantity(player, itemId, itemData) {
    const amounts = [1, 4, 16, 32, 64];
    const name = itemData.displayName ?? itemId;
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: getCustomTag() }, { translate: "ui.market.sell.confirm_title" }] })
        .body({ rawtext: [{ text: `${UI_CONFIG.DIVIDER}\n` }, { translate: "ui.market.selling.label" }, { text: ` §f${name}\n${UI_CONFIG.DIVIDER}` }] });

    amounts.forEach(num => {
        const total = num * itemData.price;
        form.button({ rawtext: [{ translate: "ui.market.sell.quantity_btn", with: [String(num), String(total), itemData.scoreboard] }] });
    });
    form.button({ rawtext: [{ translate: "ui.market.sell.all_btn" }] });
    form.button(UI_CONFIG.BACK_BUTTON, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === amounts.length + 1) return showCategoryItems(player, itemData.category, getsellShopItems(), "sell");

        const invCount = countItem(player, itemId);

        if (r.selection === amounts.length) {
            if (invCount === 0) {
                H.playDenied(player);
                return player.sendMessage({ rawtext: [{ translate: "message.market.sell.nothing" }] });
            }
            const payout = invCount * itemData.price;
            removeItem(player, itemId, invCount);
            H.addBalance(player, itemData.scoreboard, payout);
            player.sendMessage({ rawtext: [{ translate: "message.market.sell.success", with: [String(invCount), name, String(payout), itemData.scoreboard] }] });
            H.playSuccess(player);
            H.spawnRewardParticle(player.dimension, player.location);
            return;
        }

        const amount = amounts[r.selection];
        if (invCount < amount) {
            H.playDenied(player);
            return player.sendMessage({ rawtext: [{ translate: "message.market.sell.not_enough" }] });
        }

        const payout = amount * itemData.price;
        removeItem(player, itemId, amount);
        H.addBalance(player, itemData.scoreboard, payout);
        player.sendMessage({ rawtext: [{ translate: "message.market.sell.success", with: [String(amount), name, String(payout), itemData.scoreboard] }] });
        H.playSuccess(player);
        H.spawnRewardParticle(player.dimension, player.location);
        showSellQuantity(player, itemId, itemData);
    });
}