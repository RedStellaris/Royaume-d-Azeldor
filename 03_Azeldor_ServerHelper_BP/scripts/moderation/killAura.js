import { world, Player } from "@minecraft/server";
import * as H from "../general/helpers"

const violations = new Map();
const cpsData = new Map();

function getAngleFromVector(x, z) {
    let angle = Math.atan2(x, z) * (180 / Math.PI);
    return (angle + 360) % 360;
}

function getRelativeDegree(damagingEntity, hitEntity) {
    const view = damagingEntity.getViewDirection();
    const lookAngle = getAngleFromVector(view.x, view.z);

    const dx = hitEntity.location.x - damagingEntity.location.x;
    const dz = hitEntity.location.z - damagingEntity.location.z;
    const targetAngle = getAngleFromVector(dx, dz);
    let relative = targetAngle - lookAngle;

    if (relative > 180) relative -= 360;
    if (relative < -180) relative += 360;

    return relative;
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    const { damagingEntity, hitEntity } = event;

    if (!damagingEntity?.isValid || !hitEntity?.isValid) return;
    if (!(damagingEntity instanceof Player)) return;
    
    const player = damagingEntity;
    const playerName = player.name;

    const relativeDeg = Math.abs(Math.round(getRelativeDegree(player, hitEntity)));
    const angleThreshold = world.getDynamicProperty("minkillauradeg") ?? 30;

    if (relativeDeg > angleThreshold) {
        let data = violations.get(playerName) ?? { count: 0, maxDeg: 0 };
        data.count++;
        if (relativeDeg > data.maxDeg) data.maxDeg = relativeDeg;
        violations.set(playerName, data);

        if (data.count >= 5) {
            killAuraWarn(player, data.maxDeg);
            H.addLog("KillAura", { pId: player.id, pName: player.name });
            violations.delete(playerName);
        }
    }

    const cpsThreshold = world.getDynamicProperty("max_cps") ?? 30;
    let pCps = cpsData.get(playerName) ?? { hits: 0, startTime: Date.now() };

    pCps.hits++;
    const elapsed = Date.now() - pCps.startTime;

    if (elapsed >= 1000) {
        const finalCps = Math.round((pCps.hits * 1000) / elapsed);
        if (finalCps > cpsThreshold) {
            cpsWarn(player, finalCps);
        }
        cpsData.set(playerName, { hits: 0, startTime: Date.now() });
    } else {
        cpsData.set(playerName, pCps);
    }
});

function killAuraWarn(player, deg) {
    for (const watcher of world.getPlayers()) {
        if (!watcher.isValid) continue;

        if (H.isOp(watcher) || watcher.hasTag("helper") && !watcher.hasTag("killaurawarningdisabled")) {
            
            const message = { 
                rawtext: [{ 
                    translate: "anticheat.warning.killaura", 
                    with: [player.name, deg.toString()] 
                }] 
            };
            watcher.sendMessage(message);
            H.playDenied(watcher);
            
            if (world.getDynamicProperty("aurakick")) {
                player.runCommand("kick @s %anticheat.kick.killaura");
            }
        }
    }
}

function cpsWarn(player, cps) {
    for (const watcher of world.getPlayers()) {
        if (!watcher.isValid) continue;

        if (H.isOp(watcher) || watcher.hasTag("helper") || watcher.hasTag("dev") && !watcher.hasTag("killaurawarningdisabled")) {
            
            const message = { 
                rawtext: [{ 
                    translate: "anticheat.warning.cps", 
                    with: [player.name, cps.toString()] 
                }] 
            };
            watcher.sendMessage(message);
            H.playDenied(watcher);
            
            if (world.getDynamicProperty("cpskick")) {
                player.runCommand("kick @s %anticheat.kick.cps");
            }
        }
    }
}

world.beforeEvents.playerLeave.subscribe((event) => {
    violations.delete(event.player.name);
    cpsData.delete(event.player.name);
});