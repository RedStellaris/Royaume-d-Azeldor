import { system, world, EntityComponentTypes } from "@minecraft/server";

function formatItemName(item) {
    if (!item.isValid) return { name: "Unknown", amount: 1 };
    
    try {
        const comp = item.getComponent(EntityComponentTypes.Item);
        if (!comp || !comp.itemStack) return { name: "Unknown", amount: 1 };

        const name = comp.itemStack.typeId.split(":")[1].replace(/_/g, " ");
        const amount = comp.itemStack.amount;
        return { name, amount };
    } catch (e) {
        return { name: "Unknown", amount: 1 };
    }
}

function checkRay(start, end, dimension) {
    const viewVector = {
        x: end.x - start.x,
        y: end.y - start.y,
        z: end.z - start.z
    };

    const distance = Math.sqrt(viewVector.x ** 2 + viewVector.y ** 2 + viewVector.z ** 2);
    if (distance === 0) return true;

    const direction = {
        x: viewVector.x / distance,
        y: viewVector.y / distance,
        z: viewVector.z / distance
    };

    const hit = dimension.getBlockFromRay(start, direction, {
        maxDistance: distance + 2,
        includePassableBlocks: false,
        includeLiquidBlocks: false
    });

    return hit === undefined;
}

function hasLineOfSight(player, item) {
    if (!player.isValid || !item.isValid) return false;
    
    try {
        const start = player.getHeadLocation();
        const bottomTarget = {
            x: item.location.x,
            y: item.location.y + 0.15,
            z: item.location.z
        };

        if (checkRay(start, bottomTarget, player.dimension)) return true;
        
        const topTarget = {
            x: item.location.x,
            y: item.location.y + 0.75,
            z: item.location.z
        };

        if (checkRay(start, topTarget, player.dimension)) return true;

        return false;
    } catch (e) {
        return false;
    }
}

function updateOrSpawnTag(item, existingTag = null) {
    if (!item.isValid) return;
    
    try {
        const { name, amount } = formatItemName(item);
        let tag = existingTag;

        if (!tag || !tag.isValid) {
            try {
                tag = item.dimension.spawnEntity("sh:item_nametags", item.location);
                if (tag.isValid) {
                    tag.setDynamicProperty("item_id", item.id);
                    tag.nameTag = `§b${amount}§dx §f${name}`;
                    item.setDynamicProperty("last_amount", amount);
                }
                return;
            } catch (e) { return; }
        }

        try {
            if (tag.isValid) {
                tag.teleport(item.location);

                const lastAmount = item.getDynamicProperty("last_amount");
                if (lastAmount !== amount) {
                    tag.nameTag = `§b${amount}§dx §f${name}`;
                    item.setDynamicProperty("last_amount", amount);
                }
            }
        } catch (e) { }
    } catch (e) { }
}

system.runInterval(() => {
    if (world.getDynamicProperty("itemNames") === false) {
        for (const player of world.getAllPlayers()) {
            if (!player.isValid) continue;
            
            const nearbyTags = player.dimension.getEntities({
                location: player.location,
                maxDistance: 30,
                type: "sh:item_nametags"
            });
            
            for (const tag of nearbyTags) {
                if (tag.isValid) tag.remove();
            }
        }
        return;
    }

    const visibleItems = new Map();
    const nearbyTags = new Map();

    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;
        const dimension = player.dimension;

        const items = dimension.getEntities({
            location: player.location,
            maxDistance: 10,
            type: "minecraft:item"
        });

        const tags = dimension.getEntities({
            location: player.location,
            maxDistance: 15,
            type: "sh:item_nametags"
        });

        for (const tag of tags) {
            if (tag.isValid) nearbyTags.set(tag.id, tag);
        }

        for (const item of items) {
            if (!item.isValid || visibleItems.has(item.id)) continue;
            
            if (hasLineOfSight(player, item)) {
                visibleItems.set(item.id, item);
            }
        }
    }

    const itemToTagMap = new Map();
    const unlinkedTags = [];

    for (const tag of nearbyTags.values()) {
        if (!tag.isValid) continue;
        
        try {
            const linkedItemId = tag.getDynamicProperty("item_id");
            if (linkedItemId) {
                itemToTagMap.set(linkedItemId, tag);
            } else {
                unlinkedTags.push(tag);
            }
        } catch (e) { }
    }

    for (const [itemId, itemEntity] of visibleItems) {
        if (!itemEntity.isValid) continue;
        const matchingTag = itemToTagMap.get(itemId);

        if (matchingTag) {
            updateOrSpawnTag(itemEntity, matchingTag);
            nearbyTags.delete(matchingTag.id);
        } else {
            updateOrSpawnTag(itemEntity, null);
        }
    }
    
    for (const tag of nearbyTags.values()) {
        if (tag.isValid) tag.remove();
    }

    for (const tag of unlinkedTags) {
        if (tag.isValid) tag.remove();
    }

}, 2);