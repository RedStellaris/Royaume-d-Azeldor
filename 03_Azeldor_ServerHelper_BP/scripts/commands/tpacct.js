import { world, system } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "tpacct",
    description: "Accepts the most recent TPA or TPAHERE request",
    usage: []
};

registerCommand(commandInformation, (origin) => {
    const player = origin.sourceEntity;
    if (!player) return;

    system.run(() => {
        const requests = H.getData("teleportRequest") || [];
        const playerRequests = requests.filter(r => r.targetName === player.name);
        const tpDelaySeconds = world.getDynamicProperty("teleportTime") ?? 3;

        if (playerRequests.length === 0) {
            player.sendMessage({ rawtext: [{ translate: "command.tpacct.no_requests" }] });
            return;
        }

        const recentRequest = playerRequests[playerRequests.length - 1];
        const requester = world.getAllPlayers().find(p => p.name === recentRequest.requesterName);

        if (!requester) {
            player.sendMessage({ rawtext: [{ translate: "command.tpacct.requester_offline" }] });
            H.setData("teleportRequest", requests.filter(r => r !== recentRequest));
            return;
        }

        const isTpaHere = recentRequest.type === "tpahere";

        const mover = isTpaHere ? player : requester;
        const anchor = isTpaHere ? requester : player;

        const startReqPos = { ...requester.location };
        const startTarPos = { ...player.location };

        mover.sendMessage({ rawtext: [{ translate: "message.tpacct.teleporting_mover", with: [anchor.name, String(tpDelaySeconds)] }] });
        anchor.sendMessage({ rawtext: [{ translate: "message.tpacct.teleporting_anchor", with: [mover.name, String(tpDelaySeconds)] }] });

        for (let i = tpDelaySeconds - 1; i > 0; i--) {
            system.runTimeout(() => {
                if (player.isValid && requester.isValid) {
                    player.runCommand("playsound note.chime @s");
                    requester.runCommand("playsound note.chime @s");
                }
            }, (tpDelaySeconds - i) * 20);
        }

        const moveCheckID = system.runInterval(() => {
            if (!requester.isValid || !player.isValid) {
                system.clearRun(moveCheckID);
                system.clearRun(timeoutID);
                return;
            }

            const rMoved = Math.hypot(requester.location.x - startReqPos.x, requester.location.z - startReqPos.z) > 0.5;
            const tMoved = Math.hypot(player.location.x - startTarPos.x, player.location.z - startTarPos.z) > 0.5;

            if (rMoved || tMoved) {
                requester.sendMessage({ rawtext: [{ translate: "command.tpacct.cancelled_movement" }] });
                player.sendMessage({ rawtext: [{ translate: "command.tpacct.cancelled_movement" }] });

                system.clearRun(timeoutID);
                system.clearRun(moveCheckID);
            }
        }, 1);

        const timeoutID = system.runTimeout(() => {
            system.clearRun(moveCheckID);

            if (mover.isValid && anchor.isValid) {
                mover.teleport(anchor.location, { dimension: anchor.dimension });
                player.runCommand("playsound mob.endermen.portal @s");

                mover.sendMessage({ rawtext: [{ translate: "message.tpacct.teleported", with: [anchor.name] }] });
                anchor.sendMessage({ rawtext: [{ translate: "message.tpacct.arrived", with: [mover.name] }] });
            }
        }, tpDelaySeconds * 20);

        H.setData("teleportRequest", requests.filter(r => r !== recentRequest));
    });
});

export default commandInformation;
