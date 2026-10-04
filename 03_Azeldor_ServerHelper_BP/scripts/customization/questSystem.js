import { world, system, Player, MolangVariableMap } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";
import { CustomizationMenu } from "./customizationUi";

const QUEST_TYPES = ["Kill Entities", "Kill Players", "Break Blocks", "Gather Items", "Travel Distance"];
const TRAVEL_MILESTONE = 50;
const QUEST_TICK_INTERVAL = 20;

export function questsMenu(player) {
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.quests.title' }] })
        .body({ rawtext: [{ translate: 'ui.quests.menu.body' }] })
        .button({ rawtext: [{ translate: 'ui.quests.menu.button.new' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'ui.quests.menu.button.edit' }] }, "textures/ui/gear")
        .button({ rawtext: [{ translate: 'ui.quests.menu.button.list' }] }, "textures/items/book_writable")
        .button({ rawtext: [{ translate: 'ui.quests.menu.button.remove' }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: 'ui.button.back_double' }] });

    form.show(player).then(r => {
        if (r.canceled || r.selection === 4) return system.run(() => CustomizationMenu(player));

        system.run(() => {
            switch (r.selection) {
                case 0: addQuest(player); break;
                case 1: editQuests(player); break;
                case 2: listQuests(player); break;
                case 3: removeQuest(player); break;
            }
        });
    });
}

export function addQuest(player) {
    const quests = H.getData("quests") || {};

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.quests.add.title' }] })
        .textField({ rawtext: [{ translate: 'ui.quests.add.name_label' }] }, { rawtext: [{ translate: 'ui.quests.add.name_placeholder' }] })
        .dropdown({ rawtext: [{ translate: 'ui.quests.add.type_label' }] }, QUEST_TYPES)
        .textField({ rawtext: [{ translate: 'ui.quests.add.tracked_label' }] }, { rawtext: [{ translate: 'ui.quests.add.tracked_placeholder' }] })
        .textField({ rawtext: [{ translate: 'ui.quests.add.amount_label' }] }, { rawtext: [{ translate: 'ui.quests.add.amount_placeholder' }] });

    form.show(player).then(r => {
        if (r.canceled) return system.run(() => questsMenu(player));

        const [name, typeIndex, tracked, amount] = r.formValues;
        const type = QUEST_TYPES[typeIndex];

        if (!name || !tracked || !amount) {
            return player.sendMessage("§cMissing required fields.");
        }
        if (isNaN(amount) || Number(amount) <= 0) {
            return player.sendMessage("§cAmount must be a positive number.");
        }
        
        const nameExists = Object.values(quests).some(q => q.Name === name);
        if (nameExists) {
            return player.sendMessage(`§cA quest named "${name}" already exists.`);
        }

        system.run(() => {
            const uniqueId = `quest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            quests[uniqueId] = {
                Name: name,
                Type: type,
                Tracked: tracked,
                Amount: Number(amount),
                RewardScoreboard: "None",
                RewardScoreboardAmount: 0
            };
            H.setData("quests", quests);

            const questItems = H.getData("questItems") || {};
            questItems[uniqueId] = [];
            H.setData("questItems", questItems);

            player.sendMessage(`§aQuest "${name}" created.`);
            questsMenu(player);
        });
    });
}

export function editQuests(player) {
    const quests = H.getData("quests") || {};
    const keys = Object.keys(quests);

    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.quests.edit.title' }] });

    if (keys.length === 0) {
        form.body({ rawtext: [{ translate: 'ui.quests.edit.none_found' }] });
    } else {
        for (const id of keys) {
            form.button({ rawtext: [{ text: `§b${quests[id].Name}` }] }, "textures/items/map");
        }
    }
    form.button({ rawtext: [{ translate: 'ui.button.back_double' }] });

    form.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return system.run(() => questsMenu(player));
        system.run(() => manageQuest(player, keys[r.selection]));
    });
}

function manageQuest(player, questId) {
    const quests = H.getData("quests") || {};
    const questItems = H.getData("questItems") || {};
    const currentQuest = quests[questId];

    if (!currentQuest) {
        player.sendMessage(`§cThat quest no longer exists.`);
        return editQuests(player);
    }

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: currentQuest.Name }] })
        .button({ rawtext: [{ translate: 'ui.quests.manage.button.add_item' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'ui.quests.manage.button.load_item_set' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'ui.quests.manage.button.remove_items' }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: 'ui.quests.manage.button.edit_details' }] }, "textures/ui/gear")
        .button({ rawtext: [{ translate: 'ui.quests.manage.button.edit_scoreboard' }] }, "textures/items/diamond")
        .button({ rawtext: [{ translate: 'ui.button.back_double' }] })
        .show(player).then(res => {
            if (res.canceled || res.selection === 5) return system.run(() => editQuests(player));

            system.run(() => {
                switch (res.selection) {
                    case 0: return handleAddItem(player, questId, currentQuest.Name, questItems);
                    case 1: return handleLoadItemSet(player, questId, currentQuest.Name, questItems);
                    case 2: return handleRemoveItems(player, questId, currentQuest.Name, questItems);
                    case 3: return handleEditDetails(player, questId, quests);
                    case 4: return handleEditScoreboard(player, questId, quests);
                }
            });
        });
}

function handleAddItem(player, questId, questName, questItems) {
    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: questName }] })
        .textField({ rawtext: [{ translate: 'ui.quests.manage.add.item_id_label' }] }, { rawtext: [{ translate: 'ui.quests.manage.add.item_id_placeholder' }] })
        .textField({ rawtext: [{ translate: 'ui.quests.manage.add.cover_name_label' }] }, { rawtext: [{ translate: 'ui.quests.manage.add.cover_name_placeholder' }] })
        .textField({ rawtext: [{ translate: 'ui.quests.manage.add.quantity_label' }] }, { rawtext: [{ translate: 'ui.quests.manage.add.quantity_placeholder' }] })
        .textField("Potion Type (Optional)", "e.g. healing / minecraft:swiftness")
        .textField("Potion Delivery (Optional)", "Consume / Splash / Lingering")
        .show(player).then(itemRes => {
            if (itemRes.canceled) return system.run(() => manageQuest(player, questId));

            const [itemId, name, amount, potion, delivery] = itemRes.formValues;
            if ((!itemId && !potion) || !amount) {
                return player.sendMessage("§cMissing standard fields or Potion details.");
            }

            const numAmount = Number(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                return player.sendMessage("§cQuantity must be a positive number.");
            }

            system.run(() => {
                if (!questItems[questId]) questItems[questId] = [];

                const itemPayload = {
                    name: name || (potion ? `${delivery || "Consume"} ${potion}` : itemId),
                    id: itemId || "minecraft:potion",
                    amount: numAmount
                };

                if (potion) {
                    itemPayload.potion = potion;
                    itemPayload.delivery = delivery || "Consume";
                }

                questItems[questId].push(itemPayload);
                H.setData("questItems", questItems);
                player.sendMessage(`§aAdded ${itemId || potion} to "${questName}"'s rewards.`);
                manageQuest(player, questId);
            });
        });
}

