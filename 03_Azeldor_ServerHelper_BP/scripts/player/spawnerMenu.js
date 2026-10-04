import { world, system, ItemStack } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import { PlayerMainMenu } from "./playerUi"
import * as H from "../general/helpers"

export function BuySpawnerMenu(player) {
    const spawnersObj = H.getData("spawners", {});

    const spawnersList = Object.values(spawnersObj).sort((a, b) => a.cost - b.cost);

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "shop.spawner.title" }] })
        .body({ rawtext: [{ translate: "shop.spawner.body" }] });

    spawnersList.forEach(s => {
        const mobName = s.mob.includes(":") ? s.mob.split(':')[1].toUpperCase() : s.mob.toUpperCase();
        const buttonText = { 
            rawtext: [{ translate: "shop.spawner.button.item", with: [mobName, String(s.cost), s.scoreboard] }] 
        };

        if (s.texture) {
            menu.button(buttonText, s.texture);
        } else {
            menu.button(buttonText);
        }
    });

    menu.button({ rawtext: [{ translate: "shop.spawner.button.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled) return PlayerMainMenu(player)
        if (r.selection === spawnersList.length) return typeof playerform === "function" ? playerform(player) : null;

        const selection = spawnersList[r.selection];
        const mobName = selection.mob.includes(":") ? selection.mob.split(':')[1].toUpperCase() : selection.mob.toUpperCase();

        system.run(() => {
            const quantityForm = new ModalFormData()
                .title({ rawtext: [{ text: H.customUi() }, { translate: "shop.spawner.modal.title", with: [mobName] }] })
                .textField({ rawtext: [{ translate: "shop.spawner.modal.textfield", with: [mobName, String(selection.cost)] }] }, "1", {defaultValue: "1"});

            quantityForm.show(player).then(qResponse => {
                if (qResponse.canceled) return BuySpawnerMenu(player);

                const amount = parseInt(qResponse.formValues[0]);

                if (isNaN(amount) || amount <= 0) {
                    player.sendMessage({ rawtext: [{ translate: "shop.spawner.message.invalid_quantity" }] });
                    H.playDenied(player);
                    return BuySpawnerMenu(player);
                }

                const totalCost = selection.cost * amount;
                const balance = H.getBalance(player, selection.scoreboard);

                if (balance < totalCost) {
                    player.sendMessage({ rawtext: [{ translate: "shop.spawner.message.cannot_afford", with: [String(amount), String(totalCost)] }] });
                    H.playDenied(player);
                    return BuySpawnerMenu(player);
                }

                const inv = player.getComponent("minecraft:inventory").container;

                try {
                    H.removeBalance(player, selection.scoreboard, totalCost);

                    let remaining = amount;
                    while (remaining > 0) {
                        let giveCount = Math.min(remaining, 64);
                        const item = new ItemStack("sh:mob_spawner", giveCount);
                        item.setLore([selection.mob]);

                        const leftover = inv.addItem(item);
                        if (leftover) player.dimension.spawnItem(leftover, player.location);

                        remaining -= giveCount;
                    }

                    player.sendMessage({ rawtext: [{ translate: "shop.spawner.message.success", with: [String(amount), mobName] }] });
                    player.playSound("random.orb");
                    H.spawnRewardParticle(player.dimension, player.location);

                    BuySpawnerMenu(player);
                } catch (e) {
                    console.warn(e);
                    player.sendMessage({ rawtext: [{ translate: "shop.spawner.message.error" }] });
                }
            });
        });
    });
}