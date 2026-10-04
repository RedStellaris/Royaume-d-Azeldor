import { world, system, ItemStack, EntityItemComponent } from "@minecraft/server";
const CONFIG = {
    dimensions: ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"],
    cleanupInterval: 1200, // Ticks between cleanups (20 ticks = 1 second)
    maxEntitiesPerChunk: 50,
    maxIdleTime: 12000, // 10 minutes
    despawnFarEntities: true,
    maxDistanceFromPlayers: 128,
    distanceCheckInterval: 2400,
    maxItemsPerChunk: 30,
    warnItemRemoval: true,
    warnDistance: 5,
    mergeItemsDistance: 3.5,
    limitArrows: true,
    maxArrowsPerChunk: 20,
    limitXpOrbs: true,
    maxXpOrbsPerChunk: 50,
    limitMinecarts: true,
    maxMinecartsPerChunk: 5,
    limitBoats: true,
    maxBoatsPerChunk: 5,
    limitHoppers: true,
    maxHoppersPerChunk: 10,
};
let tickCount = 0;
let performanceStats = {
    entityCount: 0,
    itemCount: 0,
    itemsMerged: 0,
    itemsRemoved: 0,
    xpRemoved: 0,
    idleEntitiesRemoved: 0,
    farEntitiesRemoved: 0,
    hoppersRemoved: 0,
    lastCleanup: 0,
    lastDistanceCheck: 0
};
let cleanupEnabled = true;
system.runInterval(() => {
    tickCount++;
    if (cleanupEnabled) {
        if (tickCount % CONFIG.cleanupInterval === 0) {
            performanceStats.itemsMerged = 0;
            performanceStats.itemsRemoved = 0;
            performanceStats.xpRemoved = 0;
            performanceStats.idleEntitiesRemoved = 0;
            performanceStats.hoppersRemoved = 0;
            performCleanup();
            optimizeEntities();
            if (CONFIG.limitHoppers) manageHoppers();
        }
        if (tickCount % CONFIG.distanceCheckInterval === 0 && CONFIG.despawnFarEntities) {
            performanceStats.farEntitiesRemoved = 0;
            despawnFarEntities();
        }
    }
}, 1);
try {
    world.afterEvents.entitySpawn.subscribe((event) => {
        try {
            const entity = event.entity;
            if (entity && entity.isValid() && entity.typeId !== "minecraft:player") {
                entity.setDynamicProperty("lastActivity", tickCount);
            }
        } catch (error) { }
    });
} catch (e) { }
try {
    world.beforeEvents.entityHurt.subscribe((event) => {
        try {
            const entity = event.hurtEntity;
            if (entity && entity.isValid() && entity.typeId !== "minecraft:player") {
                entity.setDynamicProperty("lastActivity", tickCount);
            }
        } catch (error) { }
    });
} catch (e) { }
try {
    world.afterEvents.entityHitEntity.subscribe((event) => {
        try {
            const entity = event.damagingEntity;
            if (entity && entity.isValid() && entity.typeId !== "minecraft:player") {
                entity.setDynamicProperty("lastActivity", tickCount);
            }
        } catch (error) { }
    });
} catch (e) { }
try {
    world.afterEvents.playerSpawn.subscribe((event) => {
        try {
            const player = event.player;
            if (player && player.isValid()) {
                player.setDynamicProperty("joinTime", tickCount);
                player.setDynamicProperty("lastActivity", tickCount);
                system.runTimeout(() => {
                    if (player.isValid()) {
                        player.sendMessage("§aServer optimized for performance! Enjoy lag-free gameplay.");
                    }
                }, 40);
            }
        } catch (error) { }
    });
} catch (e) { }
try {
    world.afterEvents.playerBreakBlock.subscribe((event) => {
        if (event.player && event.player.isValid()) {
            event.player.setDynamicProperty("lastActivity", tickCount);
        }
    });
} catch (e) { }
try {
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
        if (event.player && event.player.isValid()) {
            event.player.setDynamicProperty("lastActivity", tickCount);
        }
    });
} catch (e) { }
function performCleanup() {
    let totalItemsRemoved = 0;
    let totalXpRemoved = 0;
    let totalEntitiesRemovedByIdle = 0;
    let totalWarningsSent = 0;
    let totalItemsMerged = 0;
    for (const dimName of CONFIG.dimensions) {
        try {
            const dimension = world.getDimension(dimName);
            if (!dimension) continue;
            const allEntities = dimension.getEntities();
            const chunkGroups = new Map();
            for (const entity of allEntities) {
                if (!entity.isValid()) continue;
                const chunkKey = `${Math.floor(entity.location.x / 16)},${Math.floor(entity.location.z / 16)}`;
                if (!chunkGroups.has(chunkKey)) {
                    chunkGroups.set(chunkKey, { entities: [], items: [], xpOrbs: [] });
                }
                const group = chunkGroups.get(chunkKey);
                group.entities.push(entity);
                if (entity.typeId === "minecraft:item") {
                    group.items.push(entity);
                } else if (entity.typeId === "minecraft:xp_orb") {
                    group.xpOrbs.push(entity);
                }
            }
            for (const [chunkKey, group] of chunkGroups) {
                for (const entity of group.entities) {
                    if (!entity.isValid()) continue;
                    if (entity.typeId !== "minecraft:player") {
                        const lastActivity = entity.getDynamicProperty("lastActivity");
                        if (lastActivity !== undefined && tickCount - lastActivity > CONFIG.maxIdleTime) {
                            try {
                                entity.remove();
                                totalEntitiesRemovedByIdle++;
                            } catch (e) { }
                        }
                    }
                }
                const itemResult = handleItemsInChunk(dimension, group.items, chunkKey);
                totalItemsRemoved += itemResult.removed;
                totalItemsMerged += itemResult.merged;
                const xpResult = handleXpOrbsInChunk(dimension, group.xpOrbs, chunkKey);
                totalXpRemoved += xpResult.removed;
                if (CONFIG.warnItemRemoval && group.items.length > CONFIG.maxItemsPerChunk) {
                    const validItems = group.items.filter(i => i.isValid());
                    if (validItems.length > 0) {
                        try {
                            const playersNearby = dimension.getPlayers({
                                location: validItems[0].location,
                                maxDistance: CONFIG.warnDistance
                            });
                            if (playersNearby.length > 0) {
                                playersNearby.forEach(p => p.sendMessage(`§eWarning: Too many items here! Cleanup imminent.`));
                                totalWarningsSent++;
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (error) { }
    }
    performanceStats.lastCleanup = tickCount;
    performanceStats.itemsRemoved = totalItemsRemoved;
    performanceStats.itemsMerged = totalItemsMerged;
    performanceStats.xpRemoved = totalXpRemoved;
    performanceStats.idleEntitiesRemoved = totalEntitiesRemovedByIdle;
}
function handleItemsInChunk(dimension, items, chunkKey) {
    let removed = 0;
    let merged = 0;
    let validItems = items.filter(i => i.isValid());
    const mergeResult = mergeNearbyItems(validItems, CONFIG.mergeItemsDistance);
    merged = mergeResult.merged;
    removed += mergeResult.removed;
    validItems = validItems.filter(i => i.isValid());
    if (validItems.length > CONFIG.maxItemsPerChunk) {
        validItems.sort((a, b) => {
            const actA = a.getDynamicProperty("lastActivity") || 0;
            const actB = b.getDynamicProperty("lastActivity") || 0;
            return actA - actB;
        });
        const excessCount = validItems.length - CONFIG.maxItemsPerChunk;
        const toRemove = validItems.slice(0, excessCount);
        toRemove.forEach(item => {
            try {
                if (item.isValid()) {
                    item.remove();
                    removed++;
                }
            } catch (e) { }
        });
    }
    return { removed, merged };
}
function handleXpOrbsInChunk(dimension, xpOrbs, chunkKey) {
    let removed = 0;
    const validOrbs = xpOrbs.filter(o => o.isValid());
    if (validOrbs.length > CONFIG.maxXpOrbsPerChunk) {
        validOrbs.sort((a, b) => {
            const actA = a.getDynamicProperty("lastActivity") || 0;
            const actB = b.getDynamicProperty("lastActivity") || 0;
            return actA - actB;
        });
        const excessCount = validOrbs.length - CONFIG.maxXpOrbsPerChunk;
        const toRemove = validOrbs.slice(0, excessCount);
        toRemove.forEach(orb => {
            try {
                if (orb.isValid()) {
                    orb.remove();
                    removed++;
                }
            } catch (e) { }
        });
    }
    return { removed };
}
function mergeNearbyItems(items, mergeDistance) {
    let removedCount = 0;
    let mergedCount = 0;
    const processed = new Set();
    for (let i = 0; i < items.length; i++) {
        if (processed.has(i) || !items[i].isValid()) continue;
        const itemA = items[i];
        const itemCompA = itemA.getComponent('minecraft:item');
        if (!itemCompA || !itemCompA.itemStack) continue;
        let stackA = itemCompA.itemStack;
        for (let j = i + 1; j < items.length; j++) {
            if (processed.has(j) || !items[j].isValid()) continue;
            const itemB = items[j];
            try {
                const distance = getDistance(itemA.location, itemB.location);
                if (distance <= mergeDistance) {
                    const itemCompB = itemB.getComponent('minecraft:item');
                    if (!itemCompB || !itemCompB.itemStack) continue;
                    let stackB = itemCompB.itemStack;
                    if (stackA.typeId === stackB.typeId) {
                        const maxStackSize = stackA.maxAmount;
                        const canAdd = maxStackSize - stackA.amount;
                        if (canAdd > 0) {
                            const willAdd = Math.min(canAdd, stackB.amount);
                            stackA.amount += willAdd;
                            stackB.amount -= willAdd;
                            mergedCount++;
                            itemCompA.itemStack = stackA;
                            if (stackB.amount <= 0) {
                                itemB.remove();
                                processed.add(j);
                                removedCount++;
                            } else {
                                itemCompB.itemStack = stackB;
                            }
                            if (stackA.amount >= maxStackSize) break;
                        }
                    }
                }
            } catch (e) { }
        }
        processed.add(i);
    }
    return { removed: removedCount, merged: mergedCount };
}
function getDistance(loc1, loc2) {
    if (!loc1 || !loc2) return 999;
    const dx = loc1.x - loc2.x;
    const dy = loc1.y - loc2.y;
    const dz = loc1.z - loc2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function optimizeEntities() {
    let totalRemoved = 0;
    for (const dimName of CONFIG.dimensions) {
        try {
            const dimension = world.getDimension(dimName);
            if (!dimension) continue;
            const entities = dimension.getEntities({ excludeTypes: ["minecraft:player"] });
            const chunks = new Map();
            for (const entity of entities) {
                if (!entity.isValid()) continue;
                const chunkKey = `${Math.floor(entity.location.x / 16)},${Math.floor(entity.location.z / 16)}`;
                if (!chunks.has(chunkKey)) chunks.set(chunkKey, []);
                chunks.get(chunkKey).push(entity);
            }
            for (const [chunkKey, chunkEntities] of chunks) {
                const validEntities = chunkEntities.filter(e => e.isValid());
                if (validEntities.length > CONFIG.maxEntitiesPerChunk) {
                    validEntities.sort((a, b) => getEntityPriority(a.typeId) - getEntityPriority(b.typeId));
                    const toRemove = validEntities.slice(0, validEntities.length - CONFIG.maxEntitiesPerChunk);
                    toRemove.forEach(entity => {
                        try { entity.remove(); totalRemoved++; } catch (e) { }
                    });
                }
                const remaining = validEntities.filter(e => e.isValid());
                if (CONFIG.limitArrows) applySpecificLimit(remaining, "minecraft:arrow", CONFIG.maxArrowsPerChunk);
                if (CONFIG.limitMinecarts) applySpecificLimit(remaining, "minecart", CONFIG.maxMinecartsPerChunk);
                if (CONFIG.limitBoats) applySpecificLimit(remaining, "boat", CONFIG.maxBoatsPerChunk);
            }
        } catch (error) { }
    }
}
function applySpecificLimit(entities, typeIdentifier, maxCount) {
    const targets = entities.filter(e => e.typeId.includes(typeIdentifier));
    if (targets.length > maxCount) {
        const excess = targets.slice(0, targets.length - maxCount);
        excess.forEach(e => {
            try { e.remove(); } catch (err) { }
        });
    }
}
function despawnFarEntities() {
    let farRemoved = 0;
    const players = world.getAllPlayers();
    if (players.length === 0) return;
    for (const dimName of CONFIG.dimensions) {
        try {
            const dimension = world.getDimension(dimName);
            if (!dimension) continue;
            const playersInDim = players.filter(p => p.dimension.id === dimension.id);
            if (playersInDim.length === 0) continue;
            const entities = dimension.getEntities({ excludeTypes: ["minecraft:player", "minecraft:item", "minecraft:xp_orb"] });
            for (const entity of entities) {
                if (!entity.isValid()) continue;
                if (getEntityPriority(entity.typeId) >= 80) continue;
                let nearestDistance = 99999;
                for (const player of playersInDim) {
                    try {
                        const dist = getDistance(entity.location, player.location);
                        if (dist < nearestDistance) nearestDistance = dist;
                    } catch (e) { }
                }
                if (nearestDistance > CONFIG.maxDistanceFromPlayers) {
                    const lastActivity = entity.getDynamicProperty("lastActivity");
                    if (lastActivity === undefined || tickCount - lastActivity > 600) {
                        try { entity.remove(); farRemoved++; } catch (e) { }
                    }
                }
            }
        } catch (error) { }
    }
}
function getEntityPriority(typeId) {
    const priorities = {
        "minecraft:villager": 90, "minecraft:iron_golem": 85,
        "minecraft:horse": 80, "minecraft:donkey": 80, "minecraft:mule": 80, "minecraft:llama": 80, "minecraft:cat": 75, "minecraft:wolf": 75, "minecraft:parrot": 75,
        "minecraft:cow": 70, "minecraft:sheep": 70, "minecraft:pig": 70, "minecraft:chicken": 70,
        "minecraft:allay": 90, "minecraft:axolotl": 80,
        "minecraft:boat": 40, "minecraft:minecart": 30, "minecraft:arrow": 20, "minecraft:xp_orb": 15, "minecraft:item": 10
    };
    if (typeId.includes("zombie") || typeId.includes("skeleton") || typeId.includes("creeper") || typeId.includes("spider") || typeId.includes("witch") || typeId.includes("slime")) {
        return 45;
    }
    for (const [key, value] of Object.entries(priorities)) {
        if (typeId.includes(key.replace("minecraft:", ""))) return value;
    }
    return 50;
}
function manageHoppers() {
    let hoppersRemoved = 0;
    for (const dimName of CONFIG.dimensions) {
        try {
            const dimension = world.getDimension(dimName);
            if (!dimension) continue;
            const hoppers = dimension.getEntities({ type: "minecraft:hopper_minecart" });
            const hopperChunks = new Map();
            for (const hopper of hoppers) {
                if (!hopper.isValid()) continue;
                const chunkKey = `${Math.floor(hopper.location.x / 16)},${Math.floor(hopper.location.z / 16)}`;
                if (!hopperChunks.has(chunkKey)) hopperChunks.set(chunkKey, []);
                hopperChunks.get(chunkKey).push(hopper);
            }
            for (const [chunkKey, chunkHoppers] of hopperChunks) {
                if (chunkHoppers.length > CONFIG.maxHoppersPerChunk) {
                    const excess = chunkHoppers.slice(0, chunkHoppers.length - CONFIG.maxHoppersPerChunk);
                    excess.forEach(h => {
                        try { h.remove(); hoppersRemoved++; } catch (e) { }
                    });
                }
            }
        } catch (error) { }
    }
}
