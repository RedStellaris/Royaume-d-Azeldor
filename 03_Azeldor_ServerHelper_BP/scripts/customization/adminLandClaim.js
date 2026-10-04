import { world, system, MolangVariableMap } from "@minecraft/server"
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import * as H from "../general/helpers"
import { AdminClaimMenu, AllowAreaMenu } from "./customizationUi"


let cachedAdminClaims = [];
let lastCacheTick = -1;


function getCachedAdminClaims() {
    const currentTick = system.currentTick;
    if (currentTick - lastCacheTick > 20 || lastCacheTick === -1) {
        cachedAdminClaims = H.getData("admin_claims") ?? [];
        lastCacheTick = currentTick;
    }
    return cachedAdminClaims;
}

function saveAdminClaims(claims) {
    H.setData("admin_claims", claims);
    cachedAdminClaims = claims;
    lastCacheTick = system.currentTick;
}

let cachedAllowAreas = [];
let lastAllowAreaCacheTick = -1;

function getCachedAllowAreas() {
    const currentTick = system.currentTick;
    if (currentTick - lastAllowAreaCacheTick > 20 || lastAllowAreaCacheTick === -1) {
        cachedAllowAreas = H.getData("admin_allow_areas") ?? [];
        lastAllowAreaCacheTick = currentTick;
    }
    return cachedAllowAreas;
}

function saveAllowAreas(areas) {
    H.setData("admin_allow_areas", areas);
    cachedAllowAreas = areas;
    lastAllowAreaCacheTick = system.currentTick;
}

function getClaimSize3D(rect) {
    const x = Math.abs(rect.x2 - rect.x1) + 1;
    const y = Math.abs(rect.y2 - rect.y1) + 1;
    const z = Math.abs(rect.z2 - rect.z1) + 1;
    return x * y * z;
}

function getAreaSize2D(rect) {
    const x = Math.abs(rect.x2 - rect.x1) + 1;
    const z = Math.abs(rect.z2 - rect.z1) + 1;
    return x * z;
}

function isInside3D(pos, rect) {
    return (
        pos.x >= Math.min(rect.x1, rect.x2) && pos.x <= Math.max(rect.x1, rect.x2) &&
        pos.y >= Math.min(rect.y1, rect.y2) && pos.y <= Math.max(rect.y1, rect.y2) &&
        pos.z >= Math.min(rect.z1, rect.z2) && pos.z <= Math.max(rect.z1, rect.z2)
    );
}

function isInside2D(pos, rect) {
    return (
        pos.x >= Math.min(rect.x1, rect.x2) && pos.x <= Math.max(rect.x1, rect.x2) &&
        pos.z >= Math.min(rect.z1, rect.z2) && pos.z <= Math.max(rect.z1, rect.z2)
    );
}

function drawClaimFrame(dimensionId, zone) {
    try {
        const dimension = world.getDimension(dimensionId || "minecraft:overworld");
        const minX = Math.min(zone.x1, zone.x2);
        const maxX = Math.max(zone.x1, zone.x2) + 1;
        const minY = Math.min(zone.y1, zone.y2);
        const maxY = Math.max(zone.y1, zone.y2) + 1;
        const minZ = Math.min(zone.z1, zone.z2);
        const maxZ = Math.max(zone.z1, zone.z2) + 1;

        const particleId = "minecraft:villager_happy";
        const vars = new MolangVariableMap();

        const drawLine = (x1, y1, z1, x2, y2, z2) => {
            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
            const steps = Math.ceil(distance / 2);
            
            for (let i = 0; i <= steps; i++) {
                const t = steps === 0 ? 0 : i / steps;
                dimension.spawnParticle(particleId, {
                    x: x1 + (x2 - x1) * t,
                    y: y1 + (y2 - y1) * t,
                    z: z1 + (z2 - z1) * t
                }, vars);
            }
        };

        drawLine(minX, minY, minZ, maxX, minY, minZ);
        drawLine(minX, maxY, minZ, maxX, maxY, minZ);
        drawLine(minX, minY, maxZ, maxX, minY, maxZ);
        drawLine(minX, maxY, maxZ, maxX, maxY, maxZ);

        drawLine(minX, minY, minZ, minX, maxY, minZ);
        drawLine(maxX, minY, minZ, maxX, maxY, minZ);
        drawLine(minX, minY, maxZ, minX, maxY, maxZ);
        drawLine(maxX, minY, maxZ, maxX, maxY, maxZ);

        drawLine(minX, minY, minZ, minX, minY, maxZ);
        drawLine(maxX, minY, minZ, maxX, minY, maxZ);
        drawLine(minX, maxY, minZ, minX, maxY, maxZ);
        drawLine(maxX, maxY, minZ, maxX, maxY, maxZ);
    } catch (e) {
    }
}

