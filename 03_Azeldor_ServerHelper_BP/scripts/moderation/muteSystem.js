import * as H from "../general/helpers"

export function mutePlayer(admin, target) {
    if (target.hasTag("muted")) {
        admin.sendMessage({ rawtext: [{ translate: "message.mute.already_muted" }] });
        H.playDenied(admin);
    } else { 
        target.addTag("muted"); 
        admin.sendMessage({ rawtext: [{ translate: "message.mute.success", with: [target.name] }] }); 
        H.playClick(admin);
        if (target.isValid) target.playSound("mob.wolf.growl");
    }
}

export function unmutePlayer(admin, target) {
    if (!target.hasTag("muted")) return;
    target.removeTag("muted");
    admin.sendMessage({ rawtext: [{ translate: "message.unmute.success" }] });
    H.playCancel(admin);
}