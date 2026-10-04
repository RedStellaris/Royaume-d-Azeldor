/**
 * Death Corpse & Coords - By Foxyfall
 */
import { world, system, EquipmentSlot } from "@minecraft/server";
// Total XP points required to reach the START of a given level (Bedrock/Java curve).
function xpForLevel(level) {
    if (level <= 0) return 0;
    if (level <= 16) return level * level + 6 * level;
    if (level <= 31) return Math.round(2.5 * level * level - 40.5 * level + 360);
    return Math.round(4.5 * level * level - 162.5 * level + 2220);
}
// Add a number of raw XP points to a player.
function addXpPoints(player, points) {
    if (points > 0) {
        try { player.addExperience(points); } catch {}
    }
}
const GRAVE_ID        = "ff:death_grave";
const GRAB_RADIUS     = 10;
const GRAB_TICKS      = 30;        // keep grabbing items for 1.5 seconds
const SHOW_COORDS_TO_ALL = false;
// Grave owner protection.
// false = anyone can collect from any corpse (default). A corpse left by a
//         player who never returns would otherwise sit in the world forever
//         with no way to clear it, which is worse than the risk of looting.
// true  = only the owner can collect. Set this if you run a public server
//         and would rather protect drops than keep the world tidy.
const OWNER_ONLY = false;
// Void rescue thresholds — if a player dies below this Y in the
// listed dimension, the grave will be re-spawned at the rescue Y so it
// doesn't fall into the void.
const VOID_RESCUE = {
    "minecraft:overworld": { minY: -55, rescueY: 200 },
    "minecraft:the_end":   { minY: 5,   rescueY: 100 }
    // Nether is intentionally omitted — its world ceiling makes a
    // "rescue Y" unreliable, and true void deaths aren't possible there.
};
const DIM_NAMES = {
    "minecraft:overworld": "§aOverworld",
    "minecraft:nether":    "§cNether",
    "minecraft:the_end":   "§5The End"
};
// Death location and corpse ownership both used to live in plain Maps, which
// are wiped whenever the world unloads. That meant a player who quit on the
// death screen and rejoined never got their coordinates, and — worse — the XP
// held by their corpse was gone for good. Both are now written to dynamic
// properties, so they survive a reload, a relog and a server restart.
//
// Death info is keyed by player NAME rather than entity id: a respawned player
// is not guaranteed to keep the same entity id, but the name is stable.
const DEATH_KEY = (name) => `ff:death:${name}`;
function saveDeathInfo(name, info) {
    try { world.setDynamicProperty(DEATH_KEY(name), JSON.stringify(info)); } catch {}
}
function loadDeathInfo(name) {
    try {
        const raw = world.getDynamicProperty(DEATH_KEY(name));
        return typeof raw === "string" ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
}
function clearDeathInfo(name) {
    try { world.setDynamicProperty(DEATH_KEY(name), undefined); } catch {}
}
// Ownership rides on the corpse entity itself, so it travels with the entity
// and cannot fall out of sync with a world-level table.
function setGraveOwner(grave, ownerId, ownerName, xp) {
    try {
        grave.setDynamicProperty("ff:owner_id", ownerId);
        grave.setDynamicProperty("ff:owner_name", ownerName);
        grave.setDynamicProperty("ff:xp", xp | 0);
    } catch {}
}
function getGraveOwner(grave) {
    try {
        const ownerId = grave.getDynamicProperty("ff:owner_id");
        if (typeof ownerId !== "string") return undefined;
        return {
            ownerId,
            ownerName: grave.getDynamicProperty("ff:owner_name") ?? "someone",
            xp: grave.getDynamicProperty("ff:xp") ?? 0
        };
    } catch { return undefined; }
}
// ─── PLAYER DEATH ────────────────────────────────────────
world.afterEvents.entityDie.subscribe((event) => {
    const dead = event.deadEntity;
    if (dead.typeId !== "minecraft:player") return;
    const playerName = dead.nameTag || dead.name;
    const loc = dead.location;
    const dim = dead.dimension;
    const cx = Math.floor(loc.x);
    const cy = Math.floor(loc.y);
    const cz = Math.floor(loc.z);
    const dimName = DIM_NAMES[dim.id] || "§7Unknown";
    // Void rescue — figure out where to spawn the corpse.
    let graveY = loc.y;
    let rescued = false;
    const rescue = VOID_RESCUE[dim.id];
    if (rescue && loc.y < rescue.minY) {
        graveY = rescue.rescueY;
        rescued = true;
    }
    const displayY = Math.floor(graveY);
    // ── Try to grab inventory before vanilla drops it ──
    const savedItems = [];
    try {
        const playerInv = dead.getComponent("inventory");
        if (playerInv && playerInv.container) {
            const c = playerInv.container;
            for (let i = 0; i < c.size; i++) {
                const item = c.getItem(i);
                if (item) {
                    savedItems.push(item.clone());
                    c.setItem(i, undefined);
                }
            }
        }
    } catch {}
    try {
        const equip = dead.getComponent("equippable");
        if (equip) {
            for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand]) {
                try {
                    const item = equip.getEquipment(slot);
                    if (item) {
                        savedItems.push(item.clone());
                        equip.setEquipment(slot, undefined);
                    }
                } catch {}
            }
        }
    } catch {}
    // ── Capture XP so it can be restored from the corpse ──
    // getTotalXp() returns lifetime points; convert to a spendable amount by
    // reading the current level + progress, then zero the player out so the
    // vanilla orb drop is suppressed. We store points and restore them exactly.
    let savedXp = 0;
    try {
        const lvl = dead.level;
        const pts = xpForLevel(lvl) + Math.round(dead.xpEarnedAtCurrentLevel);
        savedXp = pts;
        // Draining here prevents vanilla from scattering orbs on death.
        try { dead.resetLevel(); } catch {}
    } catch {}
    // Send death coordinates
    const msg = `§e${playerName}§r died at §b${cx}§r, §b${cy}§r, §b${cz}§r in ${dimName}`;
    if (SHOW_COORDS_TO_ALL) {
        world.sendMessage(msg);
    } else {
        try { dead.sendMessage(msg); } catch {}
    }
    saveDeathInfo(playerName, { x: cx, y: displayY, z: cz, dimName, rescued });
    // ── Spawn corpse on next tick ──
    system.run(() => {
        try {
            const grave = dim.spawnEntity(GRAVE_ID, {
                x: cx + 0.5, y: graveY, z: cz + 0.5
            });
            grave.nameTag = `${playerName}'s Death Corpse`;
            // Register the corpse's owner for protection checks.
            setGraveOwner(grave, dead.id, playerName, savedXp);
            // Play a subtle sound at the corpse location.
            try {
                dim.playSound("note.harp", { x: cx + 0.5, y: graveY, z: cz + 0.5 }, { volume: 1.0, pitch: 0.8 });
            } catch {}
            // Put saved inventory items into corpse
            const graveInv = grave.getComponent("inventory");
            if (graveInv && graveInv.container) {
                const gc = graveInv.container;
                for (const item of savedItems) {
                    try {
                        if (gc.emptySlotsCount > 0) gc.addItem(item);
                        else dim.spawnItem(item, grave.location);
                    } catch {}
                }
            }
            // ── Rapid item grabber — runs every tick ──
            // Catches any items vanilla managed to drop.
            let tickCount = 0;
            const grabber = system.runInterval(() => {
                tickCount++;
                if (tickCount > GRAB_TICKS || !grave.isValid()) {
                    system.clearRun(grabber);
                    return;
                }
                try {
                    const inv = grave.getComponent("inventory");
                    if (!inv || !inv.container) return;
                    const container = inv.container;
                    const items = dim.getEntities({
                        location: loc,
                        type: "minecraft:item",
                        maxDistance: GRAB_RADIUS
                    });
                    for (const itemEnt of items) {
                        if (container.emptySlotsCount <= 0) break;
                        try {
                            const ic = itemEnt.getComponent("item");
                            if (!ic || !ic.itemStack) continue;
                            container.addItem(ic.itemStack);
                            itemEnt.remove();
                        } catch {}
                    }
                } catch {}
            }, 1);
        } catch (err) {
            console.warn("[Death Corpse] Spawn failed: " + err);
            for (const item of savedItems) {
                try { dim.spawnItem(item, loc); } catch {}
            }
        }
    });
});
// ─── RESPAWN MESSAGE ─────────────────────────────────────
world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) return;
    const player = event.player;
    const info = loadDeathInfo(player.name);
    if (!info) return;
    system.runTimeout(() => {
        try {
            if (!player.isValid()) return;
            player.sendMessage(`§6[Death Corpse]§r Your Death Corpse is at §b${info.x}§r, §b${info.y}§r, §b${info.z}§r in ${info.dimName}`);
            if (info.rescued) {
                player.sendMessage(`§6[Death Corpse]§e You died in the void — the corpse was rescued above the world. It may have landed elsewhere as it fell.`);
            }
            player.sendMessage(`§6[Death Corpse]§7 Tap the Death Corpse to collect your items.`);
        } catch {}
    }, 40);
});
// ─── INTERACT WITH CORPSE ────────────────────────────────
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const target = event.target;
    if (!target || target.typeId !== GRAVE_ID) return;
    if (!target.isValid()) return;
    // Owner protection check. Matched on name rather than entity id, since a
    // player's entity id is not guaranteed to survive a respawn — comparing
    // ids risks locking someone out of their own corpse.
    if (OWNER_ONLY) {
        const ownerInfo = getGraveOwner(target);
        if (ownerInfo && ownerInfo.ownerName !== player.name) {
            // owner message removed
            return;
        }
    }
    giveItemsToPlayer(player, target);
});
// ─── ARMOR SLOT DETECTION ────────────────────────────────
function getArmorSlot(typeId) {
    const id = typeId.toLowerCase();
    if (id.includes("helmet") || id.includes("turtle_shell")) return EquipmentSlot.Head;
    if (id.includes("chestplate") || id.includes("elytra")) return EquipmentSlot.Chest;
    if (id.includes("leggings")) return EquipmentSlot.Legs;
    if (id.includes("boots")) return EquipmentSlot.Feet;
    if (id.includes("shield") || id.includes("totem")) return EquipmentSlot.Offhand;
    return null;
}
// ─── GIVE ITEMS BACK ─────────────────────────────────────
function giveItemsToPlayer(player, grave) {
    try {
        const graveInv = grave.getComponent("inventory");
        const playerInv = player.getComponent("inventory");
        if (!graveInv || !graveInv.container || !playerInv || !playerInv.container) return;
        const gc = graveInv.container;
        const pc = playerInv.container;
        const equip = player.getComponent("equippable");
        let collected = 0;
        let equipped  = 0;
        let dropped   = 0;
        for (let i = 0; i < gc.size; i++) {
            const item = gc.getItem(i);
            if (!item) continue;
            try {
                const armorSlot = getArmorSlot(item.typeId);
                if (armorSlot !== null && equip) {
                    const currentGear = equip.getEquipment(armorSlot);
                    if (!currentGear) {
                        equip.setEquipment(armorSlot, item);
                        gc.setItem(i, undefined);
                        equipped++;
                        continue;
                    }
                }
                if (pc.emptySlotsCount > 0) {
                    pc.addItem(item);
                    collected++;
                } else {
                    player.dimension.spawnItem(item, player.location);
                    dropped++;
                }
                gc.setItem(i, undefined);
            } catch {
                try {
                    player.dimension.spawnItem(item, player.location);
                    gc.setItem(i, undefined);
                    dropped++;
                } catch {}
            }
        }
        let hasItems = false;
        for (let i = 0; i < gc.size; i++) {
            if (gc.getItem(i)) { hasItems = true; break; }
        }
        let parts = [];
        if (equipped  > 0) parts.push(`§dEquipped ${equipped} armor piece(s)`);
        if (collected > 0) parts.push(`§aCollected ${collected} item stack(s)`);
        if (dropped   > 0) parts.push(`§eDropped ${dropped} stack(s) near you`);
        if (!hasItems) {
            const ownerRec = getGraveOwner(grave);
            const xp = ownerRec && ownerRec.xp ? ownerRec.xp : 0;
            if (xp > 0) {
                addXpPoints(player, xp);
                parts.push(`§bRestored ${xp} XP`);
            }
            try { player.playSound("random.orb"); } catch {}
            clearDeathInfo(player.name);
            grave.remove();
        }
        // chat messages removed
    } catch (err) {
        console.warn("[Death Corpse] Collect error: " + err);
    }
}
// ─── CORPSE NAME TOOLTIP (ALL PLATFORMS) ─────────────────
// Shows distance to the corpse in the action bar.
const VIEW_DIST = 4;
system.runInterval(() => {
    try {
        for (const player of world.getAllPlayers()) {
            if (!player.isValid()) continue;
            try {
                const hits = player.getEntitiesFromViewDirection({ maxDistance: VIEW_DIST });
                const graveHit = hits.find(h => h.entity && h.entity.typeId === GRAVE_ID && h.distance <= VIEW_DIST);
                if (graveHit) {
                    const name = graveHit.entity.nameTag || "Death Corpse";
                    const dist = Math.round(graveHit.distance * 10) / 10;
                    player.onScreenDisplay.setActionBar(`§f${name} §8[§7${dist}m§8]`);
                }
            } catch {}
        }
    } catch {}
}, 1);
// ─── COMMANDS ────────────────────────────────────────────
//   /scriptevent ff:coords   reprint your last death location
//   /scriptevent ff:remove   clear the corpse you are looking at
//   /scriptevent ff:help     list the commands
function say(player, text) {
    try { player.sendMessage("§6[Death Corpse]§r " + text); } catch {}
}
// Empties a corpse onto the ground before removing it, so clearing one out of
// the way can never destroy what it was holding.
function dropAndRemove(grave, dimension) {
    let moved = 0;
    try {
        const inv = grave.getComponent("inventory");
        if (inv && inv.container) {
            const c = inv.container;
            for (let i = 0; i < c.size; i++) {
                const item = c.getItem(i);
                if (!item) continue;
                try { dimension.spawnItem(item, grave.location); moved++; } catch {}
                try { c.setItem(i, undefined); } catch {}
            }
        }
    } catch {}
    try { grave.remove(); } catch {}
    return moved;
}
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (!event.id.startsWith("ff:")) return;
    const player = event.sourceEntity;
    if (!player || player.typeId !== "minecraft:player") return;
    const action = event.id.slice(3).toLowerCase();
    if (action === "coords") {
        const info = loadDeathInfo(player.name);
        if (!info) { say(player, "§7No death location saved yet."); return; }
        say(player, `Your Death Corpse is at §b${info.x}§r, §b${info.y}§r, §b${info.z}§r in ${info.dimName}`);
        if (info.rescued) {
            say(player, "§eYou died in the void — the corpse was moved above the world and may have drifted as it fell.");
        }
        return;
    }
    if (action === "remove") {
        let hit;
        try {
            hit = player.getEntitiesFromViewDirection({ maxDistance: 8 })
                        .find(h => h.entity && h.entity.typeId === GRAVE_ID);
        } catch {}
        if (!hit) { say(player, "§7Look at a Death Corpse and run this again."); return; }
        const grave = hit.entity;
        const owner = getGraveOwner(grave);
        // Read the position before removal — the entity is invalid afterwards.
        let where = player.location;
        try { where = grave.location; } catch {}
        // Anyone can clear any corpse. A corpse left by a player who never
        // came back would otherwise sit in the way of a build forever, and
        // there is no other way to move one — it can't be hit or pushed.
        // Nothing is destroyed: whatever it held drops on the ground first.
        const moved = dropAndRemove(grave, player.dimension);
        if (moved > 0) {
            // cleared message removed
            // owner notification removed
        } else {
            // cleared message removed
        }
        return;
    }
    say(player, "§7commands: §fcoords§7, §fremove§7 (look at a corpse first)");
});
