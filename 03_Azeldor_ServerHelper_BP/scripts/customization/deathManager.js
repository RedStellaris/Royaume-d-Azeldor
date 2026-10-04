import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";
import { DeathManager } from "./customizationUi"

export async function deathSubMenu(player, dataKey, labelKey) {
    const r = await new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: labelKey }] })
        .button({ rawtext: [{ translate: 'ui.death.sub.button.add' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'ui.death.sub.button.remove' }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back")
        .show(player);

    if (r.canceled || r.selection === 2) {
        system.run(() => DeathManager(player));
        return;
    }

    const data = H.getData(dataKey, {});
    const keys = Object.keys(data);

    if (r.selection === 0) {
        system.run(() => {
            if (dataKey.includes("particle") || dataKey.includes("sound")) {
                addDeathEffectUI(player, dataKey, labelKey);
            } else {
                addDeathCommandUI(player, dataKey, labelKey);
            }
        });
    } else if (r.selection === 1) {
        if (keys.length === 0) {
            player.sendMessage({ rawtext: [{ translate: 'message.death.nothing_to_remove' }] });
            system.run(() => deathSubMenu(player, dataKey, labelKey));
            return;
        }

        const remMenu = new ActionFormData().title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.death.remove.title' }, { translate: labelKey }] });

        keys.forEach(k => {
            const entry = data[k];
            const displayText = entry.particle || entry.sound || entry.command || k;
            remMenu.button({ rawtext: [{ text: `§4[X] §8${displayText}` }] });
        });

        remMenu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/back");

        system.run(async () => {
            const res = await remMenu.show(player);
            if (res.canceled || res.selection === keys.length) {
                system.run(() => deathSubMenu(player, dataKey, labelKey));
                return;
            }

            const targetKey = keys[res.selection];
            delete data[targetKey];
            H.setData(dataKey, data);

            player.sendMessage({ rawtext: [{ translate: 'message.death.removed_success' }] });
            system.run(() => deathSubMenu(player, dataKey, labelKey));
        });
    }
}

export async function addDeathEffectUI(player, dataKey, labelKey) {
    const isParticle = dataKey.includes("particle");
    const titleKey = isParticle ? 'ui.death.add.title.particle' : 'ui.death.add.title.sound';
    const idLabelKey = isParticle ? 'ui.death.add.id_label.particle' : 'ui.death.add.id_label.sound';
    const defaultPlaceholder = isParticle ? "sh:death_particle" : "mob.ghast.death";

    const r = await new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: titleKey }] })
        .textField({ rawtext: [{ translate: idLabelKey }] }, { rawtext: [{ text: defaultPlaceholder }] })
        .toggle({ rawtext: [{ translate: 'ui.death.add.victim_player' }] }, { defaultValue: false })
        .show(player);

    if (r.canceled) {
        system.run(() => deathSubMenu(player, dataKey, labelKey));
        return;
    }

    const val = r.formValues[0];
    if (!val) {
        system.run(() => deathSubMenu(player, dataKey, labelKey));
        return;
    }

    let data = H.getData(dataKey, {});
    data[val] = isParticle ? { particle: val, playerOnly: r.formValues[1] } : { sound: val, playerOnly: r.formValues[1] };
    H.setData(dataKey, data);
    
    player.sendMessage({ rawtext: [{ translate: 'message.death.added_success' }] });
    system.run(() => deathSubMenu(player, dataKey, labelKey));
}

