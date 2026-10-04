import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import * as H from "../general/helpers";

const ENTITY_ID = "sh:trade";
const TITLE_IDLE = "§l§bTrade§r\n§5Removing in:§r 15s";
const TITLE_IN_USE = "§l§bTrade§r\n§2§lIN USE";
const UI_LORE = "ui_item";

const MY_OFFER_START = 0;
const OFFER_ZONE_SIZE = 18;
const THEIR_OFFER_START = 18;
const PARTNER_READY_SLOT = 39;
const READY_SLOT = 40;
const CANCEL_SLOT = 44;
const IDLE_REMOVE_TICKS = 300; 
const MAX_DISTANCE = 6;

const REQUEST_KEY = "tradeRequests";
const REQUEST_TIMEOUT_TICKS = 600;

function isTradingEnabled() {
    return world.getDynamicProperty("playerTrading") === true;
}

function getDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isUiItem(item) {
    if (!item) return false;
    const lore = item.getLore();
    return lore.length > 0 && lore[0].startsWith(UI_LORE);
}

function makeUiButton(typeId, nameTag, loreLines = []) {
    const item = new ItemStack(typeId, 1);
    item.nameTag = nameTag;
    item.setLore([UI_LORE, ...loreLines]);
    return item;
}

function itemSignature(item) {
    if (!item) return "empty";
    return `${item.typeId}:${item.amount}:${item.nameTag ?? ""}`;
}

function isLockedMirror(item) {
    return item.lockMode === ItemLockMode.slot;
}

function reclaimForeignItem(container, slot, owner, isExpected) {
    const item = container.getItem(slot);
    if (!item || isExpected(item)) return false;
    const ownerContainer = owner?.isValid ? owner.getComponent("inventory")?.container : undefined;
    if (ownerContainer) {
        const leftover = ownerContainer.addItem(item);
        if (leftover && owner.isValid) owner.dimension.spawnItem(leftover, owner.location);
    } else if (owner?.isValid) {
        owner.dimension.spawnItem(item, owner.location);
    }
    container.setItem(slot, undefined);
    return true;
}

function reclaimStrayItem(container, slot, owner) {
    return reclaimForeignItem(container, slot, owner, isUiItem);
}

export function getIncomingTradeRequests(player) {
    const requests = H.getData(REQUEST_KEY, []);
    return requests.filter(r => r.targetName === player.name);
}

function getOutgoingTradeRequest(player) {
    const requests = H.getData(REQUEST_KEY, []);
    return requests.find(r => r.requesterName === player.name);
}

function isAlreadyTrading(player) {
    for (const dimId of ["overworld", "nether", "the_end"]) {
        const ents = world.getDimension(dimId).getEntities({ type: ENTITY_ID });
        if (ents.some(e => e.isValid && e.getDynamicProperty("owner_id") === player.id)) return true;
    }
    return false;
}

function purgeIllegalItems(player) {
    let purged = false;
    
    const cursor = player.getComponent("cursor_inventory");
    if (cursor?.item && isUiItem(cursor.item)) {
        cursor.clear();
        purged = true;
    }

    const inv = player.getComponent("inventory")?.container;
    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (item && isUiItem(item)) {
                inv.setItem(i, undefined);
                purged = true;
            }
        }
    }
    return purged;
}

