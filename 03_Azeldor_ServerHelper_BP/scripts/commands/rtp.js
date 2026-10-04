import { world, system } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "rtp",
    description: "Teleport randomly across dimensions",
    usage: [
        {
            name: "dimension",
            type: ["overworld", "nether", "the_end"],
            optional: false
        },
    ]
};

registerCommand(commandInformation, (origin, dimension) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    const combatCache = H.getData("incombat") || {};
    const cd = sender.getDynamicProperty("rtpCd") ?? 0;

    if (cd > 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.rtp.on_cooldown", with: [String(cd)] }] });
        return;
    }
    if (combatCache[sender.id]) {
        sender.sendMessage({ rawtext: [{ translate: "command.rtp.no_combat" }] });
        return;
    }

    const existing = sender.dimension.getEntities({ type: "sh:pv" });
    if (existing.some(ent => ent.getDynamicProperty("owner_id") === sender.id)) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.vault_teleport_blocked" }] });
        return;
    }
    if (dimension === "nether" && !world.getDynamicProperty("nether")) {
        sender.sendMessage({ rawtext: [{ translate: "command.rtp.nether_disabled" }] });
        return;
    }
    if (dimension === "the_end" && !world.getDynamicProperty("end")) {
        sender.sendMessage({ rawtext: [{ translate: "command.rtp.end_disabled" }] });
        return;
    }

    if (dimension === "nether" && !world.getDynamicProperty("rtp_nether")) {
        sender.sendMessage({ rawtext: [{ translate: "command.rtp.nether_rtp_disabled" }] });
        return;
    }

    if (dimension === "the_end" && !world.getDynamicProperty("rtp_end")) {
        sender.sendMessage({ rawtext: [{ translate: "command.rtp.end_rtp_disabled" }] });
        return;
    }

    system.run(() => {
        sender.setDynamicProperty("rtpCd", world.getDynamicProperty("rtpCd") ?? 300);
        executeRTP(sender, dimension);
    });
});

function executeRTP(player, dimId, attempts = 0) {
    const dim = world.getDimension(dimId);
    const rad = (world.getDynamicProperty("rtpRad") ?? 10000) - 200;
    const x = Math.floor(Math.random() * (rad * 2)) - rad;
    const z = Math.floor(Math.random() * (rad * 2)) - rad;

    const startY = (dimId === "nether") ? 70 : 320;
    if (attempts === 0) H.spawnTeleportBurst(player.dimension, player.location);
    player.teleport({ x, y: startY, z }, { dimension: dim });

    player.addEffect("resistance", 400, { amplifier: 255, showParticles: false });
    player.addEffect("fire_resistance", 1200, { amplifier: 1, showParticles: false });
    player.addEffect("slow_falling", 400, { amplifier: 1, showParticles: false });

    player.sendMessage({ rawtext: [{ translate: "message.rtp.searching", with: [String(attempts + 1)] }] });

    system.runTimeout(() => {
        try {
            if (!player.isValid) return;

            let finalY = -1;

            if (dimId === "nether") {
                for (let y = 120; y > 20; y--) {
                    const block = dim.getBlock({ x, y, z });
                    if (!block || block.isAir) continue;

                    const type = block.typeId;
                    const dangerBlocks = ["minecraft:lava", "minecraft:flowing_lava", "minecraft:fire", "minecraft:magma"];
                    if (dangerBlocks.includes(type)) continue;

                    const up1 = dim.getBlock({ x, y: y + 1, z });
                    const up2 = dim.getBlock({ x, y: y + 2, z });
                    if (up1?.isAir && up2?.isAir) {
                        finalY = y + 1;
                        break;
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
                            player.sendMessage({ rawtext: [{ translate: "message.rtp.void_retry" }] });
                            return executeRTP(player, dimId, attempts + 1);
                        }
                    } else if (!isLiquid) {
                        finalY = top.location.y + 1;
                    }
                }
            }

            if (finalY === -1) {
                player.sendMessage({ rawtext: [{ translate: "message.rtp.unsafe_retry" }] });
                return executeRTP(player, dimId, attempts + 1);
            }

            player.teleport({ x, y: finalY, z }, { dimension: dim });
            H.spawnTeleportBurst(dim, { x, y: finalY, z });
            player.playSound("mob.endermen.portal");
            player.removeEffect("slow_falling");

            system.runTimeout(() => {
                if (player.isValid) {
                    player.removeEffect("resistance");
                    player.removeEffect("fire_resistance");
                }
            }, 40);

            if (world.getDynamicProperty("combatlog")) {
                let combatCache = H.getData("incombat") || {};
                delete combatCache[player.id];
                H.setData("incombat", combatCache);
            }

            player.sendMessage({ rawtext: [{ translate: "message.rtp.success" }] });

        } catch (e) {
            console.warn(`RTP Error: ${e}`);
            player.sendMessage({ rawtext: [{ translate: "message.rtp.chunk_error_retry" }] });
            return executeRTP(player, dimId, attempts + 1);
        }
    }, 50);
}

export default commandInformation;
