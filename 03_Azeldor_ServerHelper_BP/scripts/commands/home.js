import { world, system, CustomCommandParamType } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const commandInformation = {
    name: "home",
    description: "Teleport to your homes",
    usage: [{ name: "name", type: CustomCommandParamType.String, optional: true }]
};

registerCommand(commandInformation, (origin, name) => {
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

    const homes = H.getData(`homes_${sender.id}`) || {};
    const homeNames = Object.keys(homes);
    const maxHomes = world.getDynamicProperty("maxhomes") ?? 1;

    if (name) {
        const home = homes[name];
        if (!home) {
            sender.sendMessage({ rawtext: [{ translate: "command.home.not_found", with: [name] }] });
            return;
        }
        H.startTeleportWithDelay(sender, home, world.getDimension(home.dimension || "overworld"), name);
    } else {
        new ActionFormData()
            .title({ rawtext: [{ text: H.customUi() }, { translate: "form.home.title" }] })
            .body({ rawtext: [{ translate: "form.home.body", with: [homeNames.length.toString(), maxHomes.toString()] }] })
            .button({ rawtext: [{ translate: "form.home.button.tp" }] })
            .button({ rawtext: [{ translate: "form.home.button.set" }] })
            .button({ rawtext: [{ translate: "form.home.button.remove" }] })
            .show(sender).then(r => {
                if (r.canceled) return;
                if (r.selection === 0) tphomeMenu(sender, homes);
                else if (r.selection === 1) sethomeMenu(sender, homeNames.length, maxHomes);
                else if (r.selection === 2) removeHomeMenu(sender, homes);
            });
    }
});

function tphomeMenu(player, homes) {
    const homeNames = Object.keys(homes);
    if (homeNames.length === 0) {
        return player.sendMessage({ rawtext: [{ translate: "message.home.no_homes" }] });
    }

    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "form.tphome.title" }] });
    homeNames.forEach(n => menu.button(n));

    menu.show(player).then(r => {
        if (r.canceled) return;
        const h = homes[homeNames[r.selection]];
        H.startTeleportWithDelay(player, h, world.getDimension(h.dimension), homeNames[r.selection]);
    });
}

function sethomeMenu(player, currentCount, maxHomes) {
    if (currentCount >= maxHomes) {
        H.playDenied(player);
        return player.sendMessage({ rawtext: [{ translate: "message.home.limit" }] });
    }

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "form.sethome.title" }] })
        .textField({ rawtext: [{ translate: "form.sethome.textfield" }] }, "Base")
        .show(player).then(r => {
            if (r.canceled || !r.formValues[0]) return;
            const homes = H.getData(`homes_${player.id}`, {});
            homes[r.formValues[0]] = { ...player.location, dimension: player.dimension.id };
            H.setData(`homes_${player.id}`, homes);
            player.sendMessage({ rawtext: [{ translate: "message.home.set_success" }] });
            H.playSuccess(player);
        });
}

function removeHomeMenu(player, homes) {
    const homeNames = Object.keys(homes);
    const menu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: "form.removehome.title" }] });
    homeNames.forEach(n => menu.button({ rawtext: [{ translate: "form.removehome.button", with: [n] }] }));

    menu.show(player).then(r => {
        if (r.canceled) return;
        const playerHomes = H.getData(`homes_${player.id}`, {});
        delete playerHomes[homeNames[r.selection]];
        H.setData(`homes_${player.id}`, playerHomes);
        player.sendMessage({ rawtext: [{ translate: "message.home.remove_success" }] });
        H.playCancel(player);
    });
}

export default commandInformation;
