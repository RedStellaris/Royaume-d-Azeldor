import { world, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const stripCodes = (str) => str.replace(/§[0-9a-fk-or]/gi, "");

const commandInformation = {
    name: "balance",
    description: "Checks player balance",
    aliases: ["bal"],
    usage: [
        { name: "player", type: CustomCommandParamType.String, optional: false },
        { name: "objective", type: CustomCommandParamType.String, optional: false }
    ]
};
registerCommand(commandInformation, (origin, targetName, targetScoreboard) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    const allPlayers = world.getAllPlayers();
    const searchNamePlayer = targetName.toLowerCase();

    let targetPlayer = allPlayers.find(p =>
        p.name.toLowerCase() === searchNamePlayer ||
        p.nameTag.toLowerCase() === searchNamePlayer
    );

    if (!targetPlayer) {
        const partialMatches = allPlayers.filter(p =>
            p.name.toLowerCase().includes(searchNamePlayer) ||
            p.nameTag.toLowerCase().includes(searchNamePlayer)
        );

        if (partialMatches.length === 1) {
            targetPlayer = partialMatches[0];
        } else if (partialMatches.length > 1) {
            sender.sendMessage({ rawtext: [{ translate: "command.general.multiple_players_matching", with: [targetName] }] });
            return;
        }
    }

    if (!targetPlayer) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_player_matching", with: [targetName] }] });
        return;
    }

    const allObjectives = world.scoreboard.getObjectives();
    const searchNameScore = targetScoreboard.toLowerCase();

    const objective = allObjectives.find(obj => {
        const idMatch = obj.id.toLowerCase() === searchNameScore;
        const displayMatch = stripCodes(obj.displayName).toLowerCase() === searchNameScore;
        return idMatch || displayMatch;
    });

    if (!objective) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.scoreboard_not_found", with: [targetScoreboard] }] });
        return;
    }

    let score = 0;
    try {
        score = objective.getScore(targetPlayer) ?? 0;
    } catch (e) {
        score = 0;
    }

    sender.sendMessage({ rawtext: [{ translate: "message.balance.result", with: [targetPlayer.name, String(score), stripCodes(objective.displayName)] }] });
});

export default commandInformation;
