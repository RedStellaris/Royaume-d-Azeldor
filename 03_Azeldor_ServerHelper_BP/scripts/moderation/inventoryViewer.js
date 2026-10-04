import { world, system, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui"
import * as H from "../general/helpers"

const ENTITY_ID = "sh:inventory";
const TITLE_IN_USE = "§lInventory Viewer§r\n§2§lIN USE";

const inventoryCache = new Map();

function isValidForSlot(item, slot) {
    if (!item) return true;
    const id = item.typeId;

    switch (slot) {
        case EquipmentSlot.Head:
            return id.includes("helmet") || id.includes("skull") || id.includes("head") || id === "minecraft:carved_pumpkin";
        case EquipmentSlot.Chest:
            return id.includes("chestplate") || id === "minecraft:elytra";
        case EquipmentSlot.Legs:
            return id.includes("leggings");
        case EquipmentSlot.Feet:
            return id.includes("boots");
        case EquipmentSlot.Offhand:
            const allowedOffhand = [
                "shield", "map", "arrow", "totem_of_undying",
                "firework_rocket", "nautilus_shell"
            ];
            return allowedOffhand.some(allowed => id.includes(allowed));
        default:
            return true;
    }
}

function getDistance(loc1, loc2) {
    return Math.sqrt(Math.pow(loc1.x - loc2.x, 2) + Math.pow(loc1.y - loc2.y, 2) + Math.pow(loc1.z - loc2.z, 2));
}

function getTargetPlayer(ent) {
    const rawTarget = ent.getDynamicProperty("target");
    if (!rawTarget) return undefined;
    try {
        const parsed = JSON.parse(rawTarget);
        const searchId = parsed.id || parsed.name || parsed;
        return world.getAllPlayers().find(p => p.id === searchId || p.name === searchId);
    } catch {
        return world.getAllPlayers().find(p => p.id === rawTarget || p.name === rawTarget);
    }
}

const SLOT_MAP = [];
for (let i = 0; i <= 26; i++) SLOT_MAP.push({ v: i, t: i + 9, type: 'inv' });
for (let i = 0; i <= 8; i++) SLOT_MAP.push({ v: i + 27, t: i, type: 'inv' });

SLOT_MAP.push({ v: 36, type: 'equip', slot: EquipmentSlot.Head });
SLOT_MAP.push({ v: 37, type: 'equip', slot: EquipmentSlot.Chest });
SLOT_MAP.push({ v: 38, type: 'equip', slot: EquipmentSlot.Legs });
SLOT_MAP.push({ v: 39, type: 'equip', slot: EquipmentSlot.Feet });
SLOT_MAP.push({ v: 40, type: 'equip', slot: EquipmentSlot.Offhand });

function getItemState(item) {
    if (!item) return "empty";
    return `${item.typeId}:${item.amount}`;
}

function forceInitialSync(ent) {
    const target = getTargetPlayer(ent);
    if (!target || !target.isValid) return;

    const viewerContainer = ent.getComponent("inventory").container;
    const targetContainer = target.getComponent("inventory").container;
    const targetEquip = target.getComponent("equippable");

    viewerContainer.clearAll();

    if (!inventoryCache.has(ent.id)) inventoryCache.set(ent.id, new Map());
    const cache = inventoryCache.get(ent.id);

    for (const map of SLOT_MAP) {
        let targetItem;
        if (map.type === 'inv') {
            targetItem = targetContainer.getItem(map.t);
        } else if (map.type === 'equip') {
            targetItem = targetEquip.getEquipment(map.slot);
        }
        viewerContainer.setItem(map.v, targetItem ? targetItem.clone() : undefined);
        cache.set(map.v, getItemState(targetItem));
    }
}

function collectNearbyViewerEntities() {
    const seen = new Map();
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;
        let nearby;
        try {
            nearby = player.dimension.getEntities({ type: ENTITY_ID, location: player.location, maxDistance: 8 });
        } catch (e) { continue; }
        for (const ent of nearby) seen.set(ent.id, ent);
    }
    return seen.values();
}

