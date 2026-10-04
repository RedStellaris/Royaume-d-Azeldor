import { world, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import { sendTradeRequest } from "../misc/tradeSystem";

const commandInformation = {
    name: "trade",
    description: "Sends a trade request to a specific player.",
    usage: [{ name: "player", type: CustomCommandParamType.String, optional: false }]
};

registerCommand(commandInformation, (origin, targetName) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    if (!targetName) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.specify_player_name" }] });
        return;
    }

    const matches = world.getAllPlayers().filter(p =>
        p.name.toLowerCase().startsWith(targetName.toLowerCase())
    );

    if (matches.length === 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_player_found" }] });
        return;
    }
    if (matches.length > 1) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.multiple_players_found" }] });
        return;
    }

    sendTradeRequest(sender, matches[0]);
});

export default commandInformation;
