import { world, system } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import { HologramMenu } from "./customizationUi"
import * as H from "../general/helpers"

export function addleaderboard(player) {
    const data = H.getData("holograms") || {};
    const sbs = H.getScoreboardList(); 
    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.leaderboard.title' }] })
        .textField({ rawtext: [{ translate: 'ui.leaderboard.id' }] }, { rawtext: [{ translate: 'ui.leaderboard.id.example' }] })
        .dropdown({ rawtext: [{ translate: 'ui.leaderboard.objective' }] }, sbs)
        .textField({ rawtext: [{ translate: 'ui.general.coord.x' }] }, { rawtext: [{ translate: 'ui.general.coord.blank' }] })
        .textField({ rawtext: [{ translate: 'ui.general.coord.y' }] }, { rawtext: [{ translate: 'ui.general.coord.blank' }] })
        .textField({ rawtext: [{ translate: 'ui.general.coord.z' }] }, { rawtext: [{ translate: 'ui.general.coord.blank' }] });

    form.show(player).then(r => {
        if (r.canceled) return HologramMenu(player);
        const [id, sbIndex, rawX, rawY, rawZ] = r.formValues;
        const objective = sbs[sbIndex];

        if (!id || !objective) return player.sendMessage({ rawtext: [{ translate: 'message.error.id_objective_required' }] });

        let x = rawX === "" ? player.location.x : Number(rawX);
        let y = rawY === "" ? player.location.y : Number(rawY);
        let z = rawZ === "" ? player.location.z : Number(rawZ);

        const loc = { x, y, z };
        try {
            const ent = player.dimension.spawnEntity("sh:blank", loc);
            ent.nameTag = `§b${id}§r\n§7Loading...`;
            ent.addTag("sh:hologram");

            data[ent.id] = {
                type: "leaderboard",
                id: id,
                objective: objective,
                x: x, y: y, z: z,
                dimension: player.dimension.id 
            };
            H.setData("holograms", data);
            player.sendMessage({ rawtext: [{ translate: 'message.leaderboard.added' }] });
        } catch (e) {
            player.sendMessage({ rawtext: [{ translate: 'message.error.spawn_leaderboard' }] });
        }
    });
}

system.runInterval(() => {
    const data = H.getData("holograms") || {};
    const dimensions = ["overworld", "nether", "the end"];

    for (const dim of dimensions) {
        try {
            const dimension = world.getDimension(dim);
            const entities = dimension.getEntities({ typeId: "sh:blank", tags: ["sh:hologram"] });

            for (const hologram of entities) {
                if (hologram.typeId === "sh:item_display" || !hologram.isValid) continue;

                if (!data[hologram.id]) {
                    hologram.remove();
                    continue;
                }

                const duplicate = entities.find(other =>
                    other.id !== hologram.id &&
                    other.isValid &&
                    Math.abs(other.location.x - hologram.location.x) < 0.1 &&
                    Math.abs(other.location.y - hologram.location.y) < 0.1 &&
                    Math.abs(other.location.z - hologram.location.z) < 0.1
                );

                if (duplicate) duplicate.remove();
            }
        } catch (e) {}
    }
}, 100); 

const formatScore = (num) => num.toString();

const leaderboardTextCache = new Map();
let leaderboardCountdown = 60;

system.runInterval(() => {
    let data = H.getData("holograms") || {};
    let bannedList = H.getData("banned_list") || [];
    let nameCache = H.getData("global_name_cache") || {}; 
    let updatedData = false;
    let updatedCache = false;

    leaderboardCountdown--;
    let refreshScores = false;
    if (leaderboardCountdown <= 0) {
        refreshScores = true;
        leaderboardCountdown = 60;
    }

    for (const oldId in data) {
        const hData = data[oldId];
        let entity = world.getEntity(oldId);

        if (hData.nameCache) {
            delete hData.nameCache;
            updatedData = true;
        }

        if (!entity || !entity.isValid) {
            const dimension = world.getDimension(hData.dimension || "overworld");
            const loc = { x: hData.x, y: hData.y, z: hData.z };

            const playersNearby = dimension.getPlayers({ location: loc, maxDistance: 30 });
            if (playersNearby.length === 0) continue;

            let isChunkLoaded = false;
            try {
                dimension.getBlock(loc); 
                isChunkLoaded = true;
            } catch (e) {}

            if (isChunkLoaded) {
                try {
                    const newEnt = dimension.spawnEntity("sh:blank", loc);
                    newEnt.addTag("sh:hologram");
                    const loadingText = "§7Updating...";
                    newEnt.nameTag = hData.type === "leaderboard" ? `§b${hData.id}§r\n${loadingText}` : hData.text;
                    data[newEnt.id] = hData;
                    delete data[oldId];
                    updatedData = true;
                } catch (e) { continue; }
            }
        } else {
            const targetLoc = { x: hData.x, y: hData.y, z: hData.z };
            if (Math.abs(entity.location.x - targetLoc.x) > 0.05 || Math.abs(entity.location.y - targetLoc.y) > 0.05 || Math.abs(entity.location.z - targetLoc.z) > 0.05) {
                entity.teleport(targetLoc);
            }

            if (hData.type === "leaderboard") {
                const objective = world.scoreboard.getObjective(hData.objective);
                if (objective) {

                    if (refreshScores || !leaderboardTextCache.has(oldId)) {
                        let scores = objective.getScores()
                            .map(s => {
                                const rawName = s.participant.displayName;
                                const id = s.participant.id;
                                const isGarbage = rawName === "commands.scoreboard.players.offlinePlayerName" || (rawName.length > 16 && rawName.includes("-"));

                                let finalName = isGarbage ? (nameCache[id] || "Unknown") : rawName;

                                if (!isGarbage && nameCache[id] !== rawName) {
                                    nameCache[id] = rawName;
                                    updatedCache = true;
                                }

                                return { name: finalName, score: s.score };
                            })
                            .filter(item => item.name && !bannedList.includes(item.name))
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 10);

                        let boardText = `§b${hData.id}§r\n§7§m-----------------§r`;

                        scores.forEach((s, i) => {
                            boardText += `\n§e${i + 1}. §f${s.name}: §a${formatScore(s.score)}`;
                        });

                        leaderboardTextCache.set(oldId, boardText);
                    }
                    
                    const baseText = leaderboardTextCache.get(oldId);
                    const finalText = `${baseText}\n\n§cUpdating in: ${leaderboardCountdown}s`;

                    if (entity.nameTag !== finalText) {
                        entity.nameTag = finalText;
                    }
                }
            }
        }
    }
    
    if (updatedData) H.setData("holograms", data);
    if (updatedCache) H.setData("global_name_cache", nameCache);

}, 20);