export async function addDeathCommandUI(player, dataKey, labelKey) {
    const r = await new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.death.add_cmd.title' }] })
        .textField({ rawtext: [{ translate: 'ui.death.add_cmd.label' }] }, { rawtext: [{ text: "say I died!" }] })
        .toggle({ rawtext: [{ translate: 'ui.death.add_cmd.killer_player' }] }, { defaultValue: false })
        .toggle({ rawtext: [{ translate: 'ui.death.add.victim_player' }] }, { defaultValue: false })
        .show(player);

    if (r.canceled || !r.formValues[0]) {
        system.run(() => deathSubMenu(player, dataKey, labelKey));
        return;
    }

    const data = H.getData(dataKey, {});
    const id = Date.now().toString();
    data[id] = { command: r.formValues[0], attackerPlayer: r.formValues[1], deadPlayer: r.formValues[2] };
    H.setData(dataKey, data);
    
    player.sendMessage({ rawtext: [{ translate: 'message.death.command_added' }] });
    system.run(() => deathSubMenu(player, dataKey, labelKey));
}

const getNormalizedList = (key) => {
    const rawData = H.getData(key, {});
    if (Array.isArray(rawData)) return rawData;
    return Object.values(rawData).filter(Boolean);
};

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    
    if (!deadEntity || !deadEntity.isValid || deadEntity.typeId.includes("sh:")) return;

    const isPlayer = deadEntity.typeId === "minecraft:player";
    const attacker = damageSource?.damagingEntity;
    const isAttackerPlayer = attacker?.typeId === "minecraft:player";
    
    const loc = {
        x: deadEntity.location.x,
        y: deadEntity.location.y + 0.3,
        z: deadEntity.location.z
    };
    const dim = deadEntity.dimension;

    const particles = getNormalizedList("death_particle");
    particles.forEach(conf => {
        if (!conf.particle || (conf.playerOnly && !isPlayer)) return;
        system.runTimeout(() => {
            dim.spawnParticle(conf.particle, loc);
        }, 20);
    });

    const sounds = getNormalizedList("death_sound");
    sounds.forEach(conf => {
        if (!conf.sound || (conf.playerOnly && !isPlayer)) return;
        dim.playSound(conf.sound, loc);
    });

    const attackerConfigs = getNormalizedList("attacker_command");
    if (attacker && attacker.isValid) {
        attackerConfigs.forEach(conf => {
            if (!conf.command) return;
            const attackerCondition = !conf.attackerPlayer || (conf.attackerPlayer && isAttackerPlayer);
            const victimCondition = !conf.deadPlayer || (conf.deadPlayer && isPlayer);

            if (attackerCondition && victimCondition) {
                system.run(() => {
                    if (attacker.isValid) attacker.runCommand(conf.command);
                });
            }
        });
    }

    if (isPlayer) {
        deadEntity.setDynamicProperty("died", true);
        deadEntity.setDynamicProperty("killerIsPlayer", isAttackerPlayer);
    } else {
        const victimConfigs = getNormalizedList("deadEntity_command");
        victimConfigs.forEach(conf => {
            if (!conf.command) return;
            const attackerCondition = !conf.attackerPlayer || (conf.attackerPlayer && isAttackerPlayer);
            
            if (attackerCondition) {
                system.run(() => {
                    try {
                        dim.runCommand(`execute positioned ${loc.x} ${loc.y} ${loc.z} run ${conf.command}`);
                    } catch (err) { }
                });
            }
        });
    }
});

world.afterEvents.entitySpawn.subscribe((event) => {
    const { entity } = event;
    if (!entity || !entity.isValid || entity.typeId !== "minecraft:player") return;

    if (entity.getDynamicProperty("died")) {
        const killerIsPlayer = entity.getDynamicProperty("killerIsPlayer") ?? false;
        entity.setDynamicProperty("died", false);
        entity.setDynamicProperty("killerIsPlayer", undefined);

        const respawnConfigs = getNormalizedList("deadEntity_command");
        respawnConfigs.forEach(conf => {
            if (!conf.command) return;
            const attackerCondition = !conf.attackerPlayer || (conf.attackerPlayer && killerIsPlayer);
            const victimCondition = conf.deadPlayer === true || conf.deadPlayer === undefined;

            if (attackerCondition && victimCondition) {
                system.run(() => {
                    if (entity.isValid) {
                        try {
                            entity.runCommand(conf.command);
                        } catch (err) { }
                    }
                });
            }
        });
    }
});