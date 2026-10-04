import { world, system, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const stripCodes = (str) => str.replace(/§[0-9a-fk-or]/gi, "");

const commandInformation = {
    name: "pay",
    description: "Send money to a player using partial names",
    usage: [
        { name: "player", type: CustomCommandParamType.String, optional: false },
        { name: "currency", type: CustomCommandParamType.String, optional: false },
        { name: "amount", type: CustomCommandParamType.Integer, optional: false }
    ]
};

registerCommand(commandInformation, (origin, partialName, currencyInput, amount) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    const matches = world.getAllPlayers().filter(p =>
        p.name.toLowerCase().startsWith(partialName.toLowerCase())
    );

    if (matches.length === 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_player_found" }] });
        return;
    }
    if (matches.length > 1) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.multiple_players_found" }] });
        return;
    }

    const targetPlayer = matches[0];
    if (targetPlayer.id === sender.id) {
        sender.sendMessage({ rawtext: [{ translate: "command.pay.cannot_pay_self" }] });
        return;
    }

    const allObjectives = world.scoreboard.getObjectives();
    const searchName = currencyInput.toLowerCase();
    const objective = allObjectives.find(obj =>
        obj.id.toLowerCase() === searchName ||
        stripCodes(obj.displayName).toLowerCase() === searchName
    );

    if (!objective) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.currency_not_found", with: [currencyInput] }] });
        return;
    }

    const tradeables = JSON.parse(world.getDynamicProperty("tradeables") ?? "[]");
    if (!(objective.id in tradeables)) {
        sender.sendMessage({ rawtext: [{ translate: "command.pay.not_tradeable" }] });
        return;
    }

    if (amount <= 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.pay.invalid_amount" }] });
        return;
    }

    let currentBalance = 0;
    try {
        currentBalance = objective.getScore(sender) ?? 0;
    } catch (e) {
        currentBalance = 0;
    }

    if (currentBalance < amount) {
        sender.sendMessage({ rawtext: [{ translate: "command.pay.insufficient_funds" }] });
        return;
    }

    system.run(() => {
        objective.addScore(sender, -amount);
        objective.addScore(targetPlayer, amount);

        const currencyName = stripCodes(objective.displayName);
        sender.sendMessage({ rawtext: [{ translate: "message.pay.sent", with: [String(amount), currencyName, targetPlayer.name] }] });
        targetPlayer.sendMessage({ rawtext: [{ translate: "message.pay.received", with: [sender.name, String(amount), currencyName] }] });

        sender.runCommand("playsound random.levelup @s");
        targetPlayer.runCommand("playsound random.levelup @s");
        H.spawnRewardParticle(sender.dimension, sender.location);
        H.spawnRewardParticle(targetPlayer.dimension, targetPlayer.location);
    });
});

export default commandInformation;
