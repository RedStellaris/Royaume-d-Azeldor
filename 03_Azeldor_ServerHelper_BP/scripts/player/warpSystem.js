import { world } from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"
import * as H from "../general/helpers"
import { PlayerMainMenu } from "./playerUi"

export function WarpMenu(player) {
    const combatCache = H.getData("incombat", {});
    
    if (combatCache[player.id]) {
        return player.sendMessage({ rawtext: [{ translate: "message.teleport.combat" }] });
    }
    
    const existing = player.dimension.getEntities({ type: "sh:pv" });
    if (existing.some(ent => ent.getDynamicProperty("owner_id") === player.id)) {
        return player.sendMessage({ rawtext: [{ translate: "message.teleport.active_vault" }] });
    }

    let warps = H.getData("worldwarps");
    const warpNames = Object.keys(warps);
    
    if (warpNames.length === 0) {
        return player.sendMessage({ rawtext: [{ translate: "message.warp.empty" }] });
    }

    let menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "form.warp.title" }] });
    
    warpNames.forEach(name => {
        menu.button({ rawtext: [{ translate: "form.warp.button", with: [name] }] });
    });

    menu.show(player).then(r => {
        if (r.canceled) return PlayerMainMenu(player);
        const warp = warps[warpNames[r.selection]];
        H.startTeleportWithDelay(player, warp, world.getDimension(warp.dimension), warpNames[r.selection]);
    });
}