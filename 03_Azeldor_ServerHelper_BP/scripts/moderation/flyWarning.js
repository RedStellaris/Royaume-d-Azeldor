import { system, world } from "@minecraft/server";
import * as H from "../general/helpers";

const SCOREBOARD_NAME = "airtime";
const CHECK_INTERVAL_TICKS = 100;
const WARN_INTERVAL_TICKS = 100;

const lastWarnTime = new Map();

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    lastWarnTime.delete(playerId);
});

function ensureObjective() {
    if (!world.scoreboard.getObjective(SCOREBOARD_NAME)) {
        world.scoreboard.addObjective(SCOREBOARD_NAME);
    }
}

function isOverAirByHeight(dimension, baseX, baseY, baseZ, configHeight) {
    try {
        for (let yOffset = 1; yOffset <= configHeight; yOffset++) {
            const radius = yOffset <= 2 ? 1 : 0;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const block = dimension.getBlock({
                        x: baseX + dx,
                        y: baseY - yOffset,
                        z: baseZ + dz
                    });
                    if (block && !block.isAir) {
                        return false;
                    }
                }
            }
        }
        return true;
    } catch {
        return false;
    }
}

system.runInterval(() => {
    ensureObjective();

    const currentTick = system.currentTick;
    const configHeight = world.getDynamicProperty("minflyheight") ?? 5;
    const configMinTime = world.getDynamicProperty("minflytime") ?? 10;

    for (const player of world.getPlayers()) {
        if (!player.isValid) continue;
        if (H.isOp(player)) continue;

        try {
            const isRiding = player.getComponent("minecraft:riding") !== undefined;

            const isExempt =
                player.isFlying ||
                player.isGliding ||
                isRiding ||
                player.getEffect("levitation") !== undefined ||
                player.getEffect("slow_falling") !== undefined;

            if (isExempt) {
                player.runCommand(`scoreboard players set @s ${SCOREBOARD_NAME} 0`);
                continue;
            }

            const playerLocation = player.getHeadLocation();
            const baseX = Math.floor(playerLocation.x);
            const baseY = Math.floor(playerLocation.y);
            const baseZ = Math.floor(playerLocation.z);
            const dimension = player.dimension;

            const overAirByHeight = isOverAirByHeight(dimension, baseX, baseY, baseZ, configHeight);

            const isAirborne = !player.isOnGround && !player.isInWater && !player.isClimbing;
            const overAirByHover = isAirborne && !player.isFalling;

            if (overAirByHeight || overAirByHover) {
                player.runCommand(`scoreboard players add @s ${SCOREBOARD_NAME} 5`);
            } else {
                player.runCommand(`scoreboard players set @s ${SCOREBOARD_NAME} 0`);
            }

            const currentScore = world.scoreboard.getObjective(SCOREBOARD_NAME)?.getScore(player) ?? 0;

            if (currentScore >= configMinTime) {
                const lastWarn = lastWarnTime.get(player.id) ?? 0;

                if (currentTick - lastWarn >= WARN_INTERVAL_TICKS) {
                    lastWarnTime.set(player.id, currentTick);
                    const reason = overAirByHeight ? "height" : "hover";
                    H.addLog("Fly", { pId: player.id, pName: player.name, reason });
                    try {
                        flyWarn(player, currentScore, reason);
                    } catch (e) {
                    }
                }
            }
        } catch (e) {
        }
    }
}, CHECK_INTERVAL_TICKS);

function flyWarn(player, time, reason = "height") {
    for (const watcher of world.getPlayers()) {
        if (!watcher.isValid) continue;
        if (H.isOp(watcher) && !watcher.hasTag("flywarningdisabled")) {

            H.playDenied(watcher);
            watcher.sendMessage(" ");

            if (time > 60) {
                let min = Math.floor(time / 60);
                let remainingSec = time - (min * 60);

                watcher.sendMessage({
                    rawtext: [{
                        translate: "message.anticheat.fly.warn.minutes",
                        with: [player.name, String(min), String(remainingSec)]
                    }]
                });
            } else {
                watcher.sendMessage({
                    rawtext: [{
                        translate: "message.anticheat.fly.warn.seconds",
                        with: [player.name, String(time)]
                    }]
                });
            }

            watcher.sendMessage({
                rawtext: [{
                    translate: reason === "hover"
                        ? "message.anticheat.fly.warn.reason.hover"
                        : "message.anticheat.fly.warn.reason.height"
                }]
            });

            watcher.sendMessage(" ");
        }
    }
}