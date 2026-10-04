import { world } from "@minecraft/server"
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";
import { EconMenu } from "./customizationUi"
import { preBuiltShop } from "../general/exports"

export function manageShopCategory(player, key) {
    const isBuy = key === "buyshop_items";
    const titleKey = isBuy ? "ui.admin.shop.title.buy" : "ui.admin.shop.title.sell";

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: titleKey }] })
        .button({ rawtext: [{ translate: "ui.admin.shop.btn.add" }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: "ui.admin.shop.btn.upload" }] }, "textures/ui/creative_icon")
        .button({ rawtext: [{ translate: "ui.admin.shop.btn.remove" }] }, "textures/ui/cancel")
        .button({ rawtext: [{ translate: "ui.admin.shop.btn.edit" }] }, "textures/items/map_empty")
        .button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 4) return EconMenu(player); 
            switch (r.selection) {
                case 0: addEconItem(player, key); break;
                case 1: uploadItemSetToShop(player, key); break;
                case 2: removeEconItem(player, key); break;
                case 3: editEconItemSelector(player, key); break;
            }
        });
}

export function uploadItemSetToShop(player, key) {
    const rawItemSets = H.getData("itemSets", {});
    const itemSetIds = Object.keys(rawItemSets);

    if (itemSetIds.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "message.admin.shop.no_sets" }] });
        return manageShopCategory(player, key);
    }

    const sbs = H.getScoreboardList();

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.shop.upload.title" }] })
        .dropdown({ rawtext: [{ translate: "ui.admin.shop.form.select_set" }] }, itemSetIds)
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.category" }] }, "Main", {defaultValue: "Main"})
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.price" }] }, "500")
        .dropdown({ rawtext: [{ translate: "ui.admin.shop.form.scoreboard" }] }, sbs)
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.texture" }] }, "textures/items/...")
        .show(player).then(res => {
            if (res.canceled) return manageShopCategory(player, key);

            const selectedSetId = itemSetIds[res.formValues[0]];
            const category = res.formValues[1] || "Main";
            const price = parseInt(res.formValues[2]);
            const board = sbs[res.formValues[3]];
            const texture = res.formValues[4] || undefined;

            if (isNaN(price) || price < 0) {
                player.sendMessage({ rawtext: [{ translate: "message.admin.shop.invalid_price" }] });
                return manageShopCategory(player, key);
            }

            const selectedSet = rawItemSets[selectedSetId];
            const items = H.getData(key) || {};
            
            let addedCount = 0;

            for (const item of selectedSet.items) {
                const cleanName = item.typeId.replace("minecraft:", "")
                                             .replace(/_/g, " ")
                                             .replace(/\b\w/g, l => l.toUpperCase());

                const shopEntry = {
                    displayName: cleanName,
                    price: price,
                    scoreboard: board,
                    category: category
                };

                if (texture && texture.trim() !== "") {
                    shopEntry.texture = texture.trim();
                }

                if (item.enchants) shopEntry.enchants = item.enchants;
                if (item.potion) {
                    shopEntry.potion = item.potion;
                    shopEntry.delivery = item.delivery;
                }

                const hasCustomTraits = item.enchants || item.potion;
                const uniqueKey = hasCustomTraits 
                    ? `${item.typeId}::${Math.random().toString(36).substr(2, 5)}` 
                    : item.typeId;

                items[uniqueKey] = shopEntry;
                addedCount++;
            }

            H.setData(key, items);
            player.sendMessage({ rawtext: [{ translate: "message.admin.shop.upload.success", with: [addedCount.toString()] }] });
            manageShopCategory(player, key);
        });
}

