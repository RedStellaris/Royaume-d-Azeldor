import { world, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInfo = {
    name: "staffchat",
    description: "Send a private message to all staff",
    aliases: ["sc"],
    usage: [
        {
            name: "message",
            type: "String",
            optional: false
        }
    ],
    permissionLevel: 2
};

registerCommand(commandInfo, (origin, message) => {
    const sender = origin.sourceEntity;
    if (!(sender instanceof Player)) return;

    const isStaff = H.isOp(sender) || sender.hasTag("dev") || sender.hasTag("helper");

    if (!isStaff) {
        sender.sendMessage({ rawtext: [{ translate: "command.staffchat.no_permission" }] });
        return;
    }

    if (!message || message.trim() === "") {
        sender.sendMessage({ rawtext: [{ translate: "command.staffchat.empty_message" }] });
        return;
    }

    for (const player of world.getAllPlayers()) {
        const isRecipientStaff = H.isOp(player) || player.hasTag("dev") || player.hasTag("helper");

        if (isRecipientStaff) {
            player.sendMessage({ rawtext: [{ translate: "message.staffchat.broadcast", with: [sender.name, message] }] });
        }
    }
});

export default commandInfo;