export function addHologram(player) {
    const data = H.getData("holograms") || {};
    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.hologram.title' }] })
        .textField({ rawtext: [{ translate: 'ui.hologram.id' }] }, { rawtext: [{ translate: 'ui.hologram.id.example' }] })
        .label({ rawtext: [{ translate: 'ui.hologram.info' }] })
        .textField({ rawtext: [{ translate: 'ui.hologram.line1' }] }, { rawtext: [{ translate: 'ui.hologram.line1.placeholder' }] })
        .textField({ rawtext: [{ translate: 'ui.hologram.line2' }] }, { rawtext: [{ translate: 'ui.hologram.line2.placeholder' }] })
        .textField({ rawtext: [{ translate: 'ui.hologram.line3' }] }, { rawtext: [{ translate: 'ui.hologram.line3.placeholder' }] })
        .textField({ rawtext: [{ translate: 'ui.general.coord.x' }] }, { rawtext: [{ translate: 'ui.general.coord.blank' }] })
        .textField({ rawtext: [{ translate: 'ui.general.coord.y' }] }, { rawtext: [{ translate: 'ui.general.coord.blank' }] })
        .textField({ rawtext: [{ translate: 'ui.general.coord.z' }] }, { rawtext: [{ translate: 'ui.general.coord.blank' }] });

    form.show(player).then(r => {
        if (r.canceled) return HologramMenu(player);
        const [id, , l1, l2, l3, rawX, rawY, rawZ] = r.formValues;

        const textArray = [l1, l2, l3].filter(line => line && line.length > 0);
        let finalMessage = textArray.join("\n").replaceAll("\\n", "\n");

        if (finalMessage.length === 0) return player.sendMessage({ rawtext: [{ translate: 'message.error.hologram_empty' }] });

        let x = rawX === "" ? player.location.x : Number(rawX);
        let y = rawY === "" ? player.location.y : Number(rawY);
        let z = rawZ === "" ? player.location.z : Number(rawZ);

        if (isNaN(x) || isNaN(y) || isNaN(z)) return player.sendMessage({ rawtext: [{ translate: 'message.error.invalid_coords' }] });

        const loc = { x, y: y - 1, z };
        try {
            const ent = player.dimension.spawnEntity("sh:blank", loc);
            ent.nameTag = finalMessage;
            ent.addTag("sh:hologram");

            data[ent.id] = {
                type: "text",
                id: id || "unnamed",
                text: finalMessage,
                x: x, y: y, z: z,
                dimension: player.dimension.id 
            };

            H.setData("holograms", data);
            player.sendMessage({ rawtext: [{ translate: 'message.hologram.placed', with: [String(textArray.length)] }] });
        } catch (e) {
            player.sendMessage({ rawtext: [{ translate: 'message.error.spawn_hologram', with: [String(e)] }] });
        }
    });
}

export function listHolograms(player) {
    const data = H.getData("holograms") || {};
    let bodyRaw = [];

    if (Object.keys(data).length === 0) {
        bodyRaw.push({ translate: 'message.general.none_found' });
    } else {
        for (let key in data) {
            const entry = data[key];
            const typeLabel = entry.type === "leaderboard" ? "§6[LB]" : "§b[TXT]";
            bodyRaw.push({ text: `${typeLabel} Id: ${entry.id}\n§2Pos: ${Math.round(entry.x)}, ${Math.round(entry.y)}, ${Math.round(entry.z)}\n§c-------------------§r\n` });
        }
    }

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.hologram.title' }] })
        .body({ rawtext: bodyRaw })
        .button({ rawtext: [{ translate: 'ui.general.button.back' }] }, "textures/ui/back")
        .show(player).then(() =>  HologramMenu(player));
}

export function removeHologram(player) {
    let data = H.getData("holograms") || {};
    const keys = Object.keys(data);
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.hologram.remove.title' }] });

    if (keys.length === 0) {
        form.body({ rawtext: [{ translate: 'message.general.none_found' }] });
    } else {
        keys.forEach(k => {
            const entry = data[k];
            form.button({ rawtext: [{ text: `${entry.type === "leaderboard" ? "§6LB: " : "§bTXT: "}${entry.id}` }] });
        });
    }

    form.button({ rawtext: [{ translate: 'ui.general.button.back' }] }, "textures/ui/back").show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return  HologramMenu(player);
        const selectedId = keys[r.selection];
        const entity = world.getEntity(selectedId);
        if (entity && entity.isValid) entity.remove();
        delete data[selectedId];
        H.setData("holograms", data);
        removeHologram(player);
    });
}