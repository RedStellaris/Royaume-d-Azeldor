import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";
import { sendTradeRequest, acceptTradeRequest, declineTradeRequest, getIncomingTradeRequests } from "../misc/tradeSystem";

export function TradeMainMenu(player) {
    if (world.getDynamicProperty("playerTrading") !== true) {
        player.sendMessage({ rawtext: [{ translate: "command.trade.disabled" }] });
        return;
    }

    const incoming = getIncomingTradeRequests(player);

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "trade.menu.main.title" }] })
        .button({ rawtext: [{ translate: "trade.menu.main.button.send" }] }, "textures/menutextures/tpa");

    if (incoming.length > 0) {
        menu.button({ rawtext: [{ translate: "trade.menu.main.button.accept", with: [String(incoming.length)] }] }, "textures/ui/realms_green_check");
    }
    menu.button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (!player.isValid) return;
        const backIndex = incoming.length > 0 ? 2 : 1;
        if (r.canceled || r.selection === backIndex) return;

        if (r.selection === 0) return tradeSendMenu(player);
        return tradeIncomingMenu(player, incoming);
    });
}

function tradeSendMenu(player) {
    const targets = world.getAllPlayers().filter(p => p.name !== player.name);

    if (targets.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "trade.message.no_players" }] });
        return TradeMainMenu(player);
    }

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "trade.menu.send.title" }] });
    targets.forEach(p => menu.button({ rawtext: [{ text: p.name }] }));
    menu.button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (!player.isValid) return;
        if (r.canceled || r.selection === targets.length) return TradeMainMenu(player);

        const target = targets[r.selection];
        sendTradeRequest(player, target);
    });
}

function tradeIncomingMenu(player, incoming) {
    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "trade.menu.accept.title" }] });

    incoming.forEach(r => menu.button({ rawtext: [{ translate: "trade.menu.accept.button.player", with: [r.requesterName] }] }, "textures/menutextures/tpa_2"));
    menu.button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back");

    menu.show(player).then(r => {
        if (!player.isValid) return;
        if (r.canceled || r.selection === incoming.length) return TradeMainMenu(player);

        const request = incoming[r.selection];
        tradeRequestActionMenu(player, request);
    });
}

function tradeRequestActionMenu(player, request) {
    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "trade.menu.action.title", with: [request.requesterName] }] })
        .button({ rawtext: [{ translate: "trade.menu.action.accept" }] }, "textures/ui/realms_green_check")
        .button({ rawtext: [{ translate: "trade.menu.action.decline" }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (!player.isValid) return;
            if (r.canceled || r.selection === 2) return TradeMainMenu(player);
            if (r.selection === 0) return acceptTradeRequest(player, request.requesterName);
            return declineTradeRequest(player, request.requesterName);
        });
}
