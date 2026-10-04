import { world, system } from "@minecraft/server";
import { ModalFormData, MessageFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";

const IGNORED_ENTITIES = new Set([
    "minecraft:item", "minecraft:wolf", "minecraft:villager",
    "minecraft:armor_stand", "minecraft:player","minecraft:cat", "minecraft:parrot",
    "minecraft:minecart", "minecraft:arrow", "minecraft:snowball", "minecraft:ender_pearl"
]);


function getCachedAdminClaims() {
    try {
        const data = world.getDynamicProperty("admin_claims");
        if (data && typeof data === "string") {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn("Failed to parse admin claims.");
    }
    return [];
}

function saveAdminClaims(claims) {
    world.setDynamicProperty("admin_claims", JSON.stringify(claims));
}

function getCachedAllowAreas() {
    try {
        const data = world.getDynamicProperty("admin_allow_areas");
        if (data && typeof data === "string") {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn("Failed to parse allow areas.");
    }
    return [];
}

function saveAllowAreas(areas) {
    world.setDynamicProperty("admin_allow_areas", JSON.stringify(areas));
}

function isInside3D(loc, zone) {
    const minX = Math.min(zone.x1, zone.x2);
    const maxX = Math.max(zone.x1, zone.x2);
    const minY = Math.min(zone.y1, zone.y2);
    const maxY = Math.max(zone.y1, zone.y2);
    const minZ = Math.min(zone.z1, zone.z2);
    const maxZ = Math.max(zone.z1, zone.z2);

    return loc.x >= minX && loc.x <= maxX &&
           loc.y >= minY && loc.y <= maxY &&
           loc.z >= minZ && loc.z <= maxZ;
}

function isInside2D(loc, claim) {
    const minX = Math.min(claim.x1, claim.x2);
    const maxX = Math.max(claim.x1, claim.x2);
    const minZ = Math.min(claim.z1, claim.z2);
    const maxZ = Math.max(claim.z1, claim.z2);

    return loc.x >= minX && loc.x <= maxX &&
           loc.z >= minZ && loc.z <= maxZ;
}

function getClaimSize(claim) {
    const width = Math.abs(claim.x1 - claim.x2) + 1;
    const length = Math.abs(claim.z1 - claim.z2) + 1;
    return width * length;
}

function isOverlapping(newClaim, existingClaim) {
    const minX1 = Math.min(newClaim.x1, newClaim.x2);
    const maxX1 = Math.max(newClaim.x1, newClaim.x2);
    const minZ1 = Math.min(newClaim.z1, newClaim.z2);
    const maxZ1 = Math.max(newClaim.z1, newClaim.z2);

    const minX2 = Math.min(existingClaim.x1, existingClaim.x2);
    const maxX2 = Math.max(existingClaim.x1, existingClaim.x2);
    const minZ2 = Math.min(existingClaim.z1, existingClaim.z2);
    const maxZ2 = Math.max(existingClaim.z1, existingClaim.z2);

    if (maxX1 < minX2 || minX1 > maxX2) return false;
    if (maxZ1 < minZ2 || minZ1 > maxZ2) return false;

    return true;
}

function isFullyInside2D(claim, area) {
    const areaMinX = Math.min(area.x1, area.x2);
    const areaMaxX = Math.max(area.x1, area.x2);
    const areaMinZ = Math.min(area.z1, area.z2);
    const areaMaxZ = Math.max(area.z1, area.z2);

    const claimMinX = Math.min(claim.x1, claim.x2);
    const claimMaxX = Math.max(claim.x1, claim.x2);
    const claimMinZ = Math.min(claim.z1, claim.z2);
    const claimMaxZ = Math.max(claim.z1, claim.z2);

    return claimMinX >= areaMinX && claimMaxX <= areaMaxX &&
           claimMinZ >= areaMinZ && claimMaxZ <= areaMaxZ;
}


function spawnClaimParticle(dimension, x, y, z) {
    try {
        dimension.spawnParticle("minecraft:villager_happy", { x: x + 0.5, y: y + 1.2, z: z + 0.5 });
    } catch (e) {
    }
}

const lastDenySound = new Map();
function playDeniedThrottled(player) {
    if (!player || !player.isValid) return;
    const now = system.currentTick;
    const last = lastDenySound.get(player.id) ?? -999;
    if (now - last < 10) return;
    lastDenySound.set(player.id, now);
    H.playDenied(player);
}

world.beforeEvents.explosion.subscribe((event) => {
    const impactedBlocks = event.getImpactedBlocks();
    const adminClaims = getCachedAdminClaims();
    const playerClaims = H.getData("worldclaims", {});

    const filteredBlocks = impactedBlocks.filter((block) => {
        const loc = block.location;
        
        if (adminClaims.some(zone => isInside3D(loc, zone))) return false;

        for (const ownerId in playerClaims) {
            if (isInside2D(loc, playerClaims[ownerId])) return false;
        }

        return true;
    });

    if (filteredBlocks.length < impactedBlocks.length) {
        event.setImpactedBlocks(filteredBlocks);
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const { player } = event;
    if (player.isValid) {
        player.setDynamicProperty("corners", 0);
    }
});

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const { block, player, dimension } = event;
    const { x, y, z } = block.location;

    if (player.hasTag("AdminClaiming")) {
        event.cancel = true;
        system.run(() => {
            if (!player.isValid) return;

            const corners = player.getDynamicProperty("corners") ?? 0;
            if (corners === 0) {
                player.setDynamicProperty("c1x", x);
                player.setDynamicProperty("c1y", y);
                player.setDynamicProperty("c1z", z);
                player.setDynamicProperty("cdim", dimension.id);
                player.setDynamicProperty("corners", 1);
                H.playClick(player);
                player.sendMessage({ rawtext: [{ translate: 'message.admin.corner_1_set' }] });
            } else {
                const x1 = player.getDynamicProperty("c1x");
                const y1 = player.getDynamicProperty("c1y");
                const z1 = player.getDynamicProperty("c1z");
                const dimId = player.getDynamicProperty("cdim");

                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.create_zone.title' }] })
                    .textField({ rawtext: [{ translate: 'ui.admin.create_zone.label' }] }, "Spawn")
                    .show(player).then(res => {
                        if (res.canceled) return;

                        const name = res.formValues[0] || "Unnamed Zone";
                        const claims = getCachedAdminClaims();
                        
                        claims.push({ 
                            name: name || { translate: 'ui.admin.create_zone.unnamed' }, 
                            x1, y1, z1, x2: x, y2: y, z2: z, 
                            dimensionId: dimId, 
                            trusted: [], breakableBlocks: [], 
                            allowChests: false, allowMobs: true, 
                            spawnProtection: false, showParticles: true,
                            mobDamageProtection: true, pvpProtection: false
                        });
                        
                        saveAdminClaims(claims);
                        player.sendMessage({ rawtext: [{ translate: 'message.admin.zone_created', with: [name || "Unnamed Zone"] }] });
                        H.playSuccess(player);
                        H.spawnRewardParticle(dimension, { x, y: y + 1, z });
                        player.removeTag("AdminClaiming");
                        player.setDynamicProperty("corners", 0);
                    });
            }
        });
        return;
    }

    if (player.hasTag("AdminAllowAreaClaiming")) {
        event.cancel = true;
        system.run(() => {
            if (!player.isValid) return;

            const corners = player.getDynamicProperty("allowAreaCorners") ?? 0;
            if (corners === 0) {
                player.setDynamicProperty("aa1x", x);
                player.setDynamicProperty("aa1z", z);
                player.setDynamicProperty("aaDim", dimension.id);
                player.setDynamicProperty("allowAreaCorners", 1);
                H.playClick(player);
                player.sendMessage({ rawtext: [{ translate: 'message.admin.allow_area_corner_1_set' }] });
            } else {
                const x1 = player.getDynamicProperty("aa1x");
                const z1 = player.getDynamicProperty("aa1z");

                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.create_allow_area.title' }] })
                    .textField({ rawtext: [{ translate: 'ui.admin.create_allow_area.label' }] }, "Build Zone")
                    .show(player).then(res => {
                        if (res.canceled) return;

                        const name = res.formValues[0] || "Unnamed Area";
                        const areas = getCachedAllowAreas();

                        areas.push({ name, x1, z1, x2: x, z2: z });

                        saveAllowAreas(areas);
                        player.sendMessage({ rawtext: [{ translate: 'message.admin.allow_area_created', with: [name] }] });
                        H.playSuccess(player);
                        H.spawnRewardParticle(dimension, { x, y: y + 1, z });
                        player.removeTag("AdminAllowAreaClaiming");
                        player.setDynamicProperty("allowAreaCorners", 0);
                    });
            }
        });
        return;
    }

    if (player.hasTag("Claiming")) {
        event.cancel = true;
        const claims = H.getData("worldclaims", {});
        const maxLand = world.getDynamicProperty("maxland") ?? 1000;
        const allowAreas = getCachedAllowAreas();

        system.run(() => {
            if (!player.isValid) return;
            const corners = player.getDynamicProperty("corners") ?? 0;

            if (corners === 0) {
                if (allowAreas.length > 0 && !allowAreas.some(area => isInside2D({ x, z }, area))) {
                    player.sendMessage({ rawtext: [{ translate: 'message.claim.outside_allow_area' }] });
                    H.playDenied(player);
                    return;
                }

                player.setDynamicProperty("c1x", x);
                player.setDynamicProperty("c1z", z);
                player.setDynamicProperty("corners", 1);
                
                if (typeof spawnClaimParticle !== "undefined") spawnClaimParticle(dimension, x, y, z);
                H.playClick(player);
                
                player.sendMessage({ rawtext: [{ translate: 'message.claim.corner_1_set' }] });
            } else {
                const x1 = player.getDynamicProperty("c1x");
                const z1 = player.getDynamicProperty("c1z");
                const newClaim = { x1, z1, x2: x, z2: z, name: player.name, breakableBlocks: [], trusted: [], allowChests: false };

                if (allowAreas.length > 0 && !allowAreas.some(area => isFullyInside2D(newClaim, area))) {
                    player.sendMessage({ rawtext: [{ translate: 'message.claim.outside_allow_area' }] });
                    H.playDenied(player);
                    player.setDynamicProperty("corners", 0);
                    return;
                }
                
                const newSize = typeof getClaimSize !== "undefined" ? getClaimSize(newClaim) : 0;

                if (newSize > maxLand) {
                    player.sendMessage({ rawtext: [{ translate: 'message.claim.too_large', with: [String(maxLand), String(newSize)] }] });
                    H.playDenied(player);
                } else {
                    let overlap = false;
                    for (const id in claims) {
                        if (id !== player.id && typeof isOverlapping !== "undefined" && isOverlapping(newClaim, claims[id])) {
                            overlap = true;
                            break;
                        }
                    }
                    if (overlap) {
                        player.sendMessage({ rawtext: [{ translate: 'message.claim.overlap' }] });
                        H.playDenied(player);
                    } else {
                        if (typeof spawnClaimParticle !== "undefined") spawnClaimParticle(dimension, x, y, z);
                        claims[player.id] = newClaim;
                        H.setData("worldclaims", claims);
                        player.sendMessage({ rawtext: [{ translate: 'message.claim.success', with: [String(newSize)] }] });
                        H.playSuccess(player);
                        player.removeTag("Claiming");
                    }
                }
                player.setDynamicProperty("corners", 0);
            }
        });
        return;
    }

    if (H.isOp(player)) return;

    const adminClaims = getCachedAdminClaims();
    for (const zone of adminClaims) {
        if (isInside3D(block.location, zone)) {
            if (zone.trusted?.includes(player.name) || zone.breakableBlocks?.includes(block.typeId)) return;
            event.cancel = true;
            system.run(() => {
playDeniedThrottled(player); }
            });
            return;
        }
    }

    if (world.getDynamicProperty("landclaim") !== false) {
        const claims = H.getData("worldclaims", {});
        for (const ownerId in claims) {
            const c = claims[ownerId];
            if (isInside2D(block.location, c) && player.id !== ownerId) {
                if (c.trusted?.includes(player.name) || c.breakableBlocks?.includes(block.typeId)) return;
                event.cancel = true;
                system.run(() => {
playDeniedThrottled(player); }
                });
                return;
            }
        }
    }
});

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
    const { block, player } = event;

    if (H.isOp(player)) return;

    const adminClaims = getCachedAdminClaims();
    for (const zone of adminClaims) {
        if (isInside3D(block.location, zone)) {
            if (zone.trusted?.includes(player.name) || zone.breakableBlocks?.includes(block.typeId)) return;
            event.cancel = true;
            system.run(() => {
playDeniedThrottled(player); }
            });
            return;
        }
    }

    if (world.getDynamicProperty("landclaim") !== false) {
        const claims = H.getData("worldclaims", {});
        for (const ownerId in claims) {
            const c = claims[ownerId];
            if (isInside2D(block.location, c) && player.id !== ownerId) {
                if (c.trusted?.includes(player.name) || c.breakableBlocks?.includes(block.typeId)) return;
                event.cancel = true;
                system.run(() => {
playDeniedThrottled(player); }
                });
                return;
            }
        }
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block, player, itemStack } = event;

    if (H.isOp(player) || block.typeId === "minecraft:ender_chest") return;

    const blockId = block.typeId;
    const itemId = itemStack?.typeId || "";

    const isContainer = ["minecraft:chest", "minecraft:barrel", "minecraft:shulker_box", "minecraft:hopper", "minecraft:dropper", "minecraft:dispenser"].includes(blockId) || blockId.includes("shulker_box");
    const isDoor = /door|gate|trapdoor/.test(blockId);
    const isBucketAction = itemId.includes("bucket");
    const isStrippingLog = itemId.includes("_axe") && /log|wood/.test(blockId);

    const adminClaims = getCachedAdminClaims();
    for (const zone of adminClaims) {
        if (isInside3D(block.location, zone)) {
            if (zone.trusted?.includes(player.name)) return;

            if (isDoor || isBucketAction || isStrippingLog || (isContainer && !zone.allowChests)) {
                event.cancel = true;
                system.run(() => {
                    if (!player.isValid) return;
                    new MessageFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.error.restricted.title' }] })
                        .body({ rawtext: [{ translate: 'ui.error.restricted.body', with: [zone.name] }] })
                        .button1({ rawtext: [{ translate: 'ui.error.restricted.button.close' }] })
                        .show(player);
                });
                return;
            }
        }
    }

    if (world.getDynamicProperty("landclaim") !== false) {
        const claims = H.getData("worldclaims", {});
        for (const ownerId in claims) {
            const c = claims[ownerId];
            if (isInside2D(block.location, c) && player.id !== ownerId) {
                if (c.trusted?.includes(player.name)) return;

                if (isContainer && c.allowChests === true) return;

                if (isDoor || isBucketAction || isContainer || isStrippingLog) {
                    event.cancel = true;
                    system.run(() => {
playDeniedThrottled(player); }
                    });
                    return;
                }
            }
        }
    }
});