export function sendTradeRequest(sender, target) {
    if (!isTradingEnabled()) {
        sender.sendMessage({ rawtext: [{ translate: "command.trade.disabled" }] });
        return;
    }

    if (target.id === sender.id) {
        sender.sendMessage({ rawtext: [{ translate: "command.trade.cannot_self" }] });
        return;
    }

    if (isAlreadyTrading(sender) || isAlreadyTrading(target)) {
        sender.sendMessage({ rawtext: [{ translate: "command.trade.already_trading" }] });
        return;
    }

    const requests = H.getData(REQUEST_KEY, []);
    if (requests.find(r => r.requesterName === sender.name && r.targetName === target.name)) {
        sender.sendMessage({ rawtext: [{ translate: "message.trade.already_pending", with: [target.name] }] });
        return;
    }

    const request = { requesterName: sender.name, targetName: target.name };
    H.setData(REQUEST_KEY, [...requests, request]);

    sender.sendMessage({ rawtext: [{ translate: "message.trade.sent", with: [target.name] }] });
    target.sendMessage({ rawtext: [{ translate: "message.trade.received", with: [sender.name] }] });
    H.playClick(sender);

    system.runTimeout(() => {
        const current = H.getData(REQUEST_KEY, []);
        const stillExists = current.find(r => r.requesterName === sender.name && r.targetName === target.name);
        if (!stillExists) return;

        H.setData(REQUEST_KEY, current.filter(r => !(r.requesterName === sender.name && r.targetName === target.name)));

        if (world.getAllPlayers().some(p => p.id === sender.id)) {
            sender.sendMessage({ rawtext: [{ translate: "message.trade.expired", with: [target.name] }] });
        }
    }, REQUEST_TIMEOUT_TICKS);
}

export function acceptTradeRequest(player, requesterName = null) {
    const requests = H.getData(REQUEST_KEY, []);
    const incoming = requests.filter(r => r.targetName === player.name);

    if (incoming.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "command.tradeaccept.no_requests" }] });
        return;
    }

    const request = requesterName ? incoming.find(r => r.requesterName === requesterName) : incoming[incoming.length - 1];
    if (!request) {
        player.sendMessage({ rawtext: [{ translate: "command.tradeaccept.no_requests" }] });
        return;
    }

    H.setData(REQUEST_KEY, requests.filter(r => r !== request));

    const requester = world.getAllPlayers().find(p => p.name === request.requesterName);
    if (!requester) {
        player.sendMessage({ rawtext: [{ translate: "command.tradeaccept.requester_offline" }] });
        return;
    }
    if (!isTradingEnabled()) {
        player.sendMessage({ rawtext: [{ translate: "command.trade.disabled" }] });
        return;
    }
    if (isAlreadyTrading(player) || isAlreadyTrading(requester)) {
        player.sendMessage({ rawtext: [{ translate: "command.trade.already_trading" }] });
        return;
    }

    system.run(() => startTrade(requester, player))
}

export function declineTradeRequest(player, requesterName = null) {
    const requests = H.getData(REQUEST_KEY, []);
    const incoming = requests.filter(r => r.targetName === player.name);

    if (incoming.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "command.tradedecline.no_requests" }] });
        return;
    }

    const request = requesterName ? incoming.find(r => r.requesterName === requesterName) : incoming[incoming.length - 1];
    if (!request) {
        player.sendMessage({ rawtext: [{ translate: "command.tradedecline.no_requests" }] });
        return;
    }

    H.setData(REQUEST_KEY, requests.filter(r => r !== request));
    H.playCancel(player);
    player.sendMessage({ rawtext: [{ translate: "message.tradedecline.declined", with: [request.requesterName] }] });

    const requester = world.getAllPlayers().find(p => p.name === request.requesterName);
    if (requester) {
        requester.sendMessage({ rawtext: [{ translate: "message.tradedecline.was_declined", with: [player.name] }] });
    }
}

export function cancelActiveTrade(player) {
    for (const dimId of ["overworld", "nether", "the_end"]) {
        const ents = world.getDimension(dimId).getEntities({ type: ENTITY_ID });
        const mine = ents.find(e => e.isValid && e.getDynamicProperty("owner_id") === player.id);
        if (mine) {
            beginTeardown(mine, "command.tradecancel.you_cancelled", "message.tradecancel.partner_cancelled");
            player.sendMessage({ rawtext: [{ translate: "command.tradecancel.cancelled" }] });
            return;
        }
    }

    const outgoing = getOutgoingTradeRequest(player);
    if (outgoing) {
        const requests = H.getData(REQUEST_KEY, []);
        H.setData(REQUEST_KEY, requests.filter(r => r !== outgoing));
        player.sendMessage({ rawtext: [{ translate: "command.tradecancel.request_cancelled", with: [outgoing.targetName] }] });
        return;
    }

    player.sendMessage({ rawtext: [{ translate: "command.tradecancel.nothing_to_cancel" }] });
}