function handleLoadItemSet(player, questId, questName, questItems) {
    const itemSets = H.getData("itemSets", {});
    const itemSetIds = Object.keys(itemSets);

    if (itemSetIds.length === 0) {
        player.sendMessage("§cNo Item Sets found. Create one first.");
        return manageQuest(player, questId);
    }

    const setForm = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.quests.manage.loadSet.title' }] });

    for (const id of itemSetIds) setForm.button({ rawtext: [{ text: id }] }, "textures/ui/color_plus");
    setForm.button({ rawtext: [{ translate: 'ui.button.back_double' }] });

    setForm.show(player).then(setRes => {
        if (setRes.canceled || setRes.selection === itemSetIds.length) return system.run(() => manageQuest(player, questId));

        const selectedId = itemSetIds[setRes.selection];
        const selectedSet = itemSets[selectedId];

        system.run(() => {
            if (!questItems[questId]) questItems[questId] = [];

            let addedCount = 0;
            for (const item of selectedSet.items) {
                const cleanName = item.typeId.replace("minecraft:", "");

                const payload = {
                    name: cleanName,
                    id: item.typeId,
                    amount: item.amount,
                    enchants: item.enchants
                };

                if (item.potion) {
                    payload.potion = item.potion;
                    payload.delivery = item.delivery || "Consume";
                }

                questItems[questId].push(payload);
                addedCount++;
            }

            H.setData("questItems", questItems);
            player.sendMessage(`§aAdded ${addedCount} items from "${selectedId}" to "${questName}"'s rewards.`);
            manageQuest(player, questId);
        });
    });
}

