import { world, system } from "@minecraft/server"
import { ModalFormData } from "@minecraft/server-ui"
import * as H from "../general/helpers"
import * as PlayerUI from "../player/playerUi"

const MENU_OPTIONS = ["main", "shop", "bounties", "claim", "spawn", "home", "warps", "rtp", "tpa", "spawners", "crates", "ah", "bazaar"];

const PERMANENT_MARKETS = {
    ah: { typeId: "sh:auction_house_ent", title: "§l§6Auction House§r\n§eTap to browse" },
    bazaar: { typeId: "sh:bazaar_ent", title: "§l§eBazaar§r\n§eTap to browse" }
};

const NPC_SKIN_OPTIONS = [
    "Default 1", "Default 2", "Default 3", "Default 4", "Default 5", "Default 6", "Default 7", "Default 8", "Default 9", "Default 10",
    "Scientist 1", "Scientist 2", "Scientist 3", "Scientist 4", "Scientist 5", "Scientist 6", "Scientist 7", "Scientist 8", "Scientist 9", "Scientist 10",
    "Apiary 1", "Apiary 2", "Apiary 3", "Apiary 4", "Apiary 5",
    "Teacher 1", "Teacher 2", "Teacher 3", "Teacher 4", "Teacher 5",
    "Construction 1", "Construction 2", "Construction 3", "Construction 4", "Construction 5",
    "Agriculture 1", "Agriculture 2", "Agriculture 3", "Agriculture 4", "Agriculture 5", "Agriculture 6", "Agriculture 7", "Agriculture 8", "Agriculture 9", "Agriculture 10",
    "Business 1", "Business 2", "Business 3", "Business 4", "Business 5",
    "Everyday Business 1", "Everyday Business 2", "Everyday Business 3", "Everyday Business 4", "Everyday Business 5",
    "Kiosk 1", "Kiosk 2", "Kiosk 3", "Kiosk 4", "Kiosk 5"
];

export function ListMenuNPCs(player) {
    const npcs = H.getData("menuNpcs") || {};
    const keys = Object.keys(npcs);

    if (keys.length === 0) {
        return player.sendMessage({ rawtext: [{ translate: "message.npc.list.none" }] });
    }

    player.sendMessage({ rawtext: [{ translate: "message.npc.list.header" }] });
    for (const key of keys) {
        const npc = npcs[key];
        const skinName = NPC_SKIN_OPTIONS[npc.variant || 0];
        player.sendMessage({ 
            rawtext: [{ 
                translate: "message.npc.list.entry", 
                with: [key, npc.menu, String(npc.x), String(npc.y), String(npc.z), skinName] 
            }] 
        });
    }
}

export function AddMenuNPC(player) {
    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.npc.add.title" }] })
        .textField({ rawtext: [{ translate: "ui.npc.add.form.id" }] }, "shop_npc_1")
        .textField({ rawtext: [{ translate: "ui.npc.add.form.x" }] }, "")
        .textField({ rawtext: [{ translate: "ui.npc.add.form.y" }] }, "")
        .textField({ rawtext: [{ translate: "ui.npc.add.form.z" }] }, "")
        .dropdown({ rawtext: [{ translate: "ui.npc.add.form.menu" }] }, MENU_OPTIONS)
        .dropdown({ rawtext: [{ translate: "ui.npc.add.form.skin" }] }, NPC_SKIN_OPTIONS);

    form.show(player).then(r => {
        if (r.canceled) return;

        const npcId = r.formValues[0];
        const xStr = r.formValues[1];
        const yStr = r.formValues[2];
        const zStr = r.formValues[3];
        const menuSelection = MENU_OPTIONS[r.formValues[4]];
        const variantSelection = r.formValues[5];

        if (!npcId || npcId.trim() === "") {
            return player.sendMessage({ rawtext: [{ translate: "message.npc.add.missing_id" }] });
        }

        const npcs = H.getData("menuNpcs") || {};
        if (npcs[npcId]) {
            return player.sendMessage({ rawtext: [{ translate: "message.npc.add.already_exists", with: [npcId] }] });
        }

        const location = {
            x: xStr !== "" ? Math.floor(Number(xStr)) : Math.floor(player.location.x) + 0.5,
            y: yStr !== "" ? Math.floor(Number(yStr)) : Math.floor(player.location.y),
            z: zStr !== "" ? Math.floor(Number(zStr)) : Math.floor(player.location.z) + 0.5
        };

        const dimension = player.dimension;
        const market = PERMANENT_MARKETS[menuSelection];
        const entityType = market ? market.typeId : "sh:npc";
        const ent = dimension.spawnEntity(entityType, location);

        ent.addTag(`menu_npc_id:${npcId}`);

        if (market) {
            ent.nameTag = market.title;
            ent.setDynamicProperty("permanent", true);
        } else {
            ent.nameTag = `§e${menuSelection.toUpperCase()}`;
            ent.addTag("sh:menu_npc");
            ent.triggerEvent(`set_variant_${variantSelection}`);
        }

        npcs[npcId] = {
            menu: menuSelection,
            x: location.x,
            y: location.y,
            z: location.z,
            dimension: dimension.id,
            variant: variantSelection
        };
        H.setData("menuNpcs", npcs);

        player.sendMessage({ 
            rawtext: [{ 
                translate: "message.npc.add.success", 
                with: [npcId, String(location.x), String(location.y), String(location.z)] 
            }] 
        });
    }).catch(e => console.error(e));
}

