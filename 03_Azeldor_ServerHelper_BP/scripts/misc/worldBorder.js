import { world, system } from "@minecraft/server"
import * as H from "../general/helpers"

const VISUAL_RANGE = 50;
const VISUAL_SPAN = 15;
const PARTICLE_SPACING = 1;
const WALL_HEIGHT = 5;
const PARTICLE_VERTICAL_SPACING = 1;
const PARTICLE_ID = "minecraft:redstone_ore_dust_particle";

let runCount = 0;
let cachedBorders = null;
let cachedSpawn = null;
let cacheExpiresAtTick = 0;

function refreshCacheIfNeeded() {
    const now = system.currentTick;
    if (cachedBorders && now < cacheExpiresAtTick) return;

    cachedBorders = {
        "minecraft:overworld": world.getDynamicProperty("worldBorder_overworld") ?? 2000,
        "minecraft:nether": world.getDynamicProperty("worldBorder_nether") ?? 1000,
        "minecraft:the_end": world.getDynamicProperty("worldBorder_the_end") ?? 1000
    };
    cachedSpawn = world.getDefaultSpawnLocation();
    cacheExpiresAtTick = now + 100;
}

function getBorderBounds(dimId) {
    const size = cachedBorders[dimId];
    if (size === undefined) return null;

    const centerX = dimId === "minecraft:overworld" ? cachedSpawn.x : 0;
    const centerZ = dimId === "minecraft:overworld" ? cachedSpawn.z : 0;

    return {
        size,
        minX: centerX - size + 0.5,
        maxX: centerX + size - 0.5,
        minZ: centerZ - size + 0.5,
        maxZ: centerZ + size - 0.5
    };
}

/* ---------- Main loop ---------- */
system.runInterval(() => {
    if (!world.getDynamicProperty("worldBorderEnabled")) return;

    const players = world.getAllPlayers();
    if (players.length === 0) return;

    refreshCacheIfNeeded();

    runCount++;
    const shouldEnforce = runCount % 2 === 0;

    for (const player of players) {
        if (!player.isValid) continue;
        if (player.hasTag("admin")) continue;

        const bounds = getBorderBounds(player.dimension.id);
        if (!bounds) continue;

        const { x, y, z } = player.location;

        if (shouldEnforce) {
            const safeX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
            const safeZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));

            if (safeX !== x || safeZ !== z) {
                player.teleport({ x: safeX, y, z });

                player.sendMessage({ rawtext: [{ translate: "message.border.hit", with: [String(bounds.size)] }] });
                H.playDenied(player);
                continue;
            }
        }

        drawBorderVisual(player, bounds, x, y, z);
    }
}, 10);

function drawBorderVisual(player, bounds, x, y, z) {
    const dimension = player.dimension;

    const distToMinX = x - bounds.minX;
    const distToMaxX = bounds.maxX - x;
    const distToMinZ = z - bounds.minZ;
    const distToMaxZ = bounds.maxZ - z;

    if (distToMinX >= 0 && distToMinX <= VISUAL_RANGE) drawWallX(dimension, bounds.minX, z, y);
    if (distToMaxX >= 0 && distToMaxX <= VISUAL_RANGE) drawWallX(dimension, bounds.maxX, z, y);
    if (distToMinZ >= 0 && distToMinZ <= VISUAL_RANGE) drawWallZ(dimension, x, bounds.minZ, y);
    if (distToMaxZ >= 0 && distToMaxZ <= VISUAL_RANGE) drawWallZ(dimension, x, bounds.maxZ, y);
}

function drawWallX(dimension, wallX, centerZ, centerY) {
    for (let dz = -VISUAL_SPAN; dz <= VISUAL_SPAN; dz += PARTICLE_SPACING) {
        for (let dy = -WALL_HEIGHT; dy <= WALL_HEIGHT; dy += PARTICLE_VERTICAL_SPACING) {
            trySpawnParticle(dimension, wallX, centerY + dy, centerZ + dz);
        }
    }
}

function drawWallZ(dimension, centerX, wallZ, centerY) {
    for (let dx = -VISUAL_SPAN; dx <= VISUAL_SPAN; dx += PARTICLE_SPACING) {
        for (let dy = -WALL_HEIGHT; dy <= WALL_HEIGHT; dy += PARTICLE_VERTICAL_SPACING) {
            trySpawnParticle(dimension, centerX + dx, centerY + dy, wallZ);
        }
    }
}

function trySpawnParticle(dimension, x, y, z) {
    try {
        dimension.spawnParticle(PARTICLE_ID, { x, y, z });
    } catch {
    }
}