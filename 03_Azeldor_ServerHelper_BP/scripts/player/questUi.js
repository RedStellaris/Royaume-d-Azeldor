import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";

const QUEST_TYPE_ICON = {
    "Kill Entities": "textures/items/diamond_sword",
    "Kill Players": "textures/items/iron_sword",
    "Break Blocks": "textures/items/diamond_pickaxe",
    "Gather Items": "textures/items/bundle",
    "Travel Distance": "textures/items/chorus_fruit"
};

const MAX_ACTIVE_QUESTS = 3;

function readActiveQuests(player) {
    const raw = player.getDynamicProperty("activeQuests");
    let questData;

    try {
        questData = raw ? JSON.parse(raw) : {};
    } catch (e) {
        questData = {};
    }

    if (questData.Quest || questData.Type) {
        console.warn(`Wiping corrupted quest database for ${player.name}`);
        player.setDynamicProperty("activeQuests", "{}");
        return {};
    }

    return questData;
}

function readCompletedQuests(player) {
    const raw = player.getDynamicProperty("completedQuests");
    try {
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

export function QuestMenu(player) {
    if (!player.isValid) return;

    const quests = H.getData("quests") || {};
    const templateIds = Object.keys(quests);

    if (templateIds.length === 0) {
        player.sendMessage("§eNo quests are available right now. Check back later!§r");
        return;
    }

    const activeQuests = readActiveQuests(player);
    const completedQuests = readCompletedQuests(player);
    const form = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "ui.quests.title" }] });

    templateIds.forEach(id => {
        const base = quests[id];
        const active = activeQuests[id];
        const isCompleted = completedQuests.includes(id);
        const icon = QUEST_TYPE_ICON[base.Type] ?? "textures/items/map";

        let statusStr = "";
        if (isCompleted) {
            statusStr = "§7[ Completed ]";
        } else if (active) {
            statusStr = `§a[ Active ] ${Math.floor(active.progress)} / ${active.Amount}`;
        } else {
            statusStr = "§e[ Available ]";
        }

        form.button({ rawtext: [{ text: `§l${base.Name || id}§r\n${statusStr}` }] }, icon);
    });

    form.show(player).then(response => {
        if (response.canceled || response.selection === undefined) return;
        if (!player.isValid) return;

        const selectedId = templateIds[response.selection];

        system.run(() => {
            QuestDetailsMenu(player, selectedId, quests, activeQuests, completedQuests);
        });
    });
}

function QuestDetailsMenu(player, questId, quests, activeQuests, completedQuests) {
    if (!player.isValid) return;

    const base = quests[questId];
    const questItems = H.getData("questItems") || {};
    const items = questItems[questId] || [];
    const active = activeQuests[questId];
    const isCompleted = completedQuests.includes(questId);

    let bodyText = `§3--- Quest Details ---§r\n`;
    bodyText += `§7Action: §f${base.Type}\n`;
    bodyText += `§7Target: §f${base.Tracked}\n`;
    
    if (active) {
        bodyText += `§7Progress: §a${Math.floor(active.progress)} / ${base.Amount}§r\n\n`;
    } else {
        bodyText += `§7Required: §f${base.Amount}\n\n`;
    }

    bodyText += `§3--- Rewards ---§r\n`;
    let hasRewards = false;

    if (base.RewardScoreboard && base.RewardScoreboard !== "None" && base.RewardScoreboardAmount > 0) {
        bodyText += ` §8• §e+${base.RewardScoreboardAmount} ${base.RewardScoreboard}§r\n`;
        hasRewards = true;
    }

    if (items.length > 0) {
        items.forEach(item => {
            const displayName = item.potion ? `Potion of ${item.potion}` : (item.name || item.id.split(":")[1] || item.id);
            bodyText += ` §8• §b${item.amount}x §f${displayName}§r\n`;
        });
        hasRewards = true;
    }

    if (!hasRewards) {
        bodyText += ` §8• §7No specific rewards.§r\n`;
    }

    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: base.Name || questId }] })
        .body(bodyText);

    if (isCompleted) {
        form.button("§8Already Completed", "textures/ui/check");
    } else if (active) {
        form.button("§cAbandon Quest", "textures/ui/cancel");
    } else {
        form.button("§aAccept Quest", "textures/ui/confirm");
    }
    
    form.button("§7Back to Quests", "textures/ui/back");

    form.show(player).then(res => {
        if (res.canceled || !player.isValid) return;

        system.run(() => {
            if (res.selection === 1 || isCompleted) {
                return QuestMenu(player);
            }

            if (active) {
                abandonQuest(player, questId, base.Name);
            } else {
                tryAcceptQuest(player, questId, base, items, activeQuests);
            }
        });
    });
}

function tryAcceptQuest(player, id, base, rewardItems, activeQuests) {
    if (Object.keys(activeQuests).length >= MAX_ACTIVE_QUESTS) {
        player.sendMessage(`§cYou can only have ${MAX_ACTIVE_QUESTS} active quests at once. Complete or abandon one first!§r`);
        return QuestMenu(player);
    }

    activeQuests[id] = {
        ...base,
        Amount: Number(base.Amount),
        rewardItems,
        progress: 0
    };

    player.setDynamicProperty("activeQuests", JSON.stringify(activeQuests));
    player.sendMessage(`§aQuest accepted: ${base.Name || id}!§r`);
    
    QuestMenu(player); 
}

function abandonQuest(player, id, questName) {
    const raw = player.getDynamicProperty("activeQuests");
    if (!raw) return QuestMenu(player);
    
    let questData = JSON.parse(raw);
    delete questData[id];
    
    player.setDynamicProperty("activeQuests", JSON.stringify(questData));
    player.sendMessage(`§cQuest abandoned: ${questName || id}. Progress was lost.§r`);
    
    QuestMenu(player);
}