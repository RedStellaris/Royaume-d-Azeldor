import { world, system, Player } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "bazaar",
    description: "Spawns the Bazaar entity",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player || !(player instanceof Player)) return;

    const menuCommandsEnabled = world.getDynamicProperty("menuCommands");
    if (!menuCommandsEnabled) {
        player.sendMessage({ rawtext: [{ translate: "command.menu_commands.disabled" }] });
        return;
    }

    const isMenuEnabled = world.getDynamicProperty("bazaar");
    if (!isMenuEnabled) {
        player.sendMessage({ rawtext: [{ translate: "command.bazaar.disabled" }] });
        return;
    }

    let alreadyExists = false;
    for (const dim of ["overworld", "nether", "the_end"]) {
        const existing = world.getDimension(dim).getEntities({ type: "sh:bazaar_ent" });
        if (existing.some(ent => ent.getDynamicProperty("owner_id") === player.id)) {
            alreadyExists = true;
            break;
        }
    }

    if (alreadyExists) {
        system.run(() => player.sendMessage({ rawtext: [{ translate: "command.bazaar.already_active" }] }));
        return;
    }

    system.run(() => {
        let ent;

        const rayHit = player.dimension.getBlockFromRay(player.getHeadLocation(), player.getViewDirection(), {
            maxDistance: 8,
            includePassableBlocks: true,
            includeLiquidBlocks: false
        });

        if (!rayHit) {
            ent = player.dimension.spawnEntity("sh:bazaar_ent", player.location);
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

            ent = player.dimension.spawnEntity("sh:bazaar_ent", {
                x: spawnX,
                y: spawnY,
                z: spawnZ
            });
        }

        ent.teleport(ent.location, { facingLocation: player.location });

        const idleNameTag = "§l§eBazaar§r\n§5Removing in:§r 5s";

        ent.nameTag = idleNameTag;
        ent.setDynamicProperty("owner_id", player.id);
        ent.setDynamicProperty("current_page", 0);
        ent.setDynamicProperty("cat_index", 0);
        ent.setDynamicProperty("sort_index", 0);
        ent.setDynamicProperty("view_mode", 0);

        system.runTimeout(() => {
            if (ent.isValid && ent.nameTag === idleNameTag) ent.remove();
        }, 100);
    });
});

export default commandInformation;