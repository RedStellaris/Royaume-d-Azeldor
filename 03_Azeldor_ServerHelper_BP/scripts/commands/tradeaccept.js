import { acceptTradeRequest } from "../misc/tradeSystem";
import { registerCommand } from "../commandRegister";

const commandInformation = {
    name: "tradeaccept",
    description: "Accepts the most recent incoming trade request.",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;
    acceptTradeRequest(player);
});

export default commandInformation;