export function RemoveMenuNPC(player) {
    const npcs = H.getData("menuNpcs") || {};
    const keys = Object.keys(npcs);

    if (keys.length === 0) {
        return player.sendMessage({ rawtext: [{ translate: "message.npc.remove.none" }] });
    }

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.npc.remove.title" }] })
        .dropdown({ rawtext: [{ translate: "ui.npc.remove.select" }] }, keys);

    form.show(player).then(r => {
        if (r.canceled) return;

        const npcId = keys[r.formValues[0]];
        const npcData = npcs[npcId];

        const dimension = world.getDimension(npcData.dimension);
        const entities = dimension.getEntities({ tags: [`menu_npc_id:${npcId}`] });

        for (const ent of entities) {
            if (ent.isValid) {
                ent.remove();
            }
        }

        delete npcs[npcId];
        H.setData("menuNpcs", npcs);

        player.sendMessage({ rawtext: [{ translate: "message.npc.remove.success", with: [npcId] }] });
    }).catch(e => console.error(e));
}

system.runInterval(() => {
    const npcs = H.getData("menuNpcs") || {};

    for (const [npcId, data] of Object.entries(npcs)) {
        const dimension = world.getDimension(data.dimension);
        const entities = dimension.getEntities({ tags: [`menu_npc_id:${npcId}`] });

        if (entities.length === 0) {
            const market = PERMANENT_MARKETS[data.menu];
            const entityType = market ? market.typeId : "sh:npc";
            const ent = dimension.spawnEntity(entityType, { x: data.x, y: data.y, z: data.z });

            ent.addTag(`menu_npc_id:${npcId}`);

            if (market) {
                ent.nameTag = market.title;
                ent.setDynamicProperty("permanent", true);
            } else {
                ent.nameTag = `§e${data.menu.toUpperCase()}`;
                ent.addTag("sh:menu_npc");
                if (data.variant !== undefined) {
                    ent.triggerEvent(`set_variant_${data.variant}`);
                }
            }
        }
    }
}, 100);

function handleNpcMenuActivation(player, target) {
    const npcs = H.getData("menuNpcs") || {};
    
    const npcId = target.getTags().find(tag => tag.startsWith("menu_npc_id:"))?.split(":")[1];
    if (!npcId || !npcs[npcId]) return;

    const menuId = npcs[npcId].menu.toLowerCase();

    system.run(() => {
        if (!player.isValid) return;
        if (PlayerUI.MenuActions[menuId]) {
            PlayerUI.MenuActions[menuId](player);
        } else {
            player.sendMessage({ rawtext: [{ translate: "message.npc.menu.missing" }] });
        }
    });
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;

    if (target.isValid && target.hasTag("sh:menu_npc")) {
        event.cancel = true;
        handleNpcMenuActivation(player, target);
    }
});

world.beforeEvents.entityHurt.subscribe((event) => {
    const { damageSource, hurtEntity } = event;
    const attacker = damageSource.damagingEntity;

    if (hurtEntity.isValid && hurtEntity.hasTag("sh:menu_npc")) {
        event.cancel = true;

        if (attacker && attacker.typeId === "minecraft:player" && attacker.isValid) {
            handleNpcMenuActivation(attacker, hurtEntity);
        }
    }
});