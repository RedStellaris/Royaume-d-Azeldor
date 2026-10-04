import { world, system, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const unbanCommandInfo = {
    name: "unban",
    description: "Unban a player from the server",
    usage: [{ name: "playerName", type: CustomCommandParamType.String, optional: false }]
};

registerCommand(unbanCommandInfo, (origin, targetName) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    if (!H.isOp(sender)) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_permission" }] });
        return;
    }

    if (!targetName) {
        sender.sendMessage({ rawtext: [{ translate: "command.unban.specify_name" }] });
        return;
    }

    world.setDynamicProperty(`banned_${targetName}`, false);
    world.setDynamicProperty(`ban_exp_${targetName}`, 0);
    
    const list = H.getData("banned_list", []);
    const index = list.indexOf(targetName);
    
    if (index !== -1) {
        list.splice(index, 1);
        H.setData("banned_list", list);
        sender.sendMessage({ rawtext: [{ translate: "message.admin.unbanned_player", with: [targetName] }] });
        H.playCancel(sender);
    } else {
        sender.sendMessage({ rawtext: [{ translate: "message.admin.unbanned_not_listed", with: [targetName] }] });
        H.playDenied(sender);
    }
});

export default unbanCommandInfo;