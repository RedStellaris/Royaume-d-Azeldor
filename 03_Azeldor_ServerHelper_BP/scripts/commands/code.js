import { world, system, CustomCommandParamType, ItemStack } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "code",
    description: "Input a code for a reward!",
    usage: [{ name: "code", type: CustomCommandParamType.String, optional: false }]
};

registerCommand(commandInformation, (origin, code) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    system.run(() => {
        const codeData = H.getData("redeem_codes") || {};
        const container = sender.getComponent("inventory")?.container;

        if (!codeData[code]) {
            sender.sendMessage({ rawtext: [{ translate: "command.code.invalid" }] });
            return;
        }

        if (sender.hasTag(code)) {
            sender.sendMessage({ rawtext: [{ translate: "command.code.already_redeemed" }] });
            return;
        }

        sender.sendMessage({ rawtext: [{ translate: "message.code.redeemed_header" }] });

        if (codeData[code].items) {
            for (const item of codeData[code].items) {
                let remaining = item.amount;
                const maxStack = 64;

                const cleanName = item.typeId.includes(":") ? item.typeId.split(":")[1].replace(/_/g, " ").toUpperCase() : item.typeId.toUpperCase();
                sender.sendMessage({ rawtext: [{ translate: "message.code.item_line", with: [String(item.amount), cleanName] }] });

                while (remaining > 0) {
                    const currentAmount = Math.min(remaining, maxStack);
                    const itemStack = new ItemStack(item.typeId, currentAmount);

                    const leftover = container.addItem(itemStack);
                    if (leftover) sender.dimension.spawnItem(leftover, sender.location);

                    remaining -= currentAmount;
                }
            }
        }

        if (codeData[code].scoreboards) {
            for (const scoreboard of codeData[code].scoreboards) {
                sender.runCommand(`scoreboard players add @s "${scoreboard.objective}" ${scoreboard.amount}`);
                sender.sendMessage({ rawtext: [{ translate: "message.code.scoreboard_line", with: [String(scoreboard.amount), scoreboard.objective.toUpperCase()] }] });
            }
        }

        sender.addTag(code);
        sender.playSound("random.levelup");
    });
});

export default commandInformation;
