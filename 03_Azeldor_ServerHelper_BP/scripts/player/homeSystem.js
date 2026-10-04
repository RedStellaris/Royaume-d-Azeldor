import { world } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import * as H from "../general/helpers"
import { PlayerMainMenu } from "./playerUi"

export function getPlayerHomes(player) {
    let homes = H.getData(`homes_${player.id}`);
    if (homes) return homes;

    const allHomes = H.getData("homes", {});
    if (allHomes[player.id]) {
        homes = allHomes[player.id];
        setPlayerHomes(player, homes);
        return homes;
    }
    const legacy = player.getDynamicProperty("homes");
    if (legacy) {
        try {
            const recovered = JSON.parse(legacy);
            setPlayerHomes(player, recovered);
            return recovered;
        } catch {
        }
    }

    return {};
}

export function setPlayerHomes(player, homes) {
    H.setData(`homes_${player.id}`, homes);
}

export function HomeMainMenu(player) {
    const homes = getPlayerHomes(player);
    const homeNames = Object.keys(homes);
    const maxHomes = world.getDynamicProperty("maxhomes") ?? 1;
    const combatCache = H.getData("incombat", {});

    if (combatCache[player.id]) {
        return player.sendMessage({ rawtext: [{ translate: "message.home.combat" }] });
    }

    const existing = player.dimension.getEntities({ type: "sh:pv" });
    if (existing.some(ent => ent.getDynamicProperty("owner_id") === player.id)) {
        return player.sendMessage({ rawtext: [{ translate: "message.home.active_vault" }] });
    }

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "form.home.title" }] })
        .body({ rawtext: [{ translate: "form.home.body", with: [homeNames.length.toString(), maxHomes.toString()] }] })
        .button({ rawtext: [{ translate: "form.home.button.tp" }] })
        .button({ rawtext: [{ translate: "form.home.button.set" }] })
        .button({ rawtext: [{ translate: "form.home.button.remove" }] })
        .show(player).then(r => {
            if (!player.isValid) return;
            if (r.canceled) return PlayerMainMenu(player)
            if (r.selection === 0) TpHomeMenu(player, homes);
            else if (r.selection === 1) SetHomeMenu(player, homeNames.length, maxHomes);
            else if (r.selection === 2) RemoveHomeMenu(player, homes);
        });
}

export function TpHomeMenu(player, homes) {
    const homeNames = Object.keys(homes);

    if (homeNames.length === 0) {
        return player.sendMessage({ rawtext: [{ translate: "message.home.no_homes" }] });
    }

    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "form.tphome.title" }] });
    homeNames.forEach(n => menu.button(n));

    menu.show(player).then(r => {
        if (!player.isValid) return;
        if (r.canceled) return HomeMainMenu(player);
        const h = homes[homeNames[r.selection]];
        H.startTeleportWithDelay(player, h, world.getDimension(h.dimension), homeNames[r.selection]);
    });
}

export function SetHomeMenu(player, currentCount, maxHomes) {
    if (currentCount >= maxHomes) {
        H.playDenied(player);
        return player.sendMessage({ rawtext: [{ translate: "message.home.limit" }] });
    }

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "form.sethome.title" }] })
        .textField({ rawtext: [{ translate: "form.sethome.textfield" }] }, "Base")
        .show(player).then(r => {
            if (!player.isValid) return;
            if (r.canceled || !r.formValues[0]) return HomeMainMenu(player);
            const homes = getPlayerHomes(player);
            homes[r.formValues[0]] = { ...player.location, dimension: player.dimension.id };
            setPlayerHomes(player, homes);
            player.sendMessage({ rawtext: [{ translate: "message.home.set_success" }] });
            H.playSuccess(player);
            HomeMainMenu(player);
        });
}

export function RemoveHomeMenu(player, homes) {
    const homeNames = Object.keys(homes);
    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "form.removehome.title" }] });

    homeNames.forEach(n => menu.button({ rawtext: [{ translate: "form.removehome.button", with: [n] }] }));

    menu.show(player).then(r => {
        if (!player.isValid) return;
        if (r.canceled) return HomeMainMenu(player);
        delete homes[homeNames[r.selection]];
        setPlayerHomes(player, homes);
        player.sendMessage({ rawtext: [{ translate: "message.home.remove_success" }] });
        H.playCancel(player);
        HomeMainMenu(player);
    });
}