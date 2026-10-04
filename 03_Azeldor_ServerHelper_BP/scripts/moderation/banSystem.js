import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { BanMenu, BanStatusMenu } from "./moderationUi";
import * as H from "../general/helpers";

function processBan(admin, name, durationStr) {
    world.setDynamicProperty(`banned_${name}`, true);
    
    let expirationTime = 0;
    let isPermanent = true;
    if (durationStr && durationStr.trim() !== "") {
        const minutes = parseInt(durationStr);
        if (!isNaN(minutes) && minutes > 0) {
            expirationTime = Date.now() + (minutes * 60000);
            isPermanent = false;
        }
    }
    world.setDynamicProperty(`ban_exp_${name}`, expirationTime);

    const list = H.getData("banned_list", []);
    
    if (!list.includes(name)) {
        list.push(name);
        H.setData("banned_list", list);
    }
    
    if (admin && admin.isValid) {
        if (isPermanent) {
            admin.sendMessage({ rawtext: [{ translate: "message.admin.banned_player_permanent", with: [name] }] });
        } else {
            admin.sendMessage({ rawtext: [{ translate: "message.admin.banned_player_temporary", with: [name, durationStr] }] });
        }
        H.playDenied(admin);
    }
}

function processUnban(admin, name) {
    world.setDynamicProperty(`banned_${name}`, false);
    world.setDynamicProperty(`ban_exp_${name}`, 0);
    
    const list = H.getData("banned_list", []);
    const index = list.indexOf(name);
    
    if (index !== -1) {
        list.splice(index, 1);
        H.setData("banned_list", list);
    }
    
    if (admin && admin.isValid) {
        admin.sendMessage({ rawtext: [{ translate: "message.admin.unbanned_player", with: [name] }] });
        H.playCancel(admin);
    }
}

export async function BanPlayerOffline(admin) {
    const r = await new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.ban.offline.title" }] })
        .textField({ translate: "ui.general.enter_username" }, { translate: "ui.general.username_placeholder" })
        .textField({ translate: "ui.ban.duration_field" }, { translate: "ui.ban.duration_placeholder" })
        .show(admin);
        
    if (r.canceled || !r.formValues?.[0]) return BanStatusMenu(admin);
    
    processBan(admin, r.formValues[0], r.formValues[1]);
    return BanStatusMenu(admin);
}

export async function UnbanPlayerOffline(admin) {
    const r = await new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.unban.offline.title" }] })
        .textField({ translate: "ui.general.enter_username" }, { translate: "ui.general.username_placeholder" })
        .show(admin);
        
    if (r.canceled || !r.formValues?.[0]) return BanMenu(admin);
    processUnban(admin, r.formValues[0]);
    return BanMenu(admin);
}

export const BanPlayerOnline = H.TargetActionForm(
    "ui.ban.select.title",
    async (admin, target) => {
        const r = await new ModalFormData()
            .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.ban.online_duration.title" }] })
            .textField({ translate: "ui.ban.duration_field_target", with: [target.name] }, { translate: "ui.ban.duration_placeholder" })
            .show(admin);

        if (r.canceled) return BanPlayerOnline(admin);

        processBan(admin, target.name, r.formValues[0]);
        
        if (target.isValid) {
            admin.runCommand(`kick "${target.name}" message.ban.kick`);
        }
        BanPlayerOnline(admin);
    },
    undefined,
    (admin) => BanStatusMenu(admin)
);

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn || !player.isValid) return;

    if (world.getDynamicProperty(`banned_${player.name}`)) {
        const expiration = world.getDynamicProperty(`ban_exp_${player.name}`);
        
        if (expiration && expiration > 0 && Date.now() > expiration) {
            processUnban(null, player.name);
            return;
        }

        world.getDimension("overworld").runCommand(`kick "${player.name}" message.ban.join_kick`);
    }
});