function handleRemoveItems(player, questId, questName, questItems) {
    const itemsList = questItems[questId] || [];
    const removeItemForm = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.quests.manage.removeItems.title' }] });

    for (const item of itemsList) {
        const displayName = item.potion ? `${item.delivery || "Consume"} Potion of ${item.potion}` : item.id.split(":")[1];
        removeItemForm.button({ rawtext: [{ text: `${displayName} (x${item.amount})` }] });
    }
    removeItemForm.button({ rawtext: [{ translate: 'ui.button.admin_back' }] }, "textures/ui/back");

    removeItemForm.show(player).then(removeRes => {
        if (removeRes.canceled || removeRes.selection === itemsList.length) return system.run(() => manageQuest(player, questId));

        system.run(() => {
            const removedItem = itemsList[removeRes.selection];

            itemsList.splice(removeRes.selection, 1);
            questItems[questId] = itemsList;
            H.setData("questItems", questItems);

            player.sendMessage(`§aRemoved ${removedItem.potion || removedItem.id} from "${questName}"'s rewards.`);
            manageQuest(player, questId);
        });
    });
}

function handleEditDetails(player, questId, quests) {
    const current = quests[questId];
    const typeIndex = Math.max(QUEST_TYPES.indexOf(current.Type), 0);

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: current.Name }] })
        .dropdown({ rawtext: [{ translate: 'ui.quests.manage.editDetails.type_label' }] }, QUEST_TYPES, { defaultValueIndex: typeIndex })
        .textField({ rawtext: [{ translate: 'ui.quests.manage.editDetails.tracked_label' }] }, "", { defaultValue: String(current.Tracked ?? "") })
        .textField({ rawtext: [{ translate: 'ui.quests.manage.editDetails.amount_label' }] }, "", { defaultValue: String(current.Amount ?? "") })
        .show(player).then(editRes => {
            if (editRes.canceled) return system.run(() => manageQuest(player, questId));

            const [newTypeIndex, tracked, amount] = editRes.formValues;
            if (!tracked || !amount || isNaN(amount) || Number(amount) <= 0) {
                player.sendMessage("§cInvalid details provided.");
                return system.run(() => manageQuest(player, questId));
            }

            system.run(() => {
                current.Type = QUEST_TYPES[newTypeIndex];
                current.Tracked = tracked;
                current.Amount = Number(amount);
                H.setData("quests", quests);

                player.sendMessage(`§aUpdated details for "${current.Name}".`);
                manageQuest(player, questId);
            });
        });
}

function handleEditScoreboard(player, questId, quests) {
    const sbs = ["None", ...(H.getScoreboardList() || [])];
    const current = quests[questId];
    let defIndex = sbs.indexOf(current.RewardScoreboard);
    if (defIndex === -1) defIndex = 0;

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: current.Name }] })
        .dropdown({ rawtext: [{ translate: 'ui.quests.manage.editScoreboard.scoreboard_label' }] }, sbs, { defaultValueIndex: defIndex })
        .textField({ rawtext: [{ translate: 'ui.quests.manage.editScoreboard.amount_label' }] }, "", { defaultValue: String(current.RewardScoreboardAmount ?? "0") })
        .show(player).then(sbRes => {
            if (sbRes.canceled) return system.run(() => manageQuest(player, questId));

            const [sbIndex, amount] = sbRes.formValues;
            const scoreboard = sbs[sbIndex];

            if (scoreboard !== "None" && (isNaN(amount) || Number(amount) < 0)) {
                player.sendMessage("§cInvalid amount provided.");
                return system.run(() => manageQuest(player, questId));
            }

            system.run(() => {
                current.RewardScoreboard = scoreboard;
                current.RewardScoreboardAmount = Number(amount) || 0;
                H.setData("quests", quests);

                player.sendMessage(`§aUpdated scoreboard reward for "${current.Name}".`);
                manageQuest(player, questId);
            });
        });
}

export function listQuests(player) {
    const quests = H.getData("quests") || {};
    const questItems = H.getData("questItems") || {};
    let rawtextBody = [{ text: "§8§m" + "—".repeat(25) + "§r\n" }];
    let hasQuests = false;

    for (const id in quests) {
        hasQuests = true;
        const quest = quests[id];
        const itemsList = questItems[id] || [];

        rawtextBody.push({ text: `§3${quest.Name.toUpperCase()}§r\n` });
        rawtextBody.push({ text: `§7Type: §f${quest.Type} §8| §7Tracked: §f${quest.Tracked} §8| §7Amount: §f${quest.Amount}\n` });

        if (quest.RewardScoreboard && quest.RewardScoreboard !== "None") {
            rawtextBody.push({ text: `§7Scoreboard Reward: §a${quest.RewardScoreboardAmount} ${quest.RewardScoreboard}\n` });
        }

        rawtextBody.push({ translate: 'ui.quests.list.items_header' });

        if (itemsList.length === 0) {
            rawtextBody.push({ translate: 'ui.quests.list.none' });
        } else {
            for (const item of itemsList) {
                const descriptor = item.potion ? `${item.delivery || "Consume"} Potion [${item.potion}]` : item.id;
                rawtextBody.push({ text: `\n §8• §f${descriptor} §7(x${item.amount})` });
            }
            rawtextBody.push({ text: "\n" });
        }
        rawtextBody.push({ text: "§8§m" + "—".repeat(25) + "§r\n" });
    }

    if (!hasQuests) {
        rawtextBody = [{ translate: 'ui.quests.list.empty' }];
    }

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.quests.list.title' }] })
        .body({ rawtext: rawtextBody })
        .button({ rawtext: [{ translate: 'ui.button.back_double' }] })
        .show(player).then(r => {
            if (r.canceled || r.selection === 0) return system.run(() => questsMenu(player));
        });
}

