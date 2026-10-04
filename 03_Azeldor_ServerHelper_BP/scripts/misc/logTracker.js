import { world, system, Player } from "@minecraft/server";
import * as H from "../general/helpers";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_TICKS = 6000;

function purgeExpiredLogs() {
    H.flushLogs();
    const logData = H.getData("logs", {});
    let changed = false;
    const now = Date.now();

    for (const key in logData) {
        if (now - logData[key].date > ONE_DAY_MS) {
            delete logData[key];
            changed = true;
        }
    }

    if (changed) H.setData("logs", logData);
}

system.run(purgeExpiredLogs);
system.runInterval(purgeExpiredLogs, PURGE_INTERVAL_TICKS);

world.afterEvents.playerJoin.subscribe((event) => {
    H.addLog("Join", { pId: event.playerId, pName: event.playerName });
});

world.beforeEvents.playerLeave.subscribe((event) => {
    H.addLog("Leave", { pId: event.player.id, pName: event.player.name });
});

world.afterEvents.entityDie.subscribe((event) => {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.deadEntity;

    if (!(attacker instanceof Player)) return;
    if (!(victim instanceof Player)) return;
    if (!attacker.isValid || !victim.isValid) return;

    H.addLog("Kill", {
        aId: attacker.id,
        aName: attacker.name,
        tId: victim.id,
        tName: victim.name,
    });
});