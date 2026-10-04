import * as H from "../general/helpers"
import { ActionFormData } from "@minecraft/server-ui"
import { ModerationMenu } from "./moderationUi"
import { helperMenu } from "../misc/helperMenu"

export default function ClaimManage(player) {
    const claims = H.getData("worldclaims") || {};
    const keys = Object.keys(claims);
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.claims.title' }] });

    keys.forEach(key => {
        const claimName = claims[key].name 
            ? { rawtext: [{ text: claims[key].name }] } 
            : { rawtext: [{ translate: 'ui.claims.unknown' }] };
        form.button(claimName, "textures/ui/Friend2");
    });

    form.button({ rawtext: [{ translate: 'ui.general.button.back' }] }, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return H.isOp(player) ? ModerationMenu(player) : helperMenu(player);

        const selectedKey = keys[r.selection];
        const claim = claims[selectedKey];
        const displayClaimName = claim.name || "Unknown";

        new ActionFormData()
            .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.claims.manage.title', with: [displayClaimName] }] })
            .button({ rawtext: [{ translate: 'ui.claims.button.remove' }] }, "textures/ui/trash_default")
            .button({ rawtext: [{ translate: 'ui.claims.button.teleport', with: [String(claim.x1), String(claim.z1)] }] }, "textures/items/map_empty")
            .button({ rawtext: [{ translate: 'ui.general.button.back' }] }, "textures/ui/back")
            .show(player).then(res => {
                if (res.canceled || res.selection === 2) return managePlayerClaims(player);

                if (res.selection === 0) {
                    delete claims[selectedKey];
                    H.getData("worldclaims", claims);
                    player.sendMessage({ translate: 'message.claims.removed' });
                    return managePlayerClaims(player);
                }

                if (res.selection === 1) {
                    player.teleport({ x: claim.x1, y: claim.y1 ?? 150, z: claim.z1 });
                    player.sendMessage({ translate: 'message.claims.teleported', with: [displayClaimName] });
                }
            });
    });
}