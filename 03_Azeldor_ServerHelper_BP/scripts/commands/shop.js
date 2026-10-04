import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import { OpenMainMenu } from "../misc/economy"
import * as H from "../general/helpers";

const commandInformation = {
    name: "shop",
    description: "Opens the shop",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player || !(player instanceof Player)) return;

    system.run(() => {
        const shopEnabled = world.getDynamicProperty("economy");
        if (!shopEnabled) {
            player.sendMessage({ rawtext: [{ translate: "command.shop.disabled" }] });
            return;
        }

        OpenMainMenu(player);
    });
});

export default commandInformation;
