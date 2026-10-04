import { world, system } from "@minecraft/server";
import * as H from "../general/helpers";

function getPlayerParty(parties, playerName) {
    for (const [leader, members] of Object.entries(parties)) {
        if (members.includes(playerName)) return leader;
    }
    return null;
}

world.beforeEvents.entityHurt.subscribe((ev) => {
    const victim = ev.hurtEntity;
    const attacker = ev.damageSource.damagingEntity;

    if (!victim?.isValid || !attacker?.isValid) return;
    if (victim.typeId !== "minecraft:player" || attacker.typeId !== "minecraft:player") return;

    const parties = H.getData("parties") || {};
    const victimParty = getPlayerParty(parties, victim.name);

    if (!victimParty) return;

    const attackerParty = getPlayerParty(parties, attacker.name);

    if (victimParty === attackerParty) {
        ev.cancel = true;
    }
});

world.afterEvents.playerLeave.subscribe((event) => {
    const playerName = event.playerName;
    const parties = H.getData("parties") || {};

    const currentParty = getPlayerParty(parties, playerName);
    if (!currentParty) return;

    if (currentParty === playerName) {
        if (parties[playerName].length > 1) {
            const newLeader = parties[playerName].find(m => m !== playerName);
            parties[newLeader] = parties[playerName].filter(m => m !== playerName);
            delete parties[playerName];
            H.setData("parties", parties);

            system.run(() => {
                parties[newLeader].forEach(memberName => {
                    const memberPlayer = world.getPlayers({ name: memberName })[0];
                    if (memberPlayer?.isValid) {
                        memberPlayer.sendMessage({ 
                            rawtext: [{ 
                                translate: "message.party.leader_left", 
                                with: [playerName, newLeader] 
                            }] 
                        });
                    }
                });
            });
        } else {
            delete parties[playerName];
            H.setData("parties", parties);
        }
    } else {
        parties[currentParty] = parties[currentParty].filter(m => m !== playerName);
        H.setData("parties", parties);

        system.run(() => {
            const leaderPlayer = world.getPlayers({ name: currentParty })[0];
            if (leaderPlayer?.isValid) {
                leaderPlayer.sendMessage({ 
                    rawtext: [{ 
                        translate: "message.party.member_left", 
                        with: [playerName] 
                    }] 
                });
            }
        });
    }
});