export function editEconItemSelector(player, key) {
    const items = H.getData(key) || {};
    const keys = Object.keys(items);
    if (keys.length === 0) return player.sendMessage({ rawtext: [{ translate: "message.admin.shop.no_items" }] });

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.shop.edit.select.title" }] });

    keys.forEach(k => {
        menu.button({ rawtext: [{ translate: "ui.admin.shop.edit.item_btn", with: [items[k].displayName, k] }] }, items[k].texture);
    });

    menu.button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return manageShopCategory(player, key);
        const itemID = keys[r.selection];
        const itemData = items[itemID];

        const sbs = H.getScoreboardList();
        let defIndex = sbs.indexOf(itemData.scoreboard);
        if (defIndex === -1) defIndex = 0;

        new ModalFormData()
            .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.shop.edit.form.title", with: [itemID] }] })
            .textField({ rawtext: [{ translate: "ui.admin.shop.form.id" }] }, "ID", {defaultValue: itemID})
            .textField({ rawtext: [{ translate: "ui.admin.shop.form.name" }] }, "Name", {defaultValue: itemData.displayName})
            .textField({ rawtext: [{ translate: "ui.admin.shop.form.price" }] }, "Price", {defaultValue: itemData.price.toString()})
            .dropdown({ rawtext: [{ translate: "ui.admin.shop.form.scoreboard" }] }, sbs, {defaultValueIndex: defIndex})
            .textField({ rawtext: [{ translate: "ui.admin.shop.form.category" }] }, "Main", {defaultValue: itemData.category})
            .textField({ rawtext: [{ translate: "ui.admin.shop.form.texture" }] }, "textures/items/...", {defaultValue: itemData.texture || ""})
            .show(player).then(res => {
                if (res.canceled) return editEconItemSelector(player, key);
                const [newId, name, price, sbIndex, cat, tex] = res.formValues;
                const board = sbs[sbIndex];

                items[newId] = {
                    displayName: name || newId,
                    price: parseInt(price),
                    scoreboard: board,
                    category: cat || "Main"
                };

                if (tex && tex.trim() !== "") {
                    items[newId].texture = tex.trim();
                }

                if (newId !== itemID) delete items[itemID];

                H.setData(key, items);
                editEconItemSelector(player, key);
                player.sendMessage({ rawtext: [{ translate: "message.admin.shop.edit.success" }] });
            });
    });
}

export function addEconItem(player, key) {
    const sbs = H.getScoreboardList();
    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.shop.add.title" }] })
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.id" }] }, "minecraft:diamond")
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.name" }] }, "Diamond")
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.price" }] }, "100")
        .dropdown({ rawtext: [{ translate: "ui.admin.shop.form.scoreboard" }] }, sbs)
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.category" }] }, "Main")
        .textField({ rawtext: [{ translate: "ui.admin.shop.form.texture" }] }, "textures/items/diamond")
        .show(player).then(r => {
            if (r.canceled) return manageShopCategory(player, key)
            const [id, name, price, sbIndex, cat, tex] = r.formValues;
            const board = sbs[sbIndex];

            if (!id.includes(":") || isNaN(parseInt(price))) {
                return player.sendMessage({ rawtext: [{ translate: "message.admin.shop.invalid_data" }] });
            }

            const items = H.getData(key) || {};
            items[id] = {
                displayName: name || id,
                price: parseInt(price),
                scoreboard: board,
                category: cat || "Main"
            };

            if (tex && tex.trim() !== "") {
                items[id].texture = tex.trim();
            }

            H.setData(key, items);
            player.sendMessage({ rawtext: [{ translate: "message.admin.shop.add.success" }] });
        });
}

export function removeEconItem(player, key) {
    const items = H.getData(key) || {};
    const keys = Object.keys(items);

    if (keys.length === 0) return player.sendMessage({ rawtext: [{ translate: "message.admin.shop.no_items" }] });

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.shop.remove.title" }] });

    keys.forEach(k => {
        menu.button({ rawtext: [{ translate: "ui.admin.shop.remove.item_btn", with: [items[k].displayName, k] }] }, items[k].texture);
    });

    menu.show(player).then(r => {
        if (r.canceled) return manageShopCategory(player, key)
        delete items[keys[r.selection]];
        H.setData(key, items);
        player.sendMessage({ rawtext: [{ translate: "message.admin.shop.remove.success" }] });
    });
}