function toBlockLoc(loc) {
    return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

world.beforeEvents.itemUse.subscribe((event) => {
    const { itemStack, source: player } = event;
    if (itemStack?.typeId !== "minecraft:ender_pearl") return;
    if (!player?.isValid) return;
    if (H.isOp(player)) return;

    const loc = toBlockLoc(player.location);
    const dimId = player.dimension.id;

    let blocked = null;

    for (const zone of getCachedAdminClaims()) {
        if (zone.dimensionId && zone.dimensionId !== dimId) continue;
        if (!isInside3D(loc, zone)) continue;
        if (zone.trusted?.includes(player.name)) continue;
        if (zone.allowPearls === true) continue;
        blocked = 'actionbar.error.pearls_admin_zone';
        break;
    }

    if (!blocked && world.getDynamicProperty("landclaim") !== false) {
        const claims = H.getData("worldclaims", {});
        for (const ownerId in claims) {
            const c = claims[ownerId];
            if (!isInside2D(loc, c)) continue;
            if (ownerId === player.id) continue;
            if (c.trusted?.includes(player.name)) continue;
            if (c.allowPearls === true) continue;
            blocked = 'actionbar.claim.pearls_disabled';
            break;
        }
    }

    if (!blocked) return;

    event.cancel = true;
    system.run(() => {
        if (!player.isValid) return;
playDeniedThrottled(player);
    });
});

world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;

    if (entity.typeId === "minecraft:player" || IGNORED_ENTITIES.has(entity.typeId) || entity.typeId.startsWith("sh:")) return;

    const adminClaims = getCachedAdminClaims();
    for (const zone of adminClaims) {
        if (zone.allowMobs === false && isInside3D(entity.location, zone)) {
            system.run(() => {
                if (entity.isValid) entity.remove();
            });
            break;
        }
    }
});

