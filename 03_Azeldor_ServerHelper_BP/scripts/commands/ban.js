import { world, system, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const banCommandInfo = {
    name: "ban",
    description: "Ban a player from the server",
    usage: [
        { name: "target", type: CustomCommandParamType.PlayerSelector, optional: false },
        { name: "time_in_minutes", type: CustomCommandParamType.Integer, optional: true }
    ]
};

registerCommand(banCommandInfo, (origin, targetPlayers, timeStr) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    if (!H.isOp(sender)) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_permission" }] });
        return;
    }

    if (!targetPlayers || targetPlayers.length === 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.ban.no_target_found" }] });
        return;
    }

    let expirationTime = 0;
    let isPermanent = true;
    if (timeStr !== "") {
        const minutes = parseInt(timeStr);
        if (!isNaN(minutes) && minutes > 0) {
            expirationTime = Date.now() + (minutes * 60000);
            isPermanent = false;
        }
    }

    targetPlayers.forEach(targetPlayer => {
        const name = targetPlayer.name;
        world.setDynamicProperty(`banned_${name}`, true);
        world.setDynamicProperty(`ban_exp_${name}`, expirationTime);

        const list = H.getData("banned_list", []);
        if (!list.includes(name)) {
            list.push(name);
            H.setData("banned_list", list);
        }
        
        if (isPermanent) {
            sender.sendMessage({ rawtext: [{ translate: "message.admin.banned_player_permanent", with: [name] }] });
        } else {
            sender.sendMessage({ rawtext: [{ translate: "message.admin.banned_player_temporary", with: [name, timeStr] }] });
        }
        H.playDenied(sender);
        
        if (targetPlayer.isValid) {
            system.run(() => world.getDimension("overworld").runCommand(`kick "${name}" message.ban.kick`));
        }
    });
});

export default banCommandInfo;