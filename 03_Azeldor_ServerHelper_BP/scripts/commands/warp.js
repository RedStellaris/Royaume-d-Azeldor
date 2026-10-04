import { world, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "warp",
    description: "Warp to set locations",
    usage: [{ name: "location", type: CustomCommandParamType.String, optional: false }]
};

registerCommand(commandInformation, (origin, location) => {
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

    const warps = H.getData("worldwarps") || {};
    const warpNames = Object.keys(warps);

    if (warpNames.length === 0) {
        sender.sendMessage({ rawtext: [{ translate: "command.warp.none_available" }] });
        return;
    }

    const actualWarpName = warpNames.find(n => n.toLowerCase() === location.toLowerCase());
    const warp = warps[actualWarpName];

    if (!warp) {
        sender.sendMessage({ rawtext: [{ translate: "command.warp.invalid", with: [warpNames.join(", ")] }] });
        return;
    }

    try {
        H.startTeleportWithDelay(sender, warp, world.getDimension(warp.dimension), actualWarpName);
    } catch (e) {
        console.warn(`Warp Error: ${e}`);
    }
});

export default commandInformation;
