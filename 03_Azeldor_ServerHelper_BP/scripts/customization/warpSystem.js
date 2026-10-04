import * as H from "../general/helpers";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";

export function addWarp(player) {
    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.warp.add.title' }] })
        .textField({ rawtext: [{ translate: 'ui.warp.add.name_label' }] }, "Spawn")
        .textField("X", { rawtext: [{ translate: 'ui.warp.add.coord_placeholder' }] })
        .textField("Y", { rawtext: [{ translate: 'ui.warp.add.coord_placeholder' }] })
        .textField("Z", { rawtext: [{ translate: 'ui.warp.add.coord_placeholder' }] })
        .show(player).then(r => {
            if (r.canceled || !player.isValid) return; 

            const [n, xIn, yIn, zIn] = r.formValues;
            
            if (!n || n.trim() === "") {
                player.sendMessage({ rawtext: [{ translate: 'message.warp.error.empty_name' }] });
                H.playDenied(player);
                return;
            }

            const x = xIn === "" ? player.location.x : parseFloat(xIn);
            const y = yIn === "" ? player.location.y : parseFloat(yIn);
            const z = zIn === "" ? player.location.z : parseFloat(zIn);

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                player.sendMessage({ rawtext: [{ translate: 'message.warp.error.invalid_coords' }] });
                H.playDenied(player);
                return;
            }

            const warps = H.getData("worldwarps") || {};
            warps[n] = { x, y, z, dimension: player.dimension.id };
            H.setData("worldwarps", warps);
            
            player.sendMessage({ rawtext: [{ translate: 'message.warp.created' }] });
            H.playSuccess(player);
        });
}

export function removeWarp(player) {
    const warps = H.getData("worldwarps") || {};
    const keys = Object.keys(warps);
    
    if (keys.length === 0) {
        player.sendMessage({ rawtext: [{ translate: 'message.warp.error.none_to_remove' }] });
        H.playDenied(player);
        return;
    }

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.warp.remove.title' }] });
        
    keys.forEach(k => menu.button(k));
    
    menu.show(player).then(r => {
        if (r.canceled || !player.isValid) return; 
        
        delete warps[keys[r.selection]];
        H.setData("worldwarps", warps);
        
        player.sendMessage({ rawtext: [{ translate: 'message.warp.deleted' }] });
        H.playCancel(player);
    });
}

export function listWarps(player) {
    const warps = H.getData("worldwarps") || {};
    const keys = Object.keys(warps);
    
    if (keys.length === 0) {
        player.sendMessage({ rawtext: [{ translate: 'message.warp.error.none_set' }] });
        return;
    }

    let messagePayload = { 
        rawtext: [
            { translate: "warps.list" }, 
            { text: "\n§r" }
        ] 
    };
    
    keys.forEach(k => {
        const x = Math.trunc(warps[k].x);
        const y = Math.trunc(warps[k].y);
        const z = Math.trunc(warps[k].z);
        const dim = warps[k].dimension.replace("minecraft:", "");

        messagePayload.rawtext.push({ text: `§7- §f${k} §8[§7${x}, ${y}, ${z}§8]\n` });
    });
    
    player.sendMessage(messagePayload);
}