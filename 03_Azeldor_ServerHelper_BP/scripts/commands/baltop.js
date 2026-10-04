import { world } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const stripCodes = (str) => str.replace(/§[0-9a-fk-or]/gi, "");

const commandInformation = {
    name: "baltop",
    description: "Shows the top 10 wealthiest players",
    aliases: ["topmoney", "lb"],
    usage: [{ name: "objective", type: "String", optional: false }]
};

registerCommand(commandInformation, (origin, targetScoreboard) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    const allObjectives = world.scoreboard.getObjectives();
    const searchName = targetScoreboard.toLowerCase();

    const objective = allObjectives.find(obj => {
        const idMatch = obj.id.toLowerCase() === searchName;
        const displayMatch = stripCodes(obj.displayName).toLowerCase() === searchName;
        return idMatch || displayMatch;
    });

    if (!objective) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.scoreboard_not_found", with: [targetScoreboard] }] });
        return;
    }

    const scores = objective.getScores()
        .filter(s => s.participant.displayName !== "commands.scoreboard.players.offlinePlayerName")
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    if (scores.length === 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.baltop.no_scores" }] });
        return;
    }

    const cleanName = stripCodes(objective.displayName);
    const rawtextEntries = [{ translate: "message.baltop.header", with: [cleanName.toUpperCase()] }];

    scores.forEach((scoreData, index) => {
        const pos = index + 1;
        const name = scoreData.participant.displayName;
        const value = scoreData.score.toLocaleString();

        rawtextEntries.push({ text: "\n" });
        rawtextEntries.push({ translate: "message.baltop.entry", with: [String(pos), name, value] });
    });

    sender.sendMessage({ rawtext: rawtextEntries });
});

export default commandInformation;
