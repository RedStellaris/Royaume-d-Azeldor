import { ActionFormData } from "@minecraft/server-ui"
import { world, system } from "@minecraft/server"
import * as H from "../general/helpers"
import { SpyMenu } from "./moderationUi"

const spyIntervals = {};

export function stopSpy(admin) {
    const playerId = admin.id;

    if (spyIntervals[playerId] === undefined) return false;

    system.clearRun(spyIntervals[playerId]);
    delete spyIntervals[playerId];
    return true;
}

export function SpyData(admin) {
    const players = world.getAllPlayers();
    
    let msgRawtext = [
        { translate: 'ui.spy.active_players', with: [String(players.length)] }
    ];

    for (const player of players) {
        const health = player.getComponent("minecraft:health");
        const hp = Math.ceil(health?.currentValue ?? 0);
        const maxHp = health?.effectiveMax ?? 20;

        const xp = player.getTotalXp?.() ?? 0; 
        const { x, y, z } = player.location;
        const gm = player.getGameMode().toUpperCase();
        const effects = player.getEffects();

        msgRawtext.push({ text: `§b${player.name} §r§7[§f${gm}§7]\n§4❤ §f${hp}/${maxHp}  §2Xp: §f${xp}\n§6Pos: §f${Math.round(x)}, ${Math.round(y)}, ${Math.round(z)}\n` });
        msgRawtext.push({ translate: 'ui.spy.effects' });

        if (effects.length > 0) {
            const effectList = effects.map(e => `§7- ${e.typeId.replace("minecraft:", "")}`).join("\n");
            msgRawtext.push({ text: `\n${effectList}\n` });
        } else {
            msgRawtext.push({ text: ": " }, { translate: 'ui.spy.none' }, { text: "\n" });
        }
        
        msgRawtext.push({ text: `§8--------------------------\n` });
    }

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.spy.title' }] })
        .body({ rawtext: msgRawtext })
        .button({ rawtext: [{ translate: 'ui.spy.button.refresh' }] }, "textures/ui/refresh")
        .button({ rawtext: [{ translate: 'ui.spy.button.back' }] })
        .show(admin).then(r => {
            if (r.canceled) return;
            if (r.selection === 0) SpyData(admin); 
            else SpyMenu(admin);
        });
}

export function spy(admin, targetName) {
    const playerId = admin.id;
    
    if (spyIntervals[playerId]) {
        system.clearRun(spyIntervals[playerId]);
    }

    const intervalId = system.runInterval(() => {
        const currentAdmin = world.getAllPlayers().find(p => p.id === playerId);
        const target = world.getAllPlayers().find(p => p.name === targetName);
        
        if (!currentAdmin || !target || !target.isValid) {
            system.clearRun(intervalId);
            delete spyIntervals[playerId];
            
            if (currentAdmin) currentAdmin.camera.clear();
            return;
        }

        const head = target.getHeadLocation();
        const view = target.getViewDirection();
        
        const camX = head.x - view.x * 3;
        const camY = head.y + 1.5;
        const camZ = head.z - view.z * 3;

        currentAdmin.camera.setCamera("minecraft:free", {
            location: { x: camX, y: camY, z: camZ },
            facingLocation: { x: head.x, y: head.y, z: head.z }
        });
    }, 1);
    
    spyIntervals[playerId] = intervalId;
}