import { declineTradeRequest } from "../misc/tradeSystem";
import { registerCommand } from "../commandRegister";

const commandInformation = {
    name: "tradedecline",
    description: "Declines the most recent incoming trade request.",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;
    declineTradeRequest(player);
});

export default commandInformation;