function drawAllowAreaFrame(dimensionId, yLevel, zone) {
    try {
        const dimension = world.getDimension(dimensionId || "minecraft:overworld");
        const minX = Math.min(zone.x1, zone.x2);
        const maxX = Math.max(zone.x1, zone.x2) + 1;
        const minZ = Math.min(zone.z1, zone.z2);
        const maxZ = Math.max(zone.z1, zone.z2) + 1;

        const particleId = "minecraft:villager_happy";
        const vars = new MolangVariableMap();

        const drawLine = (x1, z1, x2, z2) => {
            const distance = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
            const steps = Math.ceil(distance / 2);

            for (let i = 0; i <= steps; i++) {
                const t = steps === 0 ? 0 : i / steps;
                dimension.spawnParticle(particleId, {
                    x: x1 + (x2 - x1) * t,
                    y: yLevel + 1.2,
                    z: z1 + (z2 - z1) * t
                }, vars);
            }
        };

        drawLine(minX, minZ, maxX, minZ);
        drawLine(minX, maxZ, maxX, maxZ);
        drawLine(minX, minZ, minX, maxZ);
        drawLine(maxX, minZ, maxX, maxZ);
    } catch (e) {
    }
}

export function startClaim(player) {
    player.addTag("AdminClaiming");
    player.sendMessage({ rawtext: [{ translate: 'message.admin.claim_mode_enabled' }] });
}

export function startAllowArea(player) {
    player.addTag("AdminAllowAreaClaiming");
    player.sendMessage({ rawtext: [{ translate: 'message.admin.allow_area_mode_enabled' }] });
}

export function adminListClaims(player) {
    const claims = getCachedAdminClaims();
    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.zones.title' }] });

    if (claims.length === 0) {
        menu.body({ rawtext: [{ translate: 'ui.admin.zones.empty' }] });
    } else {
        claims.forEach((c) => {
            menu.button({ rawtext: [{ translate: 'ui.admin.zones.button.zone', with: [c.name, String(getClaimSize3D(c))] }] });
        });
    }
    menu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === claims.length) return AdminClaimMenu(player);
        adminManageSpecificZone(player, r.selection);
    });
}

