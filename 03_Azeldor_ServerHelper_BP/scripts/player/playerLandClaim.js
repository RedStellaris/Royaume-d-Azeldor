import { world, system, MolangVariableMap } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";
import { PlayerMainMenu } from "./playerUi";

let cachedPlayerClaims = {};
let lastCacheTick = -1;

function getCachedPlayerClaims() {
    const currentTick = system.currentTick;
    if (currentTick - lastCacheTick > 20 || lastCacheTick === -1) {
        cachedPlayerClaims = H.getData("worldclaims", {});
        lastCacheTick = currentTick;
    }
    return cachedPlayerClaims;
}

function savePlayerClaims(claims) {
    H.setData("worldclaims", claims);
    cachedPlayerClaims = claims;
    lastCacheTick = system.currentTick;
}

function getClaimSize(rect) {
    return (Math.abs(rect.x2 - rect.x1) + 1) * (Math.abs(rect.z2 - rect.z1) + 1);
}

function drawClaimFrame2D(dimensionId, yLevel, zone) {
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
    } catch (e) {}
}

export function landclaimadd(player) {
    const claims = getCachedPlayerClaims();
    if (claims[player.id]) return player.sendMessage({ rawtext: [{ translate: "landclaim.msg.already_have" }] });
    player.addTag("Claiming");
    player.sendMessage({ rawtext: [{ translate: "landclaim.msg.claim_enabled" }] });
}