export function viewableBalances(player) {
    const data = H.getData("balances", {});
    const balanceList = Object.entries(data);

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.econ.title" }] })
        .button({ rawtext: [{ translate: "ui.admin.econ.btn.add" }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: "ui.admin.econ.btn.remove" }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 2) return EconMenu(player);

            if (r.selection === 0) {
                const sbs = H.getScoreboardList();
                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.econ.add.title" }] })
                    .dropdown({ rawtext: [{ translate: "ui.admin.econ.form.scoreboard" }] }, sbs)
                    .show(player).then(res => {
                        if (res.canceled) return viewableBalances(player);
                        const input = sbs[res.formValues[0]];

                        if (!input) return player.sendMessage({ rawtext: [{ translate: "message.admin.econ.empty_input" }] });

                        const alreadyExists = Object.values(data).some(val => val.toLowerCase() === input.toLowerCase());
                        if (alreadyExists) {
                            return player.sendMessage({ rawtext: [{ translate: "message.admin.econ.already_exists" }] });
                        }

                        const newId = Date.now().toString();
                        data[newId] = input;
                        H.setData("balances", data);

                        player.sendMessage({ rawtext: [{ translate: "message.admin.econ.add.success", with: [input] }] });
                        viewableBalances(player);
                    });
            }

            if (r.selection === 1) {
                if (balanceList.length === 0) {
                    player.sendMessage({ rawtext: [{ translate: "message.admin.econ.none_to_remove" }] });
                    return viewableBalances(player);
                }

                const displayNames = balanceList.map(item => item[1]);

                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.econ.remove.title" }] })
                    .dropdown({ rawtext: [{ translate: "ui.admin.econ.remove.select" }] }, displayNames)
                    .show(player).then(res => {
                        if (res.canceled) return viewableBalances(player);

                        const selectedIndex = res.formValues[0];
                        const [idToRemove, nameToRemove] = balanceList[selectedIndex];

                        delete data[idToRemove];
                        H.setData("balances", data);

                        player.sendMessage({ rawtext: [{ translate: "message.admin.econ.remove.success", with: [nameToRemove] }] });
                        viewableBalances(player);
                    });
            }
        });
}

export function clearShopPrompt(player) {
    new MessageFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.shop.wipe.title" }] })
        .body({ rawtext: [{ translate: "ui.admin.shop.wipe.body" }] })
        .button1({ rawtext: [{ translate: "ui.admin.shop.wipe.btn.confirm" }] })
        .button2({ rawtext: [{ translate: "ui.admin.shop.wipe.btn.cancel" }] })
        .show(player).then(r => {
            if (r.selection === 0) { 
                H.setData("buyshop_items", {});
                H.setData("sellshop_items", {});
                player.sendMessage({ rawtext: [{ translate: "message.admin.shop.wipe.success" }] });
            }
        });
}

export function confirmPreMadeShop(player) {
    new MessageFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.shop.premade.title" }] })
        .body({ rawtext: [{ translate: "ui.admin.shop.premade.body" }] })
        .button1({ rawtext: [{ translate: "ui.admin.shop.premade.btn.confirm" }] })
        .button2({ rawtext: [{ translate: "ui.admin.shop.premade.btn.cancel" }] })
        .show(player).then(r => {
            if (r.selection === 0) {
                const currency = "Money";
                try { world.scoreboard.addObjective(currency, currency); } catch { }

                let buys = {}, sells = {};
                const shopTemplate = preBuiltShop[1];

                for (let catKey in shopTemplate) {
                    const categoryData = shopTemplate[catKey];
                    const items = categoryData.items;
                    const categoryDisplayName = categoryData.title;

                    for (let id in items) {
                        const itemData = items[id];
                        const price = itemData.price;
                        const texture = itemData.texture;
                        const name = id.split(":")[1].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

                        buys[id] = {
                            displayName: name,
                            price: price,
                            scoreboard: currency,
                            category: categoryDisplayName
                        };

                        sells[id] = {
                            displayName: name,
                            price: Math.floor(price * 0.5) || 1,
                            scoreboard: currency,
                            category: categoryDisplayName
                        };

                        if (texture) {
                            buys[id].texture = texture;
                            sells[id].texture = texture;
                        }
                    }
                }

                H.setData("buyshop_items", buys);
                H.setData("sellshop_items", sells);
                player.sendMessage({ rawtext: [{ translate: "message.admin.shop.premade.success" }] });
            }
        });
}