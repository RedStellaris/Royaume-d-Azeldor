import { world, system } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "spawn",
    description: "Teleport to the world spawn point",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    const combatCache = H.getData("incombat") || {};
    if (combatCache[sender.id]) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.combat_teleport_blocked" }] });
        return;
    }

    const existing = sender.dimension.getEntities({ type: "sh:pv" });
    if (existing.some(ent => ent.getDynamicProperty("owner_id") === sender.id)) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.vault_teleport_blocked" }] });
        return;
    }

    const overworld = world.getDimension("overworld");
    let spawnLoc = world.getDefaultSpawnLocation();

    if (spawnLoc.y === 32767) {
        const topBlock = overworld.getTopmostBlock({ x: spawnLoc.x, z: spawnLoc.z });
        spawnLoc = topBlock
            ? { x: spawnLoc.x, y: topBlock.location.y + 1, z: spawnLoc.z }
            : { x: spawnLoc.x, y: 64, z: spawnLoc.z };
    }

    try {
        H.startTeleportWithDelay(sender, spawnLoc, overworld, "Spawn");
    } catch (e) {
        console.warn(`Spawn Error: ${e}`);
    }
});

export default commandInformation;