export function LandClaimMenu(player) {
    const claims = getCachedPlayerClaims();
    const hasClaim = !!claims[player.id];

    if (world.getDynamicProperty("landclaim") === false) {
        return player.sendMessage({ rawtext: [{ translate: "landclaim.error.disabled" }] });
    }

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.menu.title" }] })
        .button(
            hasClaim 
                ? { rawtext: [{ translate: "landclaim.menu.manage.has_claim" }] } 
                : { rawtext: [{ translate: "landclaim.menu.manage.no_claim" }] }, 
            "textures/items/paper"
        )
        .button(
            hasClaim 
                ? { rawtext: [{ translate: "landclaim.menu.new.overwrite" }] } 
                : { rawtext: [{ translate: "landclaim.menu.new.start" }] }, 
            "textures/ui/color_plus"
        )
        .button({ rawtext: [{ translate: "landclaim.menu.remove" }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: "landclaim.menu.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 3) return PlayerMainMenu(player);
            switch (r.selection) {
                case 0: LandClaimManage(player); break;
                case 1: landclaimadd(player); break;
                case 2: LandClaimRemove(player); break;
            }
        });
}

function LandClaimManage(player) {
    const claims = getCachedPlayerClaims();
    const c = claims[player.id];
    const max = world.getDynamicProperty("maxland") ?? 500;

    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.manage.title" }] });

    if (!c) {
        menu.body({ rawtext: [{ translate: "landclaim.manage.limit", with: [String(max)] }] });
        menu.button({ rawtext: [{ translate: "landclaim.menu.back" }] }, "textures/ui/back");
    } else {
        const size = getClaimSize(c);
        menu.body({ rawtext: [{ translate: "landclaim.manage.details", with: [String(size), String(max), String(c.x1), String(c.z1), String(c.x2), String(c.z2)] }] });
        menu.button({ rawtext: [{ translate: "landclaim.manage.resize" }] }, "textures/items/feather");
        menu.button({ rawtext: [{ translate: "landclaim.manage.permissions" }] }, "textures/items/iron_pickaxe");
        menu.button({ rawtext: [{ translate: "landclaim.manage.trusted" }] }, "textures/items/paper");
        menu.button({ rawtext: [{ translate: "landclaim.menu.back" }] }, "textures/ui/back");
    }

    menu.show(player).then(r => {
        if (r.canceled || (c && r.selection === 3) || (!c && r.selection === 0)) return LandClaimMenu(player);

        if (r.selection === 0) {
            player.addTag("Claiming");
            player.sendMessage({ rawtext: [{ translate: "landclaim.msg.resize_enabled" }] });
        } else if (r.selection === 1) PermissionsMenu(player);
        else if (r.selection === 2) WhitelistMenu(player);
    });
}

function PermissionsMenu(player) {
    const claims = getCachedPlayerClaims();
    const c = claims[player.id];
    if (!c) return;

    c.allowChests = !!(c.allowChests ?? false);
    c.allowPearls = !!(c.allowPearls ?? false);

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.perms.title" }] })
        .button(
            c.allowChests 
                ? { rawtext: [{ translate: "landclaim.perms.chests.allowed" }] } 
                : { rawtext: [{ translate: "landclaim.perms.chests.denied" }] }
        )
        .button(
            c.allowPearls 
                ? { rawtext: [{ translate: "landclaim.perms.pearls.allowed" }] } 
                : { rawtext: [{ translate: "landclaim.perms.pearls.denied" }] }
        )
        .button({ rawtext: [{ translate: "landclaim.perms.public_blocks" }] })
        .button({ rawtext: [{ translate: "landclaim.menu.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 3) return LandClaimManage(player);

            if (r.selection === 0) {
                c.allowChests = !c.allowChests;
                claims[player.id] = c;
                savePlayerClaims(claims);
                system.run(() => PermissionsMenu(player));
            } else if (r.selection === 1) {
                c.allowPearls = !c.allowPearls;
                claims[player.id] = c;
                savePlayerClaims(claims);
                system.run(() => PermissionsMenu(player));
            } else if (r.selection === 2) {
                BreakableBlocksManager(player);
            }
        });
}

function LandClaimRemove(player) {
    const claims = getCachedPlayerClaims();
    const c = claims[player.id];
    if (!c) return player.sendMessage({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.msg.not_found" }] });

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.remove.title" }] })
        .label({ rawtext: [{ translate: "landclaim.remove.label", with: [String(c.x1), String(c.z1), String(c.x2), String(c.z2)] }] })
        .textField(
            { rawtext: [{ translate: "landclaim.remove.textfield.label", with: [player.name] }] }, 
            { rawtext: [{ translate: "landclaim.remove.textfield.placeholder" }] }
        )
        .show(player).then(res => {
            if (res.canceled) return LandClaimMenu(player);

            if (res.formValues[1] === player.name) {
                delete claims[player.id];
                savePlayerClaims(claims);
                player.sendMessage({ rawtext: [{ translate: "landclaim.msg.removed" }] });
                LandClaimMenu(player);
            } else {
                player.sendMessage({ rawtext: [{ translate: "landclaim.msg.mismatch" }] });
            }
        });
}

function BreakableBlocksManager(player) {
    const claims = getCachedPlayerClaims();
    const c = claims[player.id];
    c.breakableBlocks = c.breakableBlocks ?? [];

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.breakable.title" }] })
        .body({ rawtext: [{ translate: "landclaim.breakable.body" }] });

    menu.button({ rawtext: [{ translate: "landclaim.breakable.add" }] });
    c.breakableBlocks.forEach(id => menu.button({ rawtext: [{ translate: "landclaim.breakable.remove", with: [id] }] }));
    menu.button({ rawtext: [{ translate: "landclaim.menu.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === c.breakableBlocks.length + 1) return PermissionsMenu(player);
        if (r.selection === 0) {
            new ModalFormData()
                .title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.breakable.modal.title" }] })
                .textField(
                    { rawtext: [{ translate: "landclaim.breakable.modal.label" }] }, 
                    "minecraft:dirt"
                )
                .show(player).then(res => {
                    if (res.canceled) return BreakableBlocksManager(player);
                    const id = res.formValues[0].toLowerCase();
                    if (id.includes(":") && !c.breakableBlocks.includes(id)) {
                        c.breakableBlocks.push(id);
                        claims[player.id] = c;
                        savePlayerClaims(claims);
                    }
                    BreakableBlocksManager(player);
                });
        } else {
            c.breakableBlocks.splice(r.selection - 1, 1);
            claims[player.id] = c;
            savePlayerClaims(claims);
            BreakableBlocksManager(player);
        }
    });
}

function WhitelistMenu(player) {
    const claims = getCachedPlayerClaims();
    const c = claims[player.id];
    c.trusted = c.trusted ?? [];

    const trustedList = c.trusted.join(", ");

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.trusted.title" }] })
        .body(
            trustedList.length > 0 
                ? { rawtext: [{ translate: "landclaim.trusted.body.list", with: [trustedList] }] }
                : { rawtext: [{ translate: "landclaim.trusted.body.none" }] }
        )
        .button({ rawtext: [{ translate: "landclaim.trusted.add" }] })
        .button({ rawtext: [{ translate: "landclaim.trusted.remove" }] })
        .button({ rawtext: [{ translate: "landclaim.menu.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 2) return LandClaimManage(player);
            const allPlayers = world.getAllPlayers().map(p => p.name);

            if (r.selection === 0) {
                new ModalFormData()
                    .title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.trusted.modal.title_add" }] })
                    .dropdown({ rawtext: [{ translate: "landclaim.trusted.modal.label" }] }, allPlayers.length > 0 ? allPlayers : ["No Players Online"])
                    .show(player).then(res => {
                        if (res.canceled || allPlayers.length === 0) return WhitelistMenu(player);
                        const target = allPlayers[res.formValues[0]];
                        if (!c.trusted.includes(target)) c.trusted.push(target);
                        claims[player.id] = c;
                        savePlayerClaims(claims);
                        WhitelistMenu(player);
                    });
            } else {
                const sub = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "landclaim.trusted.modal.title_remove" }] });
                if (c.trusted.length === 0) {
                    sub.body({ rawtext: [{ translate: "landclaim.trusted.body.none" }] });
                    sub.button({ rawtext: [{ translate: "landclaim.menu.back" }] });
                } else {
                    c.trusted.forEach(n => sub.button(n));
                }
                
                sub.show(player).then(res => {
                    if (!res.canceled && c.trusted.length > 0) {
                        c.trusted.splice(res.selection, 1);
                        claims[player.id] = c;
                        savePlayerClaims(claims);
                    }
                    WhitelistMenu(player);
                });
            }
        });
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.isValid || !player.hasTag("Claiming")) continue;

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
                        z1: c1z,
                        x2: raycast.block.location.x,
                        z2: raycast.block.location.z
                    };
                    drawClaimFrame2D(dimId, c1y, tempZone);
                }
            }
        }
    }
}, 10);