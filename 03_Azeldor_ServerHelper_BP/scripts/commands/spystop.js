import { system } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import { stopSpy } from "../moderation/spySystem";
import * as H from "../general/helpers";

const commandInformation = {
    name: "spystop",
    description: "Stops spying on a player",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;

    system.run(() => {
        if (stopSpy(player)) {
            player.sendMessage({ rawtext: [{ translate: "message.spystop.stopped" }] });

            system.runTimeout(() => {
                if (player.isValid) {
                    player.runCommand("camera @s clear");
                }
            }, 5);
        } else {
            player.sendMessage({ rawtext: [{ translate: "command.spystop.not_spying" }] });
        }
    });
});

export default commandInformation;