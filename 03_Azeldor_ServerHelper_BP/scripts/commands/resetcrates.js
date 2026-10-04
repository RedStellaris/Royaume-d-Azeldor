import { world } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "resetcrates",
    description: "Fixes corrupted crate data",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    if (!H.isOp(sender)) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_permission" }] });
        return;
    }

    H.setData("crates", {});
    sender.sendMessage({ rawtext: [{ translate: "message.resetcrates.success" }] });
});

export default commandInformation;