world.beforeEvents.entityHurt.subscribe((event) => {
    const { hurtEntity: entity, damageSource } = event;
    const damager = damageSource.damagingEntity;

    if (damager?.typeId === "minecraft:player" && !H.isOp(damager)) return;

    const isPlayerEntity = entity.typeId === "minecraft:player";
    const { location } = entity;
    let shouldProtect = false;

    const adminClaims = getCachedAdminClaims();
    for (const zone of adminClaims) {
        if (isInside3D(location, zone)) {
            if (damager && zone.trusted?.includes(damager.name)) continue;

            const zoneBlocksDamage = isPlayerEntity
                ? zone.pvpProtection === true
                : zone.mobDamageProtection !== false;

            if (zoneBlocksDamage) {
                shouldProtect = true;
                break;
            }
        }
    }

    if (!shouldProtect) {
        const claims = H.getData("worldclaims", {});
        for (const ownerId in claims) {
            const c = claims[ownerId];
            if (isInside2D(location, c) && damager?.id !== ownerId) {
                if (c.trusted?.includes(damager?.name)) continue;

                const claimBlocksDamage = isPlayerEntity
                    ? c.pvpProtection === true
                    : c.mobDamageProtection !== false;

                if (claimBlocksDamage) {
                    shouldProtect = true;
                    break;
                }
            }
        }
    }

    if (shouldProtect) {
        event.cancel = true;
        if (damager?.typeId === "minecraft:player") {
            system.run(() => {
playDeniedThrottled(damager); }
            });
        }
    }
});

world.afterEvents.playerInteractWithBlock.subscribe(event => {
    const { block, player, itemStack } = event;
    if (!player || !itemStack) return;

    const isShovel = itemStack.typeId.includes("_shovel");
    const isTarget = block.typeId === "minecraft:grass_path" || block.typeId === "minecraft:farmland";

    if (isShovel && isTarget) {
        if (H.isOp(player)) return;

        const location = block.location;
        let shouldReset = false;

        const adminClaims = getCachedAdminClaims();
        for (const zone of adminClaims) {
            if (isInside3D(location, zone) && !zone.trusted?.includes(player.name)) {
                shouldReset = true;
                break;
            }
        }

        if (!shouldReset) {
            const claims = H.getData("worldclaims", {});
            for (const ownerId in claims) {
                const c = claims[ownerId];
                if (isInside2D(location, c) && player.id !== ownerId && !c.trusted?.includes(player.name)) {
                    shouldReset = true;
                    break;
                }
            }
        }

        if (shouldReset) {
            system.run(() => {
                if (!player.isValid) return;

                try {
                    player.dimension.getBlock(location)?.setType("minecraft:grass");
                } catch (e) { }

playDeniedThrottled(player);
            });
        }
    }
});