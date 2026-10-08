import { system } from "@minecraft/server";

// Particules d'âmes autour de la waystone, toutes les 60 à 84 ticks
system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("azeldor:soul_particles", {
        onTick({ block, dimension }) {
            const { x, y, z } = block.location;
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                try {
                    dimension.spawnParticle("minecraft:soul_particle", {
                        x: x + 0.5 + (Math.random() - 0.5) * 0.8,
                        y: y + 0.3 + Math.random() * 1.2,
                        z: z + 0.5 + (Math.random() - 0.5) * 0.8
                    });
                } catch {}
            }
        }
    });
});
