import { world, system, CustomCommandParamType, ItemStack } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "spawner",
    description: "Give yourself a custom spawner",
    usage: [
        { name: "spawnerType", type: CustomCommandParamType.EntityType, optional: false },
        { name: "amount", type: CustomCommandParamType.Integer, optional: true }
    ]
};

registerCommand(commandInformation, (origin, type, amount) => {
    const player = origin.sourceEntity;
    if (!player) return;

    if (!H.isOp(player)) {
        player.sendMessage({ rawtext: [{ translate: "command.general.no_permission" }] });
        return;
    }

    system.run(() => {
        const count = amount && amount > 0 ? amount : 1;
        const container = player.getComponent("minecraft:inventory").container;
        const refStack = new ItemStack("sh:mob_spawner", 1);
        const maxStack = refStack.maxAmount;

        let remaining = count;
        let totalFailed = 0;

        while (remaining > 0) {
            const giveAmount = Math.min(remaining, maxStack);
            const stackToGive = new ItemStack("sh:mob_spawner", giveAmount);
            stackToGive.setLore([type.id]);

            const remainder = container.addItem(stackToGive);
            if (remainder) {
                totalFailed += remainder.amount;
            }
            remaining -= giveAmount;
        }

        if (totalFailed > 0) {
            const successAmount = count - totalFailed;
            if (successAmount > 0) {
                player.sendMessage({ rawtext: [{ translate: "message.spawner.given_partial", with: [String(successAmount), String(totalFailed)] }] });
            } else {
                player.sendMessage({ rawtext: [{ translate: "command.spawner.inventory_full" }] });
            }
        } else {
            player.sendMessage({ rawtext: [{ translate: "message.spawner.given_full", with: [String(count)] }] });
        }
    });
});

export default commandInformation;