system.runInterval(() => {
    {
        const entities = collectNearbyViewerEntities();

        for (const ent of entities) {
            if (!ent.isValid) continue;

            const ownerId = ent.getDynamicProperty("owner_id");
            const admin = world.getAllPlayers().find(p => p.id === ownerId);
            const target = getTargetPlayer(ent);

            if (!ownerId || !admin || !admin.isValid || getDistance(admin.location, ent.location) > 5) {
                inventoryCache.delete(ent.id);
                ent.remove();
                continue;
            }

            if (ent.nameTag !== TITLE_IN_USE) continue;
            if (!target || !target.isValid) {
                inventoryCache.delete(ent.id);
                ent.remove();
                continue;
            }

            const viewerContainer = ent.getComponent("inventory").container;
            const targetContainer = target.getComponent("inventory").container;
            const targetEquip = target.getComponent("equippable");

            if (!inventoryCache.has(ent.id)) inventoryCache.set(ent.id, new Map());
            const cache = inventoryCache.get(ent.id);

            for (const map of SLOT_MAP) {
                const vSlot = map.v;
                const viewerItem = viewerContainer.getItem(vSlot);
                const viewerState = getItemState(viewerItem);
                const cachedState = cache.get(vSlot) || "empty";

                let targetItem;
                if (map.type === 'inv') {
                    targetItem = targetContainer.getItem(map.t);
                } else if (map.type === 'equip') {
                    targetItem = targetEquip.getEquipment(map.slot);
                }
                const targetState = getItemState(targetItem);

                if (viewerState !== cachedState) {
                    if (map.type === 'inv') {
                        targetContainer.setItem(map.t, viewerItem ? viewerItem.clone() : undefined);
                        cache.set(vSlot, viewerState);
                    } else if (map.type === 'equip') {
                        if (isValidForSlot(viewerItem, map.slot)) {
                            targetEquip.setEquipment(map.slot, viewerItem ? viewerItem.clone() : undefined);
                            cache.set(vSlot, viewerState);
                        } else {
                            if (viewerItem && admin) {
                                const adminInv = admin.getComponent("inventory").container;
                                const leftover = adminInv.addItem(viewerItem.clone());
                                if (leftover) {
                                    admin.dimension.spawnItem(leftover, admin.location);
                                }
admin.playSound("note.bass", { pitch: 0.5, volume: 1.0 });
                            }

                            viewerContainer.setItem(vSlot, targetItem ? targetItem.clone() : undefined);
                            cache.set(vSlot, targetState);
                        }
                    }
                }
                else if (targetState !== cachedState) {
                    viewerContainer.setItem(vSlot, targetItem ? targetItem.clone() : undefined);
                    cache.set(vSlot, targetState);
                }
            }
        }
    }
}, 2);

system.runInterval(() => {
    for (const dimension of ["overworld", "nether", "the_end"]) {
        let entities;
        try {
            entities = world.getDimension(dimension).getEntities({ type: ENTITY_ID });
        } catch (e) { continue; }
        for (const ent of entities) {
            if (!ent.isValid) continue;
            const ownerId = ent.getDynamicProperty("owner_id");
            const admin = ownerId ? world.getEntity(ownerId) : undefined;
            if (!ownerId || !admin || !admin.isValid || getDistance(admin.location, ent.location) > 5) {
                inventoryCache.delete(ent.id);
                ent.remove();
            }
        }
    }
}, 100);

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { target: clickedEntity, player } = event;
    if (clickedEntity.typeId === ENTITY_ID) {
        if (!H.isOp(player)) {
            player.sendMessage({ rawtext: [{ translate: "message.invviewer.no_permission" }] });
            player.teleport({ x: player.location.x, y: player.location.y + 5, z: player.location.z });
            system.runTimeout(() => {
                player.teleport({ x: player.location.x, y: player.location.y - 5, z: player.location.z });
            }, 1);
            return;
        }
        
        const ownerId = clickedEntity.getDynamicProperty("owner_id");
        if (player.id !== ownerId) {
            player.teleport({ x: player.location.x, y: player.location.y + 5, z: player.location.z });
            system.runTimeout(() => {
                player.teleport({ x: player.location.x, y: player.location.y - 5, z: player.location.z });
            }, 1);
            player.sendMessage({ rawtext: [{ translate: "message.invviewer.wrong_owner" }] });
            return;
        }

        if (clickedEntity.nameTag !== TITLE_IN_USE) {
            clickedEntity.nameTag = TITLE_IN_USE;
            forceInitialSync(clickedEntity);
        }
    }
});

