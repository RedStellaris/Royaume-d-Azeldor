import { world, system, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "invsee",
    description: "Spy on a players inventory",
    usage: [{ name: "player", type: CustomCommandParamType.String, optional: false }]
};

registerCommand(commandInformation, (origin, targetName) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    if (!H.isOp(sender)) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_permission" }] });
        return;
    }

    if (!targetName) {
        sender.sendMessage({ rawtext: [{ translate: "command.invsee.specify_name" }] });
        return;
    }

    const matches = world.getAllPlayers().filter(p =>
        p.name.toLowerCase().startsWith(targetName.toLowerCase())
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

    if (!targetPlayer) {
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_player_named" }] });
        return;
    }

    system.run(() => {
        const player = sender;
        let ent;
        const rayHit = player.dimension.getBlockFromRay(player.getHeadLocation(), player.getViewDirection(), {
            maxDistance: 8,
            includePassableBlocks: true,
            includeLiquidBlocks: false
        });

        if (!rayHit) {
            ent = player.dimension.spawnEntity("sh:inventory", player.location);
        } else {
            const block = rayHit.block;
            let spawnX = block.location.x + 0.5;
            let spawnY = block.location.y - 1;
            let spawnZ = block.location.z + 0.5;

            if (rayHit.face === "East") spawnX += 1;
            if (rayHit.face === "Up") spawnY += 2;
            if (rayHit.face === "South") spawnZ += 1;
            if (rayHit.face === "West") spawnX -= 1;
            if (rayHit.face === "Down") spawnY -= 1;
            if (rayHit.face === "North") spawnZ -= 1;

            ent = player.dimension.spawnEntity("sh:inventory", { x: spawnX, y: spawnY, z: spawnZ });
        }

        ent.teleport(ent.location, { facingLocation: player.location });

        const idleNameTag = "§lInventory Viewer§r\n§5Removing in:§r 5s";
        ent.nameTag = idleNameTag;
        ent.setDynamicProperty("owner_id", player.id);
        ent.setDynamicProperty("target", JSON.stringify(targetPlayer));

        system.runTimeout(() => {
            if (ent.isValid && ent.nameTag === idleNameTag) ent.remove();
        }, 100);
    });
});

export default commandInformation;