function spawnTradeEntityFor(player) {
    const rayHit = player.dimension.getBlockFromRay(player.getHeadLocation(), player.getViewDirection(), {
        maxDistance: 8,
        includePassableBlocks: true,
        includeLiquidBlocks: false
    });

    let ent;
    if (!rayHit) {
        ent = player.dimension.spawnEntity(ENTITY_ID, player.location);
    } else {
        const block = rayHit.block;
        let spawnX = block.location.x + 0.5;
        let spawnY = block.location.y - 1;
        let spawnZ = block.location.z + 0.5;
        switch (rayHit.face) {
            case "East": spawnX += 1; break;
            case "Up": spawnY += 2; break;
            case "South": spawnZ += 1; break;
            case "West": spawnX -= 1; break;
            case "Down": spawnY -= 1; break;
            case "North": spawnZ -= 1; break;
        }
        ent = player.dimension.spawnEntity(ENTITY_ID, { x: spawnX, y: spawnY, z: spawnZ });
    }

    ent.teleport(ent.location, { facingLocation: player.location });
    ent.nameTag = TITLE_IDLE;
    return ent;
}

function startTrade(playerA, playerB) {
    const entA = spawnTradeEntityFor(playerA);
    const entB = spawnTradeEntityFor(playerB);

    entA.setDynamicProperty("owner_id", playerA.id);
    entA.setDynamicProperty("partner_entity_id", entB.id);
    entA.setDynamicProperty("partner_player_id", playerB.id);
    entA.setDynamicProperty("partner_name", playerB.name);
    entA.setDynamicProperty("ready", false);

    entB.setDynamicProperty("owner_id", playerB.id);
    entB.setDynamicProperty("partner_entity_id", entA.id);
    entB.setDynamicProperty("partner_player_id", playerA.id);
    entB.setDynamicProperty("partner_name", playerA.name);
    entB.setDynamicProperty("ready", false);

    drawActionRow(entA);
    drawActionRow(entB);

    playerA.sendMessage({ rawtext: [{ translate: "message.trade.started", with: [playerB.name] }] });
    playerB.sendMessage({ rawtext: [{ translate: "message.trade.started", with: [playerA.name] }] });
    
    H.playSuccess(playerA);
    H.playSuccess(playerB);

    system.runTimeout(() => {
        if (entA.isValid && entA.nameTag === TITLE_IDLE) entA.remove();
        if (entB.isValid && entB.nameTag === TITLE_IDLE) entB.remove();
    }, IDLE_REMOVE_TICKS);
}

function drawActionRow(ent) {
    if (!ent.isValid) return;
    const container = ent.getComponent("inventory")?.container;
    if (!container) return;

    const ready = ent.getDynamicProperty("ready") === true;
    const partnerName = ent.getDynamicProperty("partner_name") ?? "?";

    const partnerEntityId = ent.getDynamicProperty("partner_entity_id");
    const partner = partnerEntityId ? safeGetEntity(partnerEntityId) : undefined;
    const partnerReady = partner?.isValid ? partner.getDynamicProperty("ready") === true : false;

    const partnerReadyItem = partnerReady
        ? makeUiButton("minecraft:emerald_block", `§a§l${partnerName} is ready!`, ["§7They've locked in their offer."])
        : makeUiButton("minecraft:redstone_block", `§7${partnerName} isn't ready yet`, ["§7They haven't locked in their offer."]);
    container.setItem(PARTNER_READY_SLOT, partnerReadyItem);

    const readyItem = ready
        ? makeUiButton("minecraft:emerald_block", "§a§lREADY", ["§7Click to unlock and keep editing"])
        : makeUiButton("minecraft:redstone_block", "§e§lCLICK TO LOCK IN", ["§7Locks your offer so the trade can complete", `§7${partnerName} must also be ready`]);
    container.setItem(READY_SLOT, readyItem);

    container.setItem(CANCEL_SLOT, makeUiButton("minecraft:barrier", "§c§lCANCEL TRADE", ["§7Returns all items to both players"]));
}

