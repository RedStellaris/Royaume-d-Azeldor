import { world, system } from "@minecraft/server"
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { PlayerMainMenu } from "./playerUi"
import * as H from "../general/helpers"

system.runInterval(() => {
    const locationEnabled = world.getDynamicProperty("bountyLocationToggle") ?? false;
    if (!locationEnabled) return;

    const bounties = H.getData("bounties", {});
    let updated = false;

    for (const id in bounties) {
        const target = world.getAllPlayers().find(p => p.name === bounties[id].target);
        if (target) {
            const loc = target.location;
            bounties[id].lastLocation = `${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`;
            bounties[id].lastUpdate = Date.now();
            updated = true;
        }
    }

    if (updated) H.setData("bounties", bounties);
}, 6000);

export function PlayerBountyMenu(player) {
    const allowedBoards = H.getData("bounty_scoreboards", []);
    const bounties = H.getData("bounties", {});
    const bountyList = Object.entries(bounties).map(([id, data]) => ({ id, ...data }));

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.bounty.title" }] });

    if (allowedBoards.length === 0) {
        menu.body({ rawtext: [{ translate: "ui.bounty.no_currencies" }] });
        menu.button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back");
        return menu.show(player).then(() => PlayerMainMenu(player));
    }

    menu.button({ rawtext: [{ translate: "ui.bounty.button.add" }] }, "textures/ui/color_plus");
    menu.button({ rawtext: [{ translate: "ui.bounty.button.browse", with: [String(bountyList.length)] }] }, "textures/items/paper");
    menu.button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === 2) return PlayerMainMenu(player);
        if (r.selection === 0) CreateBountyUI(player, allowedBoards);
        else ListBountiesUI(player, bountyList);
    });
}

export function CreateBountyUI(player, allowedBoards) {
    let boardOptions = Array.isArray(allowedBoards) && allowedBoards.length > 0
        ? allowedBoards.map(b => b.toString())
        : [{ rawtext: [{ translate: "ui.bounty.create.no_boards" }] }];

    let targetOptions = world.getAllPlayers()
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    if (targetOptions.length === 0) {
        targetOptions = [player.name + " (Self)"];
    }

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.bounty.create.title" }] })
        .dropdown({ rawtext: [{ translate: "ui.bounty.create.target" }] }, targetOptions)
        .dropdown({ rawtext: [{ translate: "ui.bounty.create.currency" }] }, boardOptions)
        .textField({ rawtext: [{ translate: "ui.bounty.create.amount" }] }, "100");

    form.show(player).then(r => {
        if (r.canceled) return PlayerBountyMenu(player);

        if (allowedBoards.length === 0) {
            return player.sendMessage({ rawtext: [{ translate: "message.bounty.no_boards" }] });
        }

        const targetName = targetOptions[r.formValues[0]].replace(" (Self)", "");
        const board = boardOptions[r.formValues[1]];
        const amount = parseInt(r.formValues[2]);
        const minBounty = world.getDynamicProperty("minbounty");

        if (amount < minBounty) {
            H.playDenied(player);
            return player.sendMessage({ rawtext: [{ translate: "message.bounty.minimum", with: [String(minBounty)] }] });
        }

        if (isNaN(amount) || amount <= 0) {
            H.playDenied(player);
            return player.sendMessage({ rawtext: [{ translate: "message.bounty.invalid_amount" }] });
        }
        
        if (H.getBalance(player, board) < amount) {
            H.playDenied(player);
            return player.sendMessage({ rawtext: [{ translate: "message.bounty.not_enough", with: [board] }] });
        }

        H.removeBalance(player, board, amount);

        const bounties = H.getData("bounties", {});
        const bountyId = Date.now().toString();

        try {
            bounties[bountyId] = {
                id: bountyId,
                target: targetName,
                amount: amount,
                scoreboard: board,
                creator: player.name,
                timestamp: Date.now(),
                lastLocation: "Unknown",
                lastUpdate: 0
            };
        } catch (err) {
            world.sendMessage({ rawtext: [{ translate: "message.bounty.data_issue", with: [String(err)] }] });
            world.setDynamicProperty("bounties", "{}");
            return;
        }

        H.setData("bounties", bounties);

        world.sendMessage({
            rawtext: [{
                translate: "message.bounty.broadcast",
                with: [player.name, String(amount), board, targetName]
            }]
        });
        H.playSuccess(player);
    });
}

export function ListBountiesUI(player, bountyList) {
    const sortedBounties = [...bountyList].sort((a, b) => b.amount - a.amount);

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.bounty.list.title" }] });
        
    const locationEnabled = world.getDynamicProperty("bountyLocationToggle") ?? false;

    sortedBounties.forEach(b => {
        menu.button({ rawtext: [{ translate: "ui.bounty.list.button", with: [b.target, String(b.amount), b.scoreboard] }] });
    });

    menu.button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (r.canceled || r.selection === sortedBounties.length) return PlayerBountyMenu(player);

        const b = sortedBounties[r.selection];

        let bodyRawtext = [
            { translate: "ui.bounty.info.base", with: [b.target, String(b.amount), b.scoreboard, b.creator] }
        ];

        if (locationEnabled) {
            const minsAgo = b.lastUpdate === 0 ? "N/A" : Math.floor((Date.now() - b.lastUpdate) / 60000);
            bodyRawtext.push({ translate: "ui.bounty.info.location", with: [b.lastLocation, String(minsAgo)] });
        }

        new MessageFormData()
            .title({ rawtext: [{ text: H.customUi() }, { text: b.target }] })
            .body({ rawtext: bodyRawtext })
            .button1({ rawtext: [{ translate: "ui.button.close" }] })
            .button2({ rawtext: [{ translate: "ui.button.back" }] })
            .show(player).then(res => {
                if (res.selection === 1) ListBountiesUI(player, bountyList);
            });
    });
}