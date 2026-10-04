import { world, system } from "@minecraft/server"
import * as H from "../general/helpers"

export function freezePlayer(admin, target) {
    if (target.hasTag("frozen")) {
        admin.sendMessage({ rawtext: [{ translate: "message.freeze.already_frozen" }] });
        H.playDenied(admin);
    } else {
        target.addTag("frozen");
        admin.sendMessage({ rawtext: [{ translate: "message.freeze.success", with: [target.name] }] });
        H.playClick(admin);
        if (target.isValid) {
            target.playSound("random.glass");
            try {
                target.dimension.spawnParticle("minecraft:ice_evaporation_particle", { x: target.location.x, y: target.location.y + 1, z: target.location.z });
            } catch (e) { }
        }
    }
}

export function unfreezePlayer(admin, target) {
    if (!target.hasTag("frozen")) return;
    target.removeTag("frozen");
    admin.sendMessage({ rawtext: [{ translate: "message.unfreeze.success" }] });
    H.playCancel(admin);
    if (target.isValid) {
        target.playSound("random.glass");
        try {
            target.dimension.spawnParticle("minecraft:knockback_roar_particle", { x: target.location.x, y: target.location.y + 1, z: target.location.z });
        } catch (e) { }
    }
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag("frozen")) {
            player.teleport(player.location);
            // title removed
            if (system.currentTick % 10 === 0) {
                try {
                    player.dimension.spawnParticle("minecraft:ice_evaporation_particle", {
                        x: player.location.x + (Math.random() - 0.5) * 0.6,
                        y: player.location.y + 1 + Math.random() * 0.8,
                        z: player.location.z + (Math.random() - 0.5) * 0.6
                    });
                } catch (e) { }
            }
        }
    }
}, 1);