function giveZoneToPlayer(container, startSlot, size, recipient) {
    const recipientContainer = recipient?.isValid ? recipient.getComponent("inventory")?.container : undefined;

    for (let i = 0; i < size; i++) {
        const slot = startSlot + i;
        const item = container.getItem(slot);
        container.setItem(slot, undefined);
        if (!item) continue;

        if (recipientContainer) {
            const leftover = recipientContainer.addItem(item);
            if (leftover) recipient.dimension.spawnItem(leftover, recipient.location);
        } else if (recipient?.isValid) {
            recipient.dimension.spawnItem(item, recipient.location);
        }
    }
}

function dropZoneAtEntity(ent, container, startSlot, size) {
    for (let i = 0; i < size; i++) {
        const slot = startSlot + i;
        const item = container.getItem(slot);
        container.setItem(slot, undefined);
        if (item) ent.dimension.spawnItem(item, ent.location);
    }
}

function completeTrade(entA, entB) {
    const containerA = entA.getComponent("inventory")?.container;
    const containerB = entB.getComponent("inventory")?.container;
    if (!containerA || !containerB) return;

    const ownerA = world.getAllPlayers().find(p => p.id === entA.getDynamicProperty("owner_id"));
    const ownerB = world.getAllPlayers().find(p => p.id === entB.getDynamicProperty("owner_id"));

    if (ownerB?.isValid) {
        giveZoneToPlayer(containerA, MY_OFFER_START, OFFER_ZONE_SIZE, ownerB);
    } else {
        dropZoneAtEntity(entA, containerA, MY_OFFER_START, OFFER_ZONE_SIZE);
    }
    if (ownerA?.isValid) {
        giveZoneToPlayer(containerB, MY_OFFER_START, OFFER_ZONE_SIZE, ownerA);
    } else {
        dropZoneAtEntity(entB, containerB, MY_OFFER_START, OFFER_ZONE_SIZE);
    }

    for (const [ent, owner] of [[entA, ownerA], [entB, ownerB]]) {
        if (owner?.isValid) {
            owner.sendMessage({ rawtext: [{ translate: "message.trade.complete" }] });
            H.playSuccess(owner);
        }
    }

    entA.remove();
    entB.remove();
}

function beginTeardown(ent, ownerMessageKey, partnerMessageKey) {
    if (!ent.isValid) return;
    const container = ent.getComponent("inventory")?.container;
    const owner = world.getAllPlayers().find(p => p.id === ent.getDynamicProperty("owner_id"));

    if (container) {
        if (owner?.isValid) {
            giveZoneToPlayer(container, MY_OFFER_START, OFFER_ZONE_SIZE, owner);
        } else {
            dropZoneAtEntity(ent, container, MY_OFFER_START, OFFER_ZONE_SIZE);
        }
    }

    if (owner?.isValid && ownerMessageKey) {
        owner.sendMessage({ rawtext: [{ translate: ownerMessageKey }] });
        H.playCancel(owner);
    }

    const partnerEntityId = ent.getDynamicProperty("partner_entity_id");
    if (partnerEntityId) {
        const partner = safeGetEntity(partnerEntityId);
        if (partner && partner.isValid) {
            partner.setDynamicProperty("partner_ended", partnerMessageKey ?? "message.trade.ended");
        }
    }

    ent.remove();
}

function safeGetEntity(id) {
    try {
        return world.getEntity(id);
    } catch {
        return undefined;
    }
}

system.runInterval(() => {
    const seen = new Set();
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;
        let nearby;
        try {
            nearby = player.dimension.getEntities({ type: ENTITY_ID, location: player.location, maxDistance: MAX_DISTANCE + 4 });
        } catch (e) { continue; }
        for (const ent of nearby) {
            if (seen.has(ent.id)) continue;
            seen.add(ent.id);
            processTradeEntity(ent);
        }
    }
}, 2);

system.runInterval(() => {
    for (const dimId of ["overworld", "nether", "the_end"]) {
        let entities;
        try {
            entities = world.getDimension(dimId).getEntities({ type: ENTITY_ID });
        } catch (e) { continue; }

        for (const ent of entities) {
            processTradeEntity(ent);
        }
    }
}, 100);

