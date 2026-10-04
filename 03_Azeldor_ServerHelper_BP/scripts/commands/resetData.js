import { world } from "@minecraft/server"
import { registerCommand } from "../commandRegister";

const commandInformation = {
    name: "resetdata",
    description: "Resets all of you worlds dynamic properties",
    usage: [],
    permissionLevel: 3
};

registerCommand(commandInformation, (origin) => {
    const sender = origin.sourceEntity;
    if (!sender) return;
    for (const id of world.getDynamicPropertyIds()) world.setDynamicProperty(id, undefined)
    world.sendMessage({rawtext: [{translate: 'message.resetdata'}]})
});

export default commandInformation;
