import { world, system } from "@minecraft/server";
import * as H from "../general/helpers"

const DIMS = ["overworld", "nether", "the_end"];
const EXCLUDE_TYPES = [
    "minecraft:item", "minecraft:wolf", "minecraft:villager",
    "minecraft:armor_stand", "minecraft:player", "sh:blank",
    "sh:item_nametags", "minecraft:cat", "minecraft:parrot",
    "minecraft:minecart", "sh:auction_house_ent", "sh:bazaar_ent",
    "sh:spawner", "sh:pv", "sh:spawnerv2", "sh:inventory", "sh:item_display",
    "minecraft:boat", "minecraft:npc"
];

const NAME_CACHE = new Map();

function getCleanName(typeId) {
    if (NAME_CACHE.has(typeId)) return NAME_CACHE.get(typeId);
    const cleanName = typeId.replace("minecraft:", "").replace(/_/g, " ").toUpperCase();
    NAME_CACHE.set(typeId, cleanName);
    return cleanName;
}

function hasCustomNameTag(entity) {
    if (!entity.nameTag) return false;
    return !entity.nameTag.includes("§dx §f");
}

system.runInterval(() => {
    if (!world.getDynamicProperty("mobStack")) return;

    const radius = world.getDynamicProperty("mobStackRadius") ?? 4;
    const radiusSq = radius * radius;

    for (const dimId of DIMS) {
        const dimension = world.getDimension(dimId);
        let entities;
        try {
            entities = dimension.getEntities({ excludeTypes: EXCLUDE_TYPES });
        } catch (e) { continue; }

        const grid = new Map();

        for (const entity of entities) {
            if (!entity || !entity.isValid || hasCustomNameTag(entity)) continue;

            const loc = entity.location;
            const cx = Math.floor(loc.x / radius);
            const cy = Math.floor(loc.y / radius);
            const cz = Math.floor(loc.z / radius);

            let typeGrid = grid.get(entity.typeId);
            if (!typeGrid) { typeGrid = new Map(); grid.set(entity.typeId, typeGrid); }

            const cellKey = `${cx},${cy},${cz}`;
            let cell = typeGrid.get(cellKey);
            if (!cell) { cell = []; typeGrid.set(cellKey, cell); }
            cell.push(entity);
        }

        const removed = new Set();

        for (const typeGrid of grid.values()) {
            for (const [cellKey, cell] of typeGrid) {
                const [cx, cy, cz] = cellKey.split(",").map(Number);

                for (const entity of cell) {
                    if (removed.has(entity.id) || !entity.isValid) continue;

                    try {
                        let currentStack = entity.getDynamicProperty("stack_size") ?? 1;
                        let merged = false;
                        const eLoc = entity.location;

                        for (let dx = -1; dx <= 1; dx++)
                        for (let dy = -1; dy <= 1; dy++)
                        for (let dz = -1; dz <= 1; dz++) {
                            const neighbors = typeGrid.get(`${cx + dx},${cy + dy},${cz + dz}`);
                            if (!neighbors) continue;

                            for (const ent of neighbors) {
                                if (ent.id === entity.id || removed.has(ent.id) || !ent.isValid) continue;

                                const oLoc = ent.location;
                                const ddx = oLoc.x - eLoc.x;
                                const ddy = oLoc.y - eLoc.y;
                                const ddz = oLoc.z - eLoc.z;
                                const distSq = ddx * ddx + ddy * ddy + ddz * ddz;
                                if (distSq > radiusSq || distSq < 0.01) continue;

                                const targetStack = ent.getDynamicProperty("stack_size") ?? 1;
                                currentStack += targetStack;

                                removed.add(ent.id);
                                ent.remove();
                                merged = true;
                            }
                        }

                        if (merged || entity.getDynamicProperty("stack_size") === undefined) {
                            entity.setDynamicProperty("stack_size", currentStack);

                            if (currentStack > 1) {
                                entity.nameTag = `§b${currentStack}§dx §f${getCleanName(entity.typeId)}`;
                            } else if (entity.nameTag && entity.nameTag.includes("§dx §f")) {
                                entity.nameTag = "";
                            }
                        }
                    } catch (e) {
                        console.warn(`[MobStacker] Error processing entity ${entity.typeId}: ${e}`);
                    }
                }
            }
        }
    }
}, 10);

world.afterEvents.entityDie.subscribe((event) => {
    const deadEnt = event.deadEntity;
    
    try {
        const currentSize = deadEnt.getDynamicProperty("stack_size") ?? 1;
        if (currentSize <= 1) return;

        const newSize = currentSize - 1;
        const dimension = deadEnt.dimension;
        const typeId = deadEnt.typeId;
        const loc = deadEnt.location;

        system.run(() => {
            const ent = dimension.spawnEntity(typeId, { x: loc.x, y: loc.y - 0.2, z: loc.z });
            
            if (ent && ent.isValid) {
                ent.setDynamicProperty("stack_size", newSize);
                if (newSize > 1) {
                    ent.nameTag = `§b${newSize}§dx §f${getCleanName(ent.typeId)}`;
                }
            }
        });
    } catch (e) {}
});