export function removeQuest(player) {
    const quests = H.getData("quests") || {};
    const keys = Object.keys(quests);
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.quests.remove.title' }] });

    if (keys.length === 0) {
        form.body({ rawtext: [{ translate: 'ui.quests.list.empty' }] });
    } else {
        for (const id of keys) form.button({ rawtext: [{ text: quests[id].Name }] });
    }
    form.button({ rawtext: [{ translate: 'ui.button.admin_back' }] }, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return system.run(() => questsMenu(player));
        if (!keys[r.selection]) return player.sendMessage("§cThat quest no longer exists.");

        system.run(() => {
            const selection = keys[r.selection];

            delete quests[selection];
            H.setData("quests", quests);

            const questItems = H.getData("questItems") || {};
            delete questItems[selection];
            H.setData("questItems", questItems);

            removeQuest(player);
        });
    });
}

const questDataCache = new Map();

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    questDataCache.delete(playerId);
});

function getQuestData(player) {
    const raw = player.getDynamicProperty("activeQuests");
    const cached = questDataCache.get(player.id);
    if (cached && cached.raw === raw) return cached.parsed;

    let questData;
    try {
        questData = raw ? JSON.parse(raw) : {};
    } catch (e) {
        questData = {};
    }
    questDataCache.set(player.id, { raw, parsed: questData });
    return questData;
}

function saveQuestData(player, questData) {
    const str = JSON.stringify(questData);
    player.setDynamicProperty("activeQuests", str);
    questDataCache.set(player.id, { raw: str, parsed: questData });
}

function markQuestCompleted(player, id) {
    const raw = player.getDynamicProperty("completedQuests");
    let completed = [];
    try {
        completed = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    if (!completed.includes(id)) {
        completed.push(id);
        player.setDynamicProperty("completedQuests", JSON.stringify(completed));
    }
}

function progressQuest(player, quest, id, newProgress, { milestoneOnly = false } = {}) {
    const previous = quest.progress || 0;
    const clamped = Math.min(newProgress, quest.Amount);

    if (clamped <= previous) return { updated: false, completed: false };

    quest.progress = clamped;
    const justCompleted = clamped >= quest.Amount;

    if (justCompleted) {
        markQuestCompleted(player, id);
        celebrateQuestComplete(player, quest, id);
    } else if (!milestoneOnly || Math.floor(clamped / TRAVEL_MILESTONE) > Math.floor(previous / TRAVEL_MILESTONE)) {
        player.sendMessage(`§e${quest.Name || id} progress: ${Math.floor(clamped)} / ${quest.Amount}§r`);
    }

    return { updated: true, completed: justCompleted };
}

function celebrateQuestComplete(player, quest, id) {
    player.sendMessage(`§aQuest Complete: ${quest.Name || id}!§r`);
    H.spawnRewardParticle(player.dimension, player.location);
    H.playSuccess(player);

    const loc = player.location;
    try {
        player.dimension.spawnParticle("minecraft:totem_particle", { x: loc.x, y: loc.y + 1, z: loc.z }, new MolangVariableMap());
        player.dimension.spawnParticle("minecraft:villager_happy", { x: loc.x, y: loc.y + 1.2, z: loc.z }, new MolangVariableMap());
        player.playSound("random.levelup", { pitch: 1.1 });
        player.playSound("random.orb", { pitch: 1.3, volume: 0.6 });
        );
    } catch (e) {}

    grantQuestReward(player, quest);
}

