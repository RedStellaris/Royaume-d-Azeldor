import { world, system, CustomCommandParamType } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "party",
    description: "Sends a teleportation request to a specific player.",
    usage: [
        {
            name: "type",
            type: ["create", "invite", "accept", "leave", "msg"],
            optional: false
        },
        {
            name: "player",
            type: CustomCommandParamType.String,
            optional: true
        }
    ]
};

registerCommand(commandInformation, (origin, type, targetName) => {
    const sender = origin.sourceEntity;
    if (!sender) return;

    system.run(() => {
        let parties = H.getData("parties") || {};
        let invites = H.getData("party_invites") || {};

        const getPlayerParty = (playerName) => {
            for (const [leader, members] of Object.entries(parties)) {
                if (members.includes(playerName)) return leader;
            }
            return null;
        };

        const senderName = sender.name;
        const currentParty = getPlayerParty(senderName);

        if (type === "create") {
            if (currentParty) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.already_in_party" }] });
                return;
            }

            parties[senderName] = [senderName];
            H.setData("parties", parties);
            sender.sendMessage({ rawtext: [{ translate: "message.party.created" }] });
            sender.playSound("random.levelup");
        }
        else if (type === "invite") {
            if (!targetName) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.specify_invite" }] });
                return;
            }
            if (currentParty !== senderName) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.not_leader" }] });
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
                sender.sendMessage({ rawtext: [{ translate: "command.party.player_offline" }] });
                return;
            }

            if (getPlayerParty(targetPlayer.name)) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.target_already_in_party" }] });
                return;
            }

            invites[targetPlayer.name] = senderName;
            H.setData("party_invites", invites);

            sender.sendMessage({ rawtext: [{ translate: "message.party.invited", with: [targetPlayer.name] }] });
            targetPlayer.sendMessage({ rawtext: [{ translate: "message.party.invite_received", with: [senderName, senderName] }] });
            targetPlayer.playSound("random.orb");
        }
        else if (type === "accept") {
            if (!targetName) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.specify_leader" }] });
                return;
            }
            if (currentParty) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.already_in_party_leave_first" }] });
                return;
            }

            const inviteLeader = invites[senderName];
            if (!inviteLeader || inviteLeader.toLowerCase() !== targetName.toLowerCase()) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.no_pending_invite" }] });
                return;
            }

            if (!parties[inviteLeader]) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.leader_party_gone" }] });
                delete invites[senderName];
                H.setData("party_invites", invites);
                return;
            }

            parties[inviteLeader].push(senderName);
            delete invites[senderName];

            H.setData("parties", parties);
            H.setData("party_invites", invites);

            sender.sendMessage({ rawtext: [{ translate: "message.party.joined", with: [inviteLeader] }] });
            sender.playSound("random.levelup");

            const leaderPlayer = world.getAllPlayers().find(p => p.name === inviteLeader);
            if (leaderPlayer) {
                leaderPlayer.sendMessage({ rawtext: [{ translate: "message.party.member_joined", with: [senderName] }] });
                leaderPlayer.playSound("random.orb");
            }
        }
        else if (type === "leave") {
            if (!currentParty) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.not_in_party" }] });
                return;
            }

            if (currentParty === senderName) {
                if (parties[senderName].length > 1) {
                    const newLeader = parties[senderName][1];
                    parties[newLeader] = parties[senderName].filter(m => m !== senderName);
                    delete parties[senderName];
                    H.setData("parties", parties);

                    sender.sendMessage({ rawtext: [{ translate: "message.party.left_new_leader", with: [newLeader] }] });
                    sender.playSound("random.pop");

                    parties[newLeader].forEach(memberName => {
                        const memberPlayer = world.getAllPlayers().find(p => p.name === memberName);
                        if (memberPlayer) {
                            memberPlayer.sendMessage({ rawtext: [{ translate: "message.party.member_left_new_leader", with: [senderName, newLeader] }] });
                        }
                    });
                } else {
                    delete parties[senderName];
                    H.setData("parties", parties);
                    sender.sendMessage({ rawtext: [{ translate: "message.party.disbanded" }] });
                    sender.playSound("random.pop");
                }
            } else {
                parties[currentParty] = parties[currentParty].filter(m => m !== senderName);
                H.setData("parties", parties);
                sender.sendMessage({ rawtext: [{ translate: "message.party.left" }] });
                sender.playSound("random.pop");

                const leaderPlayer = world.getAllPlayers().find(p => p.name === currentParty);
                if (leaderPlayer) {
                    leaderPlayer.sendMessage({ rawtext: [{ translate: "message.party.member_left", with: [senderName] }] });
                }
            }
        }
        else if (type === "msg") {
            if (!currentParty) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.not_in_party" }] });
                return;
            }
            if (!targetName) {
                sender.sendMessage({ rawtext: [{ translate: "command.party.specify_message" }] });
                return;
            }
            const partyMembers = parties[currentParty];

            partyMembers.forEach(memberName => {
                const memberPlayer = world.getAllPlayers().find(p => p.name === memberName);
                if (memberPlayer) {
                    memberPlayer.sendMessage({ rawtext: [{ translate: "message.party.chat_member", with: [senderName, targetName] }] });
                }
            });

            world.getAllPlayers().forEach(player => {
                if (H.isOp(player)) {
                    player.sendMessage({ rawtext: [{ translate: "message.party.chat_staff", with: [senderName, targetName] }] });
                }
            });
        }
    });
});

export default commandInformation;
