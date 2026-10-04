import { CodeMenuHub } from "./customizationUi"
import * as H from "../general/helpers"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"

export function manageCodesList(player) {
    const codes = H.getData("redeem_codes", {});
    const keys = Object.keys(codes);

    if (keys.length === 0) {
        player.sendMessage({ rawtext: [{ translate: 'message.codes.none_found' }] });
        return CodeMenuHub(player);
    }

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.codes.select.title' }] })
        .body({ rawtext: [{ translate: 'ui.codes.select.body' }] });

    keys.forEach(k => menu.button(k, "textures/ui/inventory_icon"));
    menu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return CodeMenuHub(player);
        editCodeData(player, keys[r.selection]);
    });
}

export function editCodeData(player, codeId) {
    const codes = H.getData("redeem_codes", {});
    
    const codeData = codes[codeId] || {};
    
    codeData.items = codeData.items || [];
    codeData.scoreboards = codeData.scoreboards || [];

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.codes.manage.title', with: [codeId] }] })
        .body({ 
            rawtext: [{ 
                translate: 'ui.codes.manage.body', 
                with: [String(codeData.items.length), String(codeData.scoreboards.length)] 
            }] 
        })
        .button({ rawtext: [{ translate: 'ui.codes.manage.button.add_item' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'crate.ui.loadItemSet' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'ui.codes.manage.button.add_sb' }] }, "textures/items/gold_ingot")
        .button({ rawtext: [{ translate: 'ui.codes.manage.button.remove' }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back")
        .show(player).then(res => {
            if (res.canceled || res.selection === 4) return manageCodesList(player);

            if (res.selection === 0) {
                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.codes.add_item.title' }] })
                    .textField({ rawtext: [{ translate: 'ui.codes.add_item.id_label' }] }, "minecraft:diamond")
                    .textField({ rawtext: [{ translate: 'ui.codes.add_item.amount_label' }] }, "1")
                    .show(player).then(itemRes => {
                        if (itemRes.canceled) return editCodeData(player, codeId);
                        const itemId = itemRes.formValues[0]?.trim();
                        const amount = parseInt(itemRes.formValues[1]);
                        if (itemId && !isNaN(amount) && amount > 0) {
                            codeData.items.push({ typeId: itemId, amount: amount });
                            codes[codeId] = codeData;
                            H.setData("redeem_codes", codes);
                            player.sendMessage({ rawtext: [{ translate: 'message.admin.item_added' }] });
                        }
                        editCodeData(player, codeId);
                    });
            } else if (res.selection === 1) {
                const rawItemSets = H.getData("itemSets", {});
                const itemSetIds = Object.keys(rawItemSets);
                
                if (itemSetIds.length === 0) {
                    player.sendMessage("§cNo Item Sets found. Create one first.");
                    return editCodeData(player, codeId);
                }

                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: "crate.ui.upload.title" }] })
                    .dropdown({ rawtext: [{ translate: "crate.ui.upload.select_set" }] }, itemSetIds)
                    .show(player).then(itemRes => {
                        if (itemRes.canceled) return editCodeData(player, codeId);

                        const selectedSetId = itemSetIds[itemRes.formValues[0]];
                        const selectedSet = rawItemSets[selectedSetId];
                        
                        let addedCount = 0;
                        for (const item of selectedSet.items) {
                            const payloadItem = {
                                typeId: item.typeId,
                                amount: item.amount
                            };
                            
                            // Carry over potion or enchant data if the set includes it
                            if (item.enchants) payloadItem.enchants = item.enchants;
                            if (item.potion) {
                                payloadItem.potion = item.potion;
                                payloadItem.delivery = item.delivery || "Consume";
                            }
                            
                            codeData.items.push(payloadItem);
                            addedCount++;
                        }

                        codes[codeId] = codeData;
                        H.setData("redeem_codes", codes);
                        player.sendMessage(`§aLoaded ${addedCount} items from "${selectedSetId}" into the reward code.`);
                        editCodeData(player, codeId);
                    });
            } else if (res.selection === 2) {
                const sbs = H.getScoreboardList();
                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.codes.add_sb.title' }] })
                    .dropdown({ rawtext: [{ translate: 'ui.codes.add_sb.objective_label' }] }, sbs)
                    .textField({ rawtext: [{ translate: 'ui.codes.add_sb.amount_label' }] }, "100")
                    .show(player).then(sbRes => {
                        if (sbRes.canceled) return editCodeData(player, codeId);
                        const objective = sbs[sbRes.formValues[0]];
                        const amount = parseInt(sbRes.formValues[1]);
                        if (objective && !isNaN(amount)) {
                            codeData.scoreboards.push({ objective: objective, amount: amount });
                            codes[codeId] = codeData;
                            H.setData("redeem_codes", codes);
                            player.sendMessage({ rawtext: [{ translate: 'message.admin.added_sb_reward' }] });
                        }
                        editCodeData(player, codeId);
                    });
            } else if (res.selection === 3) {
                removeRewardFromCode(player, codeId);
            }
        });
}

export function removeRewardFromCode(player, codeId) {
    const codes = H.getData("redeem_codes", {});
    const codeData = codes[codeId] || { items: [], scoreboards: [] };
    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.codes.remove_reward.title' }] });

    const itemMap = codeData.items.map((item, i) => ({ 
        type: 'item', 
        index: i, 
        label: { rawtext: [{ translate: 'ui.codes.remove_reward.item_label', with: [item.typeId || item.id, String(item.amount)] }] } 
    }));
    const sbMap = codeData.scoreboards.map((sb, i) => ({ 
        type: 'scoreboard', 
        index: i, 
        label: { rawtext: [{ translate: 'ui.codes.remove_reward.sb_label', with: [sb.objective, String(sb.amount)] }] } 
    }));
    const allRewards = [...itemMap, ...sbMap];

    if (allRewards.length === 0) {
        player.sendMessage({ rawtext: [{ translate: 'message.codes.no_rewards_remove' }] });
        return editCodeData(player, codeId);
    }

    allRewards.forEach(r => menu.button(r.label));
    menu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === allRewards.length) return editCodeData(player, codeId);
        const selected = allRewards[r.selection];

        if (selected.type === 'item') codeData.items.splice(selected.index, 1);
        else codeData.scoreboards.splice(selected.index, 1);

        codes[codeId] = codeData;
        H.setData("redeem_codes", codes);
        player.sendMessage({ rawtext: [{ translate: 'message.admin.reward_removed' }] });
        removeRewardFromCode(player, codeId);
    });
}