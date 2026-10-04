import { world, Player } from "@minecraft/server";
import * as H from "../general/helpers";

const reachViolations = new Map();

function getDistance(loc1, loc2) {
    const dx = loc2.x - loc1.x;
    const dy = loc2.y - loc1.y;
    const dz = loc2.z - loc1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    const { damagingEntity, hitEntity } = event;

    if (!damagingEntity?.isValid || !hitEntity?.isValid) return;
    if (!(damagingEntity instanceof Player)) return;
    
    const player = damagingEntity;
    const playerName = player.name;

    const distance = getDistance(player.location, hitEntity.location);
    const reachThreshold = world.getDynamicProperty("reachdistance") ?? 5;

    if (distance > reachThreshold) {
        let data = reachViolations.get(playerName) ?? { count: 0, maxDist: 0 };
        data.count++;
        
        if (distance > data.maxDist) {
            data.maxDist = distance;
        }
        
        reachViolations.set(playerName, data);

        if (data.count >= 5) {
            reachWarn(player, data.maxDist);
            H.addLog("AntiReach", { pId: player.id, pName: player.name });
            reachViolations.delete(playerName);
        }
    } else {
        let data = reachViolations.get(playerName);
        if (data && data.count > 0) {
            data.count--;
            reachViolations.set(playerName, data);
        }
    }
});

function reachWarn(player, distance) {
    const roundedDist = distance.toFixed(2);
    
    for (const watcher of world.getPlayers()) {
        if (!watcher.isValid) continue;

        if (H.isOp(watcher) || (watcher.hasTag("helper") && !watcher.hasTag("reachwarningdisabled"))) {
            
            const message = { 
                rawtext: [{ 
                    translate: "anticheat.warning.reach", 
                    with: [player.name, roundedDist] 
                }] 
            };
            
            watcher.sendMessage(message);
            H.playDenied(watcher);
            
            if (world.getDynamicProperty("reachkick")) {
                player.runCommand("kick @s %anticheat.kick.reach");
            }
        }
    }
}

world.beforeEvents.playerLeave.subscribe((event) => {
    reachViolations.delete(event.player.name);
});