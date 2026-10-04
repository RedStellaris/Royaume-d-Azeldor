import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";
import { CustomizationMenu } from "./customizationUi"
import { helperMenu } from "../misc/helperMenu"

export async function bountyMenu(player) {
    const bounties = H.getData("bounties", {});
    const locationToggle = world.getDynamicProperty("bountyLocationToggle") ?? false;
    const scoreboards = H.getData("bounty_scoreboards", []);

    const bountyList = Object.entries(bounties)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.amount - a.amount);

    const toggleStatus = locationToggle ? 'bounty.status.enabled' : 'bounty.status.disabled';
    
    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.bounty.admin.title' }] })
        .body({ rawtext: [{ translate: 'ui.bounty.admin.body', with: [String(bountyList.length)] }, { translate: toggleStatus }] });

    const toggleLabel = locationToggle ? 'bounty.status.enabled_label' : 'bounty.status.disabled_label';
    menu.button({ rawtext: [{ translate: 'ui.bounty.button.location' }, { translate: toggleLabel }] }, "textures/menutextures/switch");
    
    menu.button({ rawtext: [{ translate: 'ui.bounty.button.scoreboards' }] }, "textures/ui/gear");

    bountyList.forEach((b) => {
        menu.button({ rawtext: [{ translate: 'ui.bounty.button.bounty', with: [b.target, String(b.amount), b.scoreboard] }] });
    });

    menu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back");

    const r = await menu.show(player);

    if (r.canceled || r.selection === bountyList.length + 2) return H.isOp(player) ? CustomizationMenu(player) : helperMenu(player);

    if (r.selection === 0) {
        const newState = !locationToggle;
        world.setDynamicProperty("bountyLocationToggle", newState);
        const stateKey = newState ? 'bounty.state.on' : 'bounty.state.off';
        player.sendMessage({ rawtext: [{ translate: 'message.bounty.location_tracking' }, { translate: stateKey }] });
        
        system.run(() => bountyMenu(player));
        return;
    }

    if (r.selection === 1) {
        system.run(() => openBountyScoreboardSettings(player, scoreboards));
        return;
    }

    const selected = bountyList[r.selection - 2];
    if (selected) {
        system.run(() => confirmRemoval(player, selected));
    }
}

async function openBountyScoreboardSettings(player, scoreboards) {
    const r = await new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.bounty.sb.title' }] })
        .button({ rawtext: [{ translate: 'ui.bounty.sb.add' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'ui.bounty.sb.remove' }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back")
        .show(player);

    if (r.canceled || r.selection === 2) {
        system.run(() => bountyMenu(player));
        return;
    }

    if (r.selection === 0) {
        const sbs = H.getScoreboardList();
        system.run(async () => {
            const res = await new ModalFormData()
                .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.bounty.currency.add.title' }] })
                .dropdown({ rawtext: [{ translate: 'ui.bounty.currency.add.dropdown' }] }, sbs)
                .show(player);

            if (res.canceled) {
                system.run(() => openBountyScoreboardSettings(player, scoreboards));
                return;
            }

            const obj = sbs[res.formValues[0]];
            if (!world.scoreboard.getObjective(obj)) {
                player.sendMessage({ rawtext: [{ translate: 'message.error.objective_not_exist' }] });
                return;
            }

            if (!scoreboards.includes(obj)) {
                scoreboards.push(obj);
                H.setData("bounty_scoreboards", scoreboards);
            }
            system.run(() => openBountyScoreboardSettings(player, scoreboards));
        });
    } else {
        const sub = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.bounty.currency.remove.title' }] });
        if (scoreboards.length === 0) {
            sub.body({ rawtext: [{ translate: 'ui.bounty.currency.remove.body_empty' }] });
            sub.button({ rawtext: [{ translate: 'ui.button.back' }] });
        } else {
            scoreboards.forEach(s => sub.button({ rawtext: [{ text: s }] }));
        }

        system.run(async () => {
            const res = await sub.show(player);
            if (res.canceled || scoreboards.length === 0) {
                system.run(() => openBountyScoreboardSettings(player, scoreboards));
                return;
            }
            scoreboards.splice(res.selection, 1);
            H.setData("bounty_scoreboards", scoreboards);
            system.run(() => openBountyScoreboardSettings(player, scoreboards));
        });
    }
}

async function confirmRemoval(player, bounty) {
    const r = await new MessageFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.bounty.remove.title' }] })
        .body({ rawtext: [{ translate: 'ui.bounty.remove.body', with: [bounty.target] }] })
        .button1({ rawtext: [{ translate: 'ui.button.confirm' }] })
        .button2({ rawtext: [{ translate: 'ui.button.cancel' }] })
        .show(player);

    if (r.selection === 0) {
        const allBounties = H.getData("bounties", {});
        delete allBounties[bounty.id];
        H.setData("bounties", allBounties);

        player.sendMessage({ rawtext: [{ translate: 'message.admin.bounty_removed' }] });
    }
    
    system.run(() => bountyMenu(player));
}

system.runInterval(() => {
    const locationEnabled = world.getDynamicProperty("bountyLocationToggle") ?? false;
    if (!locationEnabled) return;

    const bounties = H.getData("bounties", {});
    const players = world.getAllPlayers();
    let updated = false;

    const targetBounties = {};
    for (const id in bounties) {
        const targetName = bounties[id].target;
        if (!targetBounties[targetName]) targetBounties[targetName] = [];
        targetBounties[targetName].push(id);
    }

    for (const player of players) {
        if (targetBounties[player.name]) {
            const loc = player.location;
            const locString = `${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}`;
            const now = Date.now();
            
            for (const id of targetBounties[player.name]) {
                bounties[id].lastLocation = locString;
                bounties[id].lastUpdate = now;
                updated = true;
            }
        }
    }

    if (updated) H.setData("bounties", bounties);
}, 6000);

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity: victim, damageSource } = event;
    const killer = damageSource.damagingEntity;

    if (victim?.typeId !== "minecraft:player" || !killer || !killer.isValid || killer.typeId !== "minecraft:player") return;
    if (victim === killer) return;

    const bounties = H.getData("bounties", {});
    let updated = false;

    for (const id in bounties) {
        const bounty = bounties[id];

        if (bounty.target === victim.name) {
            const success = H.addBalance(killer, bounty.scoreboard, bounty.amount);

            if (success) {
                world.sendMessage({ 
                    rawtext: [{ 
                        translate: 'message.bounty.claimed', 
                        with: [killer.name, String(bounty.amount), bounty.scoreboard, victim.name] 
                    }] 
                });

                killer.playSound("random.levelup", { volume: 1.0, pitch: 0.8 });
                H.spawnRewardParticle(killer.dimension, killer.location);

                delete bounties[id];
                updated = true;
            }
        }
    }
    
    if (updated) H.setData("bounties", bounties);
});