export function playerInventoryView(admin, target) {
    if (!world.getDynamicProperty("oldinvsee")) {
        const player = admin;
        let ent;
        const rayHit = player.dimension.getBlockFromRay(player.getHeadLocation(), player.getViewDirection(), {
            maxDistance: 8,
            includePassableBlocks: true,
            includeLiquidBlocks: false
        });

        if (!rayHit) {
            ent = player.dimension.spawnEntity("sh:inventory", player.location);
        } else {
            const block = rayHit.block;
            let spawnX = block.location.x + 0.5;
            let spawnY = block.location.y - 1;
            let spawnZ = block.location.z + 0.5;
            if (rayHit.face === "East") spawnX += 1;
            if (rayHit.face === "Up") spawnY += 2;
            if (rayHit.face === "South") spawnZ += 1;
            if (rayHit.face === "West") spawnX -= 1;
            if (rayHit.face === "Down") spawnY -= 1;
            if (rayHit.face === "North") spawnZ -= 1;

            ent = player.dimension.spawnEntity("sh:inventory", { x: spawnX, y: spawnY, z: spawnZ });
        }
        ent.teleport(ent.location, { facingLocation: player.location });

        ent.nameTag = "§lInventory Viewer§r\n§5Removing in:§r 5s";
        ent.setDynamicProperty("owner_id", player.id);
        ent.setDynamicProperty("target", JSON.stringify(target.id || target.name));

        system.runTimeout(() => {
            if (ent.isValid && ent.nameTag === "§lInventory Viewer§r\n§5Removing in:§r 5s") ent.remove();
        }, 100);
    } else {
        const container = target.getComponent("minecraft:inventory").container;
        const items = [];
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item) {
                const shortId = item.typeId.split(":")[1];
                const isBlock = BlockTypes.get(item.typeId) !== undefined;
                const iconPath = isBlock ? `textures/blocks/${shortId}` : `textures/items/${shortId}`;
                items.push({ slot: i, typeId: item.typeId, amount: item.amount, label: shortId.replace(/_/g, " "), icon: iconPath });
            }
        }
        
        const menu = new ActionFormData()
            .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.invsee.title", with: [target.name] }] });
            
        items.forEach(item => menu.button(`${item.label} x${item.amount}`, item.icon));
        
        menu.button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back");
        
        menu.show(admin).then(r => {
            if (r.canceled || r.selection === items.length) return inventoryMenu(admin);
            const selected = items[r.selection];
            
            new ActionFormData()
                .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.invsee.manage.title" }] })
                .button({ rawtext: [{ translate: "ui.invsee.manage.remove" }] })
                .button({ rawtext: [{ translate: "ui.button.back" }] })
                .show(admin).then(res => {
                    if (res.selection === 0) {
                        container.setItem(selected.slot, undefined);
                        admin.sendMessage({ 
                            rawtext: [{ 
                                translate: "message.invsee.removed", 
                                with: [selected.label, target.name] 
                            }] 
                        });
                    }
                    playerInventoryView(admin, target);
                });
        });
    }
}