function adminManageSpecificZone(player, index) {
    const claims = getCachedAdminClaims();
    const c = claims[index];

    const mobStatus = c.allowMobs ? 'ui.status.allowed' : 'ui.status.denied';
    const mobDamageStatus = c.mobDamageProtection !== false ? 'ui.status.disabled' : 'ui.status.enabled';
    const pvpStatus = c.pvpProtection === true ? 'ui.status.disabled' : 'ui.status.enabled';
    const protectionStatus = c.spawnProtection ? 'ui.status.enabled' : 'ui.status.disabled';
    const particleStatus = c.showParticles ? 'ui.status.enabled' : 'ui.status.disabled';

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() + `${c.name}` }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.permissions' }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.whitelist' }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.mob_spawning' }, { text: '\n' }, { translate: mobStatus }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.mob_damage' }, { text: '\n' }, { translate: mobDamageStatus }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.pvp_protection' }, { text: '\n' }, { translate: pvpStatus }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.spawn_protection' }, { text: '\n' }, { translate: protectionStatus }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.frame' }, { text: '\n' }, { translate: particleStatus }] })
        .button({ rawtext: [{ translate: 'ui.admin.zone_manage.button.delete' }] })
        .button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back")
        .show(player).then(res => {
            if (res.canceled || res.selection === 8) return adminListClaims(player);

            if (res.selection === 0) adminPermissionsMenu(player, index);
            else if (res.selection === 1) adminWhitelistMenu(player, index);
            else if (res.selection === 2) {
                c.allowMobs = !c.allowMobs;
                claims[index] = c;
                saveAdminClaims(claims);
                adminManageSpecificZone(player, index);
            }
            else if (res.selection === 3) {
                c.mobDamageProtection = c.mobDamageProtection === false ? true : false;
                claims[index] = c;
                saveAdminClaims(claims);
                adminManageSpecificZone(player, index);
            }
            else if (res.selection === 4) {
                c.pvpProtection = !c.pvpProtection;
                claims[index] = c;
                saveAdminClaims(claims);
                adminManageSpecificZone(player, index);
            }
            else if (res.selection === 5) {
                c.spawnProtection = !c.spawnProtection;
                claims[index] = c;
                saveAdminClaims(claims);
                adminManageSpecificZone(player, index);
            }
            else if (res.selection === 6) {
                c.showParticles = !c.showParticles;
                claims[index] = c;
                saveAdminClaims(claims);
                adminManageSpecificZone(player, index);
            }
            else if (res.selection === 7) {
                claims.splice(index, 1);
                saveAdminClaims(claims);
                player.sendMessage({ rawtext: [{ translate: 'message.admin.zone_deleted', with: [c.name] }] });
                adminListClaims(player);
            }
        });
}

export function adminListAllowAreas(player) {
    const areas = getCachedAllowAreas();
    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.allowAreas.title' }] });

    if (areas.length === 0) {
        menu.body({ rawtext: [{ translate: 'ui.admin.allowAreas.empty' }] });
    } else {
        areas.forEach((a) => {
            menu.button({ rawtext: [{ translate: 'ui.admin.allowAreas.button.area', with: [a.name, String(getAreaSize2D(a))] }] });
        });
    }
    menu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === areas.length) return AllowAreaMenu(player);
        adminManageAllowArea(player, r.selection);
    });
}

function adminManageAllowArea(player, index) {
    const areas = getCachedAllowAreas();
    const a = areas[index];

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() + `${a.name}` }] })
        .body({ rawtext: [{ translate: 'ui.admin.allowAreas.manage.body', with: [String(getAreaSize2D(a)), String(a.x1), String(a.z1), String(a.x2), String(a.z2)] }] })
        .button({ rawtext: [{ translate: 'ui.admin.allowAreas.manage.button.delete' }] })
        .button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back")
        .show(player).then(res => {
            if (res.canceled || res.selection === 1) return adminListAllowAreas(player);

            if (res.selection === 0) {
                areas.splice(index, 1);
                saveAllowAreas(areas);
                player.sendMessage({ rawtext: [{ translate: 'message.admin.allow_area_deleted', with: [a.name] }] });
                adminListAllowAreas(player);
            }
        });
}

