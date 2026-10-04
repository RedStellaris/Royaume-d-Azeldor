import { world, system, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "tpahere",
    description: "Requests a player to teleport to your current location.",
    usage: [{ name: "player", type: CustomCommandParamType.String, optional: false }]
};

registerCommand(commandInformation, (origin, targetName) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    if (!world.getDynamicProperty("tpa")) {
        sender.sendMessage({ rawtext: [{ translate: "command.tpa.disabled" }] });
        return;
    }

    if (!targetName) {
        sender.sendMessage({ rawtext: [{ translate: "command.tpahere.specify_player" }] });
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
        sender.sendMessage({ rawtext: [{ translate: "command.general.no_player_found" }] });
        return;
    }

    if (targetPlayer.id === sender.id) {
        sender.sendMessage({ rawtext: [{ translate: "command.tpa.cannot_self" }] });
        return;
    }

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

    system.run(() => {
        const requests = H.getData("teleportRequest") || [];

        if (requests.find(r => r.targetName === targetPlayer.name && r.requesterName === sender.name)) {
            sender.sendMessage({ rawtext: [{ translate: "message.tpa.already_pending", with: [targetPlayer.name] }] });
            return;
        }

        sender.sendMessage({ rawtext: [{ translate: "message.tpahere.sent", with: [targetPlayer.name] }] });
        targetPlayer.sendMessage({ rawtext: [{ translate: "message.tpahere.received", with: [sender.name] }] });

        const request = {
            requesterName: sender.name,
            targetName: targetPlayer.name,
            type: "tpahere",
            requesterPos: { ...sender.location },
            targetPos: { ...targetPlayer.location },
            requesterDimId: sender.dimension.id,
            targetDimId: targetPlayer.dimension.id
        };

        H.setData("teleportRequest", [...requests, request]);

        system.runTimeout(() => {
            const current = H.getData("teleportRequest") || [];
            H.setData("teleportRequest", current.filter(r => !(r.requesterName === sender.name && r.targetName === targetPlayer.name)));
        }, 600);
    });
});

export default commandInformation;
