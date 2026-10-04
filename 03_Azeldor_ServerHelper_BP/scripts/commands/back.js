import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

world.afterEvents.entityDie.subscribe((event) => {
    const player = event.deadEntity;
    if (!(player instanceof Player)) return;

    const loc = player.location;
    const deathData = {
        x: Math.floor(loc.x),
        y: Math.floor(loc.y),
        z: Math.floor(loc.z),
        dimension: player.dimension.id,
        time: Date.now()
    };

    H.setData(`death_${player.id}`, deathData);
});

const commandInformation = {
    name: "back",
    description: "Teleport to your last death location",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player || !(player instanceof Player)) return;

    if (!world.getDynamicProperty("back")) {
        player.sendMessage({ rawtext: [{ translate: "command.back.disabled" }] });
        return;
    }

    const combatCache = H.getData("incombat") || {};
    if (combatCache[player.id]) {
        player.sendMessage({ rawtext: [{ translate: "command.general.combat_teleport_blocked" }] });
        return;
    }

    const existing = player.dimension.getEntities({ type: "sh:pv" });
    if (existing.some(ent => ent.getDynamicProperty("owner_id") === player.id)) {
        player.sendMessage({ rawtext: [{ translate: "command.general.vault_teleport_blocked" }] });
        return;
    }

    const deathLoc = H.getData(`death_${player.id}`);

    if (!deathLoc) {
        player.sendMessage({ rawtext: [{ translate: "command.back.no_death_location" }] });
        return;
    }

    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() - deathLoc.time > tenMinutes) {
        H.setData(`death_${player.id}`, undefined);
        player.sendMessage({ rawtext: [{ translate: "command.back.location_expired" }] });
        return;
    }

    const delay = world.getDynamicProperty("teleportTime") ?? 3;
    const startLoc = player.location;
    const startDimension = player.dimension;
    let ticks = 0;

    player.sendMessage({ rawtext: [{ translate: "message.back.teleporting", with: [String(delay)] }] });

    for (let i = delay - 1; i > 0; i--) {
        system.runTimeout(() => {
            if (!player.isValid) return;
            player.runCommand("playsound note.chime @s");
            try {
                player.dimension.spawnParticle("minecraft:endrod", { x: player.location.x, y: player.location.y + 0.1, z: player.location.z });
            } catch (e) { }
        }, (delay - i) * 20);
    }

    const runId = system.runInterval(() => {
        if (!world.getAllPlayers().includes(player) || Math.hypot(player.location.x - startLoc.x, player.location.z - startLoc.z) > 0.5) {
            player.sendMessage({ rawtext: [{ translate: "command.back.teleport_cancelled" }] });
            H.playCancel(player);
            system.clearRun(runId);
            return;
        }

        ticks++;
        if (ticks >= delay * 20) {
            system.clearRun(runId);

            const dim = world.getDimension(deathLoc.dimension);
            H.spawnTeleportBurst(startDimension, startLoc);
            player.teleport({ x: deathLoc.x, y: deathLoc.y + 1, z: deathLoc.z }, { dimension: dim });
            H.spawnTeleportBurst(dim, { x: deathLoc.x, y: deathLoc.y, z: deathLoc.z });
            player.runCommand("playsound mob.endermen.portal @s");

            H.setData(`death_${player.id}`, undefined);
            player.sendMessage({ rawtext: [{ translate: "message.back.teleported" }] });
        }
    }, 1);
});

export default commandInformation;
