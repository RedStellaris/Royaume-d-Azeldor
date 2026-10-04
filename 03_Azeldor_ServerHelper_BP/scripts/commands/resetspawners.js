import { world } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "resetspawners",
    description: "Use if you swapped from server helper v3.6.7 to any higher version!",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    if (!H.isOp(sender)) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_permission" }] });
        return;
    }

    H.setData("spawners", {});
    H.setData("activespawners", {});

    sender.sendMessage({ rawtext: [{ translate: "message.resetspawners.success" }] });
});

export default commandInformation;
