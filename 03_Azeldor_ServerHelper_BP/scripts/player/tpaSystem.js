import { world, system } from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"
import { PlayerMainMenu } from "./playerUi"
import * as H from "../general/helpers"

export function TPAMainMenu(player) {
    const incoming = H.getData("teleportRequest", []).filter(r => r.targetName === player.name);
    const existing = player.dimension.getEntities({ type: "sh:pv" });
    
    if (existing.some(ent => ent.getDynamicProperty("owner_id") === player.id)) {
        return player.sendMessage({ rawtext: [{ translate: "tpa.message.vault_active" }] });
    }
    
    const combatCache = H.getData("incombat", {});
    if (combatCache[player.id]) {
        return player.sendMessage({ rawtext: [{ translate: "tpa.message.in_combat" }] });
    }

    let menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, {text: "TPA"}]})
        .button({ rawtext: [{ translate: "tpa.menu.main.button.send" }] });

    if (incoming.length > 0) {
        menu.button({ rawtext: [{ translate: "tpa.menu.main.button.accept", with: [String(incoming.length)] }] });
    }

    menu.show(player).then(r => {
        if (r.canceled) return;
        if (r.selection === 0) tpaSendMenu(player);
        else tpaAcceptMenu(player, incoming);
    });
}

function tpaSendMenu(player) {
    const targets = world.getAllPlayers().filter(p => p.name !== player.name);
    
    if (targets.length === 0) {
        return player.sendMessage({ rawtext: [{ translate: "tpa.message.no_players" }] });
    }

    let menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, {text: "TPA"}]});
    targets.forEach(p => menu.button({ rawtext: [{ translate: "tpa.menu.send.button.player", with: [p.name] }] }));

    menu.show(player).then(r => {
        if (r.canceled) return typeof tpamenu === "function" ? tpamenu(player) : null;
        
        const target = targets[r.selection];
        const reqs = H.getData("teleportRequest", []);
        
        if (reqs.find(req => req.requesterName === player.name && req.targetName === target.name)) {
            return player.sendMessage({ rawtext: [{ translate: "tpa.message.request_pending" }] });
        }

        const newRequest = { requesterName: player.name, targetName: target.name };
        H.setData("teleportRequest", [...reqs, newRequest]);

        player.sendMessage({ rawtext: [{ translate: "tpa.message.request_sent", with: [target.name] }] });
        target.sendMessage({ rawtext: [{ translate: "tpa.message.request_received", with: [player.name] }] });

        system.runTimeout(() => {
            const currentReqs = H.getData("teleportRequest", []);
            const stillExists = currentReqs.find(req => req.requesterName === player.name && req.targetName === target.name);

            if (stillExists) {
                const filtered = currentReqs.filter(req => !(req.requesterName === player.name && req.targetName === target.name));
                H.setData("teleportRequest", filtered);

                if (world.getAllPlayers().includes(player)) {
                    player.sendMessage({ rawtext: [{ translate: "tpa.message.request_expired", with: [target.name] }] });
                }
            }
        }, 600);
    });
}

function tpaAcceptMenu(player, incoming) {
    let menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "tpa.menu.accept.title" }] });
    incoming.forEach(r => menu.button({ rawtext: [{ translate: "tpa.menu.accept.button.player", with: [r.requesterName] }] }));

    menu.show(player).then(r => {
        if (r.canceled) return typeof tpamenu === "function" ? tpamenu(player) : null;
        const req = incoming[r.selection];

        const currentReqs = H.getData("teleportRequest", []);
        const stillValid = currentReqs.find(item => item.requesterName === req.requesterName && item.targetName === player.name);

        if (!stillValid) {
            return player.sendMessage({ rawtext: [{ translate: "tpa.message.expired_accept" }] });
        }

        const requester = world.getAllPlayers().find(p => p.name === req.requesterName);
        if (requester) {
            H.startTeleportWithDelay(requester, player.location, player.dimension, player.name);
            player.sendMessage({ rawtext: [{ translate: "tpa.message.accepted" }] });
            
            const delay = world.getDynamicProperty("teleportDelay") ?? 5;
            for (let i = delay - 1; i > 0; i--) {
                system.runTimeout(() => {
                    player.playSound("note.chime", player.location);
                }, (delay - i) * 20);
            }
        } else {
            player.sendMessage({ rawtext: [{ translate: "tpa.message.offline" }] });
        }

        H.setData("teleportRequest", currentReqs.filter(item => !(item.requesterName === req.requesterName && item.targetName === player.name)));
    });
}