function adminPermissionsMenu(player, index) {
    const claims = getCachedAdminClaims();
    const c = claims[index];

    c.allowChests = !!(c.allowChests ?? false);
    c.allowPearls = !!(c.allowPearls ?? false);

    const chestStatus = c.allowChests ? 'ui.status.allowed' : 'ui.status.denied';
    const pearlStatus = c.allowPearls ? 'ui.status.allowed' : 'ui.status.denied';

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.permissions.title' }] })
        .button({ rawtext: [{ translate: 'ui.admin.permissions.button.chests' }, { text: '\n§8' }, { translate: chestStatus }] })
        .button({ rawtext: [{ translate: 'ui.admin.permissions.button.pearls' }, { text: '\n§8' }, { translate: pearlStatus }] })
        .button({ rawtext: [{ translate: 'ui.admin.permissions.button.public_blocks' }] })
        .button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 3) return adminManageSpecificZone(player, index);

            if (r.selection === 0) c.allowChests = !c.allowChests;
            else if (r.selection === 1) c.allowPearls = !c.allowPearls;
            else return adminBreakableBlocksManager(player, index);

            claims[index] = c;
            saveAdminClaims(claims);
            system.run(() => adminPermissionsMenu(player, index));
        });
}

function adminBreakableBlocksManager(player, index) {
    const claims = getCachedAdminClaims();
    const c = claims[index];
    c.breakableBlocks = c.breakableBlocks ?? [];

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.breakable.title' }] })
        .body({ rawtext: [{ translate: 'ui.admin.breakable.body', with: [c.name] }] });

    menu.button({ rawtext: [{ translate: 'ui.admin.breakable.button.add' }] });
    c.breakableBlocks.forEach(id => {
        menu.button({ rawtext: [{ translate: 'ui.admin.breakable.button.remove', with: [id] }] });
    });
    menu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === c.breakableBlocks.length + 1) return adminPermissionsMenu(player, index);

        if (r.selection === 0) {
            new ModalFormData()
                .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.breakable.add.title' }] })
                .textField({ rawtext: [{ translate: 'ui.admin.breakable.add.label' }] }, "minecraft:dirt")
                .show(player).then(res => {
                    if (res.canceled) return adminBreakableBlocksManager(player, index);
                    const id = res.formValues[0].toLowerCase();
                    if (id.includes(":") && !c.breakableBlocks.includes(id)) {
                        c.breakableBlocks.push(id);
                        claims[index] = c;
                        saveAdminClaims(claims);
                    }
                    adminBreakableBlocksManager(player, index);
                });
        } else {
            c.breakableBlocks.splice(r.selection - 1, 1);
            claims[index] = c;
            saveAdminClaims(claims);
            adminBreakableBlocksManager(player, index);
        }
    });
}

function adminWhitelistMenu(player, index) {
    const claims = getCachedAdminClaims();
    const c = claims[index];
    c.trusted = c.trusted ?? [];

    const trustedString = c.trusted.length > 0 ? c.trusted.join(", ") : "None";

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.whitelist.title' }] })
        .body({ rawtext: [{ translate: 'ui.admin.whitelist.body', with: [c.name, trustedString] }] })
        .button({ rawtext: [{ translate: 'ui.admin.whitelist.button.add' }] })
        .button({ rawtext: [{ translate: 'ui.admin.whitelist.button.remove' }] })
        .button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 2) return adminManageSpecificZone(player, index);
            const allPlayers = world.getAllPlayers().map(p => p.name);

            if (r.selection === 0) {
                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.whitelist.add.title' }] })
                    .dropdown({ rawtext: [{ translate: 'ui.admin.whitelist.add.label' }] }, allPlayers.length > 0 ? allPlayers : ["No Players Online"])
                    .show(player).then(res => {
                        if (res.canceled || allPlayers.length === 0) return adminWhitelistMenu(player, index);
                        const name = allPlayers[res.formValues[0]];
                        if (!c.trusted.includes(name)) c.trusted.push(name);
                        claims[index] = c;
                        saveAdminClaims(claims);
                        adminWhitelistMenu(player, index);
                    });
            } else {
                const sub = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.whitelist.remove.title' }] });
                if (c.trusted.length === 0) {
                    sub.body({ rawtext: [{ translate: 'ui.admin.whitelist.body.none' }] });
                    sub.button({ rawtext: [{ translate: 'ui.button.back' }] });
                } else {
                    c.trusted.forEach(n => sub.button(n));
                }

                sub.show(player).then(res => {
                    if (!res.canceled && c.trusted.length > 0) {
                        c.trusted.splice(res.selection, 1);
                        claims[index] = c;
                        saveAdminClaims(claims);
                    }
                    adminWhitelistMenu(player, index);
                });
            }
        });
}

