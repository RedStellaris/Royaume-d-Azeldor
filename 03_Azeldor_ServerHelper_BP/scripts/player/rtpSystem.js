import { world, system } from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"
import * as H from "../general/helpers"
import { PlayerMainMenu } from "./playerUi"

export function RtpMenu(player) {
    const cd = player.getDynamicProperty("rtpCd") ?? 0;
    const rad = world.getDynamicProperty("rtpRad") ?? 10000;

    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "rtp.menu.title" }] })
        .body({
            rawtext: [
                { translate: "rtp.menu.body.intro" },
                { text: "\n\n" },
                { translate: "rtp.menu.body.range", with: [String(rad)] },
                { text: "\n" },
                cd > 0
                    ? { translate: "rtp.menu.body.status.cooldown", with: [String(cd)] }
                    : { translate: "rtp.menu.body.status.ready" }
            ]
        });

    const dimSettings = [
        ["§2OVERWORLD§r"],
        ["§4NETHER§r"],
        ["§5THE END§r"]
    ];

    dimSettings.forEach(set => form.button(set[0]));
    form.button({ rawtext: [{ translate: "rtp.menu.button.back" }] }, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === 3) return PlayerMainMenu(player);

        const dims = ["overworld", "nether", "the_end"];
        const combatCache =H.getData("incombat", {});

        if (cd > 0) return player.sendMessage({ rawtext: [{ translate: "rtp.message.cooldown", with: [String(cd)] }] });
        
        const existing = player.dimension.getEntities({ type: "sh:pv" });
        if (existing.some(ent => ent.getDynamicProperty("owner_id") === player.id)) return player.sendMessage({ rawtext: [{ translate: "rtp.message.vault_active" }] });
        
        if (combatCache[player.id]) return player.sendMessage({ rawtext: [{ translate: "rtp.message.in_combat" }] });
        
        if (r.selection === 1 && !world.getDynamicProperty("nether")) return player.sendMessage({ rawtext: [{ translate: "rtp.message.nether_disabled" }] });
        
        if (r.selection === 2 && !world.getDynamicProperty("end")) return player.sendMessage({ rawtext: [{ translate: "rtp.message.end_disabled" }] });
        
        if (r.selection === 1 && !world.getDynamicProperty("rtp_nether")) {
            return player.sendMessage({ rawtext: [{ translate: "rtp.message.nether_rtp_disabled" }] });
        }

        if (r.selection === 2 && !world.getDynamicProperty("rtp_end")) {
            return player.sendMessage({ rawtext: [{ translate: "rtp.message.end_rtp_disabled" }] });
        }
        
        player.setDynamicProperty("rtpCd", world.getDynamicProperty("rtpCd") ?? 300);
        executeRTP(player, dims[r.selection]);
    });
}

export function executeRTP(player, dimId, attempts = 0) {
    const dim = world.getDimension(dimId);
    const rad = (world.getDynamicProperty("rtpRad") ?? 10000) - 200;
    const x = Math.floor(Math.random() * (rad * 2)) - rad;
    const z = Math.floor(Math.random() * (rad * 2)) - rad;

    const startY = (dimId === "nether") ? 70 : 320;
    player.teleport({ x, y: startY, z }, { dimension: dim });

    player.addEffect("resistance", 400, { amplifier: 255, showParticles: false });
    player.addEffect("fire_resistance", 1200, { amplifier: 1, showParticles: false });
    player.addEffect("slow_falling", 400, { amplifier: 1, showParticles: false });

    player.sendMessage({ rawtext: [{ translate: "rtp.message.searching", with: [String(attempts + 1)] }] });

    system.runTimeout(() => {
        try {
            let finalY = -1;

            if (dimId === "nether") {
                for (let y = 120; y > 20; y--) {
                    const block = dim.getBlock({ x, y, z });
                    if (!block) continue;
                    const type = block.typeId;

                    if (type !== "minecraft:air" && type !== "minecraft:lava" &&
                        type !== "minecraft:flowing_lava" && type !== "minecraft:fire" &&
                        type !== "minecraft:magma") {

                        const up1 = dim.getBlock({ x, y: y + 1, z });
                        const up2 = dim.getBlock({ x, y: y + 2, z });
                        if (up1?.typeId.includes("air") && up2?.typeId.includes("air")) {
                            finalY = y + 1;
                            break;
                        }
                    }
                }
            } else {
                const top = dim.getTopmostBlock({ x, z });

                if (top) {
                    const isLiquid = top.typeId.includes("lava") || top.typeId.includes("water");

                    if (dimId === "the_end") {
                        if (top.location.y > 0 && !top.isAir) {
                            finalY = top.location.y + 1;
                        } else {
                            player.sendMessage({ rawtext: [{ translate: "rtp.message.void_detected" }] });
                            return executeRTP(player, dimId, attempts + 1);
                        }
                    }
                    else if (!isLiquid) {
                        finalY = top.location.y + 1;
                    }
                }
            }

            if (finalY === -1) {
                player.sendMessage({ rawtext: [{ translate: "rtp.message.unsafe_terrain" }] });
                return executeRTP(player, dimId, attempts + 1);
            }

            player.teleport({ x, y: finalY, z }, { dimension: dim });
            player.removeEffect("slow_falling");
            system.runTimeout(() => player.removeEffect("resistance"), 40);
            system.runTimeout(() => player.removeEffect("fire_resistance"), 40);

            if (world.getDynamicProperty("combatlog")) {
                let combatCache =H.getData("incombat", {});
                delete combatCache[player.id];
                H.setData("incombat", combatCache);
            }

            player.sendMessage({ rawtext: [{ translate: "rtp.message.safe_landing" }] });

        } catch (e) {
            console.warn(e);
            player.sendMessage({ rawtext: [{ translate: "rtp.message.chunk_error" }] });
            return executeRTP(player, dimId, attempts + 1);
        }
    }, 50);
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if ((player.getDynamicProperty("rtpCd") ?? 0) > 0) player.setDynamicProperty("rtpCd", (player.getDynamicProperty("rtpCd") ?? 0) - 1)
    }
}, 20);