function grantQuestReward(player, quest) {
    const rewardItems = quest.rewardItems ?? [];

    if (rewardItems.length) {
        const container = player.getComponent("minecraft:inventory")?.container;
        for (const itemData of rewardItems) {
            try {
                const itemStack = H.createItemStackFromData(itemData, itemData.amount);
                if (!itemStack) continue;
                const leftover = container?.addItem(itemStack);
                if (leftover) player.dimension.spawnItem(leftover, player.location);
            } catch (e) {
                console.warn(`Failed to give quest reward item "${itemData.id || itemData.potion}" to ${player.name}: ` + e);
            }
        }
    }

    if (quest.RewardScoreboard && quest.RewardScoreboard !== "None" && Number(quest.RewardScoreboardAmount) > 0) {
        try {
            player.runCommand(`scoreboard players add "${player.name}" "${quest.RewardScoreboard}" ${Number(quest.RewardScoreboardAmount)}`);
        } catch (e) {
            console.warn(`Failed to grant scoreboard reward to ${player.name}: ` + e);
        }
    }
}

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    const player = damageSource.damagingEntity;

    if (!(player instanceof Player) || !player.isValid) return;

    const questData = getQuestData(player);
    if (!questData || Object.keys(questData).length === 0) return;

    let questsUpdated = false;

    for (const id in questData) {
        const quest = questData[id];
        if (quest.Type !== "Kill Entities" && quest.Type !== "Kill Players") continue;
        if (quest.Type === "Kill Players" && !(deadEntity instanceof Player)) continue;
        if (deadEntity.typeId !== quest.Tracked) continue;
        if ((quest.progress || 0) >= quest.Amount) continue;

        const result = progressQuest(player, quest, id, (quest.progress || 0) + 1);
        if (result.updated) questsUpdated = true;
        if (result.completed) delete questData[id];
    }

    if (questsUpdated) saveQuestData(player, questData);
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, brokenBlockPermutation } = event;
    if (!player.isValid) return;

    const questData = getQuestData(player);
    if (!questData || Object.keys(questData).length === 0) return;

    let questsUpdated = false;

    for (const id in questData) {
        const quest = questData[id];
        if (quest.Type !== "Break Blocks") continue;
        if (brokenBlockPermutation.type.id !== quest.Tracked) continue;
        if ((quest.progress || 0) >= quest.Amount) continue;

        const result = progressQuest(player, quest, id, (quest.progress || 0) + 1);
        if (result.updated) questsUpdated = true;
        if (result.completed) delete questData[id];
    }

    if (questsUpdated) saveQuestData(player, questData);
});

const playerLastLocations = {};

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;

        const currentLoc = player.location;
        const lastLoc = playerLastLocations[player.id];
        playerLastLocations[player.id] = { x: currentLoc.x, y: currentLoc.y, z: currentLoc.z };

        const questData = getQuestData(player);
        if (!questData || Object.keys(questData).length === 0) continue;

        let distanceTraveled = 0;
        if (lastLoc) {
            const dx = currentLoc.x - lastLoc.x;
            const dy = currentLoc.y - lastLoc.y;
            const dz = currentLoc.z - lastLoc.z;
            distanceTraveled = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        let questsUpdated = false;
        let inventory;

        for (const id in questData) {
            const quest = questData[id];
            if ((quest.progress || 0) >= quest.Amount) continue;

            if (quest.Type === "Gather Items") {
                inventory ??= player.getComponent("inventory")?.container;
                if (!inventory) continue;

                let itemCount = 0;
                for (let i = 0; i < inventory.size; i++) {
                    const item = inventory.getItem(i);
                    if (item && item.typeId === quest.Tracked) itemCount += item.amount;
                }

                if (itemCount >= quest.Amount) {
                    let amountToRemove = quest.Amount;
                    for (let i = 0; i < inventory.size && amountToRemove > 0; i++) {
                        const item = inventory.getItem(i);
                        if (item && item.typeId === quest.Tracked) {
                            if (item.amount > amountToRemove) {
                                item.amount -= amountToRemove;
                                inventory.setItem(i, item);
                                amountToRemove = 0;
                            } else {
                                amountToRemove -= item.amount;
                                inventory.setItem(i, undefined);
                            }
                        }
                    }
                    
                    const result = progressQuest(player, quest, id, quest.Amount);
                    if (result.updated) questsUpdated = true;
                    if (result.completed) delete questData[id];
                }
            }

            if (quest.Type === "Travel Distance" && distanceTraveled > 0) {
                const newProgress = (quest.progress || 0) + distanceTraveled;
                const result = progressQuest(player, quest, id, newProgress, { milestoneOnly: true });
                if (result.updated) questsUpdated = true;
                if (result.completed) delete questData[id];
            }
        }

        if (questsUpdated) saveQuestData(player, questData);
    }
}, QUEST_TICK_INTERVAL);

world.afterEvents.playerLeave.subscribe((event) => {
    delete playerLastLocations[event.playerId];
});