system.runInterval(() => {
    const claims = getCachedAdminClaims();
    if (claims.length === 0) return;

    const protectedClaims = claims.filter(c => c.spawnProtection);
    if (protectedClaims.length > 0) {
        for (const player of world.getAllPlayers()) {
            if (!player.isValid) continue;

            const loc = player.location;
            for (const zone of protectedClaims) {
                if (isInside3D(loc, zone)) {
                    player.addEffect("resistance", 40, {
                        amplifier: 255,
                        showParticles: false
                    });
                    break;
                }
            }
        }
    }

    const VIEW_DIST = 64;
    const playersByDim = new Map();
    for (const p of world.getAllPlayers()) {
        if (!p.isValid) continue;
        const dimId = p.dimension.id;
        let arr = playersByDim.get(dimId);
        if (!arr) { arr = []; playersByDim.set(dimId, arr); }
        arr.push(p.location);
    }

    for (const zone of claims) {
        if (!zone.showParticles) continue;

        const dimId = zone.dimensionId || "minecraft:overworld";
        const dimPlayers = playersByDim.get(dimId);
        if (!dimPlayers) continue;

        const minX = Math.min(zone.x1, zone.x2) - VIEW_DIST;
        const maxX = Math.max(zone.x1, zone.x2) + VIEW_DIST;
        const minZ = Math.min(zone.z1, zone.z2) - VIEW_DIST;
        const maxZ = Math.max(zone.z1, zone.z2) + VIEW_DIST;

        let anyoneNear = false;
        for (const loc of dimPlayers) {
            if (loc.x >= minX && loc.x <= maxX && loc.z >= minZ && loc.z <= maxZ) { anyoneNear = true; break; }
        }
        if (anyoneNear) drawClaimFrame(zone.dimensionId, zone);
    }
}, 20);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid || !player.hasTag("AdminClaiming")) continue;

        const corners = player.getDynamicProperty("corners");
        if (corners === 1) {
            const raycast = player.getBlockFromViewDirection({ maxDistance: 64 });
            if (raycast && raycast.block) {
                const c1x = player.getDynamicProperty("c1x");
                const c1y = player.getDynamicProperty("c1y");
                const c1z = player.getDynamicProperty("c1z");
                const dimId = player.getDynamicProperty("cdim");

                if (player.dimension.id === dimId) {
                    const tempZone = {
                        x1: c1x,
                        y1: c1y,
                        z1: c1z,
                        x2: raycast.block.location.x,
                        y2: raycast.block.location.y,
                        z2: raycast.block.location.z
                    };
                    drawClaimFrame(dimId, tempZone);
                }
            }
        }
    }
}, 10);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid || !player.hasTag("AdminAllowAreaClaiming")) continue;

        const corners = player.getDynamicProperty("allowAreaCorners");
        if (corners === 1) {
            const raycast = player.getBlockFromViewDirection({ maxDistance: 64 });
            if (raycast && raycast.block) {
                const aa1x = player.getDynamicProperty("aa1x");
                const aa1z = player.getDynamicProperty("aa1z");
                const dimId = player.getDynamicProperty("aaDim");

                if (player.dimension.id === dimId) {
                    const tempZone = {
                        x1: aa1x,
                        z1: aa1z,
                        x2: raycast.block.location.x,
                        z2: raycast.block.location.z
                    };
                    drawAllowAreaFrame(dimId, player.location.y, tempZone);
                }
            }
        }
    }
}, 10);