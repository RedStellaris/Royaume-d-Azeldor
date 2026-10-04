import { ItemStack, EnchantmentTypes, Potions } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { PlayerMainMenu } from "./playerUi";
import * as H from "../general/helpers";

export function crateMenu(player) {
    const crates = H.getData("crates") || {};
    const keys = Object.keys(crates);
    
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.crates.title" }] });
        
    for (const id in crates) {
        form.button(crates[id].name);
    }
    
    form.button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back");
    
    form.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return PlayerMainMenu(player);
        spinMenu(player, keys[r.selection]);
    });
}

export function spinMenu(player, crate) {
    const crates = H.getData("crates") || {};
    const crateItems = H.getData("crateItems") || {};
    const itemsList = crateItems[crate] || [];

    let totalChance = 0;
    for (const item of itemsList) {
        totalChance += item.chance;
    }

    let rawtextBody = [
        { translate: "ui.crates.body.cost", with: [String(crates[crate].cost), crates[crate].scoreboard] }
    ];

    for (const item of itemsList) {
        const percent = ((item.chance / totalChance) * 100).toFixed(1);
        rawtextBody.push({ 
            translate: "ui.crates.body.item", 
            with: [item.name, String(item.amount), percent] 
        });
    }

    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.crates.title" }] })
        .body({ rawtext: rawtextBody })
        .button({ rawtext: [{ translate: "ui.button.spin" }] })
        .button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === 1) return crateMenu(player);
        if (itemsList.length === 0) return player.sendMessage({ rawtext: [{ translate: "message.crates.empty" }] });

        if (!H.removeBalance(player, crates[crate].scoreboard, crates[crate].cost)) {
            return player.sendMessage({ rawtext: [{ translate: "message.crates.not_enough", with: [crates[crate].scoreboard] }] });
        }

        let random = Math.random() * totalChance;
        let runningTotal = 0;
        let wonItem = null;

        for (const item of itemsList) {
            runningTotal += item.chance;
            if (random <= runningTotal) {
                wonItem = item;
                break;
            }
        }

        if (wonItem) {
            try {
                const itemStack = H.createItemStackFromData(wonItem, wonItem.amount);
                if (itemStack) {
                    player.dimension.spawnItem(itemStack, player.location);
                }
            } catch (e) {
                console.error(`Failed to spawn won item ${wonItem.id || wonItem.potion}: ${e}`);
            }

            player.sendMessage({
                rawtext: [{ 
                    translate: "message.crates.won", 
                    with: [wonItem.name, String(wonItem.amount), String(wonItem.chance), String(totalChance)] 
                }]
            });
        }

        return spinMenu(player, crate);
    });
}