function processTradeEntity(ent) {
    if (!ent.isValid) return;

    const owner = world.getAllPlayers().find(p => p.id === ent.getDynamicProperty("owner_id"));

    if (owner?.isValid) {
        purgeIllegalItems(owner);
    }

    if (!owner || !owner.isValid || getDistance(owner.location, ent.location) > MAX_DISTANCE) {
        beginTeardown(ent, owner ? "message.trade.walked_away" : null, "message.trade.partner_disconnected");
        return;
    }

    const partnerEndedKey = ent.getDynamicProperty("partner_ended");
    if (partnerEndedKey) {
        const container = ent.getComponent("inventory")?.container;
        if (container) giveZoneToPlayer(container, MY_OFFER_START, OFFER_ZONE_SIZE, owner);
        owner.sendMessage({ rawtext: [{ translate: partnerEndedKey }] });
        H.playCancel(owner);
        ent.remove();
        return;
    }

    if (ent.nameTag !== TITLE_IN_USE) return;

    const container = ent.getComponent("inventory")?.container;
    if (!container) return;

    const partnerEntityId = ent.getDynamicProperty("partner_entity_id");
    const partner = partnerEntityId ? safeGetEntity(partnerEntityId) : undefined;
    if (!partner || !partner.isValid) {
        beginTeardown(ent, "message.trade.partner_disconnected", null);
        return;
    }
    const partnerContainer = partner.getComponent("inventory")?.container;
    if (!partnerContainer) return;

    let reclaimedAny = false;
    for (const slot of [PARTNER_READY_SLOT, READY_SLOT, CANCEL_SLOT]) {
        if (reclaimStrayItem(container, slot, owner)) reclaimedAny = true;
    }

    for (let i = 0; i < OFFER_ZONE_SIZE; i++) {
        const slot = THEIR_OFFER_START + i;
        reclaimForeignItem(container, slot, owner, isLockedMirror);

        const theirsReal = partnerContainer.getItem(MY_OFFER_START + i);
        const mirroredNow = container.getItem(slot);
        
        if (itemSignature(theirsReal) !== itemSignature(mirroredNow)) {
            if (theirsReal) {
                const shown = theirsReal.clone();
                shown.lockMode = ItemLockMode.slot;
                
                const currentLore = shown.getLore();
                shown.setLore([UI_LORE, ...currentLore]);
                
                container.setItem(slot, shown);
            } else {
                container.setItem(slot, undefined);
            }
        }
    }

    const readyNow = ent.getDynamicProperty("ready") === true;
    const readySlotItem = container.getItem(READY_SLOT);
    const expectedReadyId = readyNow ? "minecraft:emerald_block" : "minecraft:redstone_block";
    if (!readySlotItem || readySlotItem.typeId !== expectedReadyId) {
        ent.setDynamicProperty("ready", !readyNow);
        H.playClick(owner);

        const partnerReady = partner.getDynamicProperty("ready") === true;
        if (!readyNow && partnerReady) {
            completeTrade(ent, partner);
            return;
        }
        drawActionRow(ent);
        drawActionRow(partner);
        return; 
    }

    const cancelSlotItem = container.getItem(CANCEL_SLOT);
    if (!cancelSlotItem || cancelSlotItem.typeId !== "minecraft:barrier") {
        beginTeardown(ent, "command.tradecancel.you_cancelled", "message.tradecancel.partner_cancelled");
        return;
    }

    if (reclaimedAny) drawActionRow(ent);
}

world.afterEvents.playerInteractWithEntity.subscribe(evd => {
    const { target, player } = evd;
    if (target.typeId !== ENTITY_ID) return;

    if (player.id !== target.getDynamicProperty("owner_id")) {
        player.sendMessage({ rawtext: [{ translate: "message.trade.not_yours" }] });
        H.playDenied(player);
        const loc = { ...player.location };
        player.teleport({ x: loc.x, y: loc.y + 5, z: loc.z });
        system.runTimeout(() => {
            if (player.isValid) player.teleport(loc);
        }, 1);
        return;
    }

    if (target.nameTag !== TITLE_IN_USE) {
        target.nameTag = TITLE_IN_USE;
    }
});