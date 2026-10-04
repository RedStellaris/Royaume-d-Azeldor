import { cancelActiveTrade } from "../misc/tradeSystem";
import { registerCommand } from "../commandRegister";

const commandInformation = {
    name: "tradecancel",
    description: "Cancels your active trade, or an outgoing request you sent.",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;
    cancelActiveTrade(player);
});

export default commandInformation;
