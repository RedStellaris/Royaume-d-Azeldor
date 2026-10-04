import { system, world, Player, ItemStack, EnchantmentTypes, Potions } from "@minecraft/server";
import * as H from "../general/helpers"

function serializeItem(item) {
    if (!item?.typeId) return null;

    const data = {
        typeId: item.typeId,
        amount: item.amount,
        nameTag: item.nameTag
    };

    const enchantable = item.getComponent("minecraft:enchantable");
    if (enchantable) {
        const enchants = enchantable.getEnchantments();
        if (enchants.length > 0) {
            data.enchants = {};
            enchants.forEach(e => {
                data.enchants[e.type.id] = e.level;
            });
        }
    }

    const potionComp = item.getComponent("minecraft:potion");
    if (potionComp) {
        data.potion = potionComp.potionEffectType.id;
        data.delivery = potionComp.potionDeliveryType.id;
    }

    return data;
}

function deserializeItem(info) {
    if (!info?.typeId) return undefined;
    let stack;

    if (info.potion && info.delivery) {
        try {
            const effectType = Potions.getAllEffectTypes().find(e => e.id === info.potion);
            const deliveryType = Potions.getAllDeliveryTypes().find(d => d.id === info.delivery);
            if (effectType && deliveryType) {
                stack = Potions.resolve(effectType, deliveryType);
            }
        } catch (e) { }
    }

    if (!stack) {
        try {
            stack = new ItemStack(info.typeId, info.amount || 1);
        } catch (e) { return undefined; }
    }

    if (stack) {
        stack.amount = info.amount || 1;
        if (info.nameTag) stack.nameTag = info.nameTag;

        if (info.enchants) {
            const enchantable = stack.getComponent("minecraft:enchantable");
            if (enchantable) {
                for (const [id, level] of Object.entries(info.enchants)) {
                    const type = EnchantmentTypes.get(id);
                    if (type) enchantable.addEnchantment({ type, level });
                }
            }
        }
    }
    return stack;
}

function serializeInventory(player) {
    const inv = player.getComponent("minecraft:inventory").container;
    const equip = player.getComponent("minecraft:equippable");
    let items = { main: [], armor: {} };

    for (let i = 0; i < inv.size; i++) {
        items.main.push(serializeItem(inv.getItem(i)));
    }

    const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];
    for (const slot of slots) {
        items.armor[slot] = serializeItem(equip.getEquipment(slot));
    }
    return items;
}

world.afterEvents.entityHurt.subscribe((event) => {
    if (!world.getDynamicProperty("combatlog")) return;

    const { hurtEntity, damageSource } = event;
    const attacker = damageSource.damagingEntity;
    if (!attacker) return;

    const isMobCL = world.getDynamicProperty("mobCL");
    const isVictimPlayer = hurtEntity instanceof Player;
    const isAttackerPlayer = attacker instanceof Player;

    if (!isMobCL && (!isVictimPlayer || !isAttackerPlayer)) return;
    if (!isVictimPlayer && !isAttackerPlayer) return;

    let combatCache = H.getData("incombat", {});
    const duration = world.getDynamicProperty("combattime") ?? 15;

    if (isAttackerPlayer && !combatCache[attacker.id]) {
        attacker.sendMessage({ rawtext: [{ translate: "message.combat.in_combat" }] });
    }

    const flagCombat = (entity) => {
        if (!(entity instanceof Player)) return;
        combatCache[entity.id] = {
            id: entity.id,
            cd: duration,
            hitAt: Date.now()
        };
    };

    if (isVictimPlayer) flagCombat(hurtEntity);
    if (isAttackerPlayer) flagCombat(attacker);

    H.setData("incombat", combatCache);
});

system.runInterval(() => {
    let combatCache = H.getData("incombat", {});
    const playerIds = Object.keys(combatCache);
    if (playerIds.length === 0) return;

    let dataChanged = false;
    const allPlayers = world.getAllPlayers();

    for (const id of playerIds) {
        const info = combatCache[id];
        const secondsPassed = (Date.now() - info.hitAt) / 1000;
        const timeLeft = info.cd - secondsPassed;
        const player = allPlayers.find(p => p.id === id);

        if (timeLeft <= 0) {
            delete combatCache[id];
            dataChanged = true;
            if (player?.isValid) player.sendMessage({ rawtext: [{ translate: "message.combat.out_of_combat" }] });
        } else {
            if (player?.isValid) {
            }
        }
    }

    if (dataChanged) H.setData("incombat", combatCache);
}, 10);

system.runInterval(() => {
    const combatCache = H.getData("incombat", {});
    for (const player of world.getAllPlayers()) {
        if (!combatCache[player.id]) continue;
        const serialized = serializeInventory(player);
        player.setDynamicProperty("Combat_Inventory", JSON.stringify(serialized));
    }
}, 100);

world.beforeEvents.playerLeave.subscribe((event) => {
    const { player } = event;
    const combatCache = H.getData("incombat", {});

    if (combatCache[player.id]) {
        const rawInv = player.getDynamicProperty("Combat_Inventory");
        const loc = { x: player.location.x, y: player.location.y, z: player.location.z };
        const dim = player.dimension;

        player.setDynamicProperty("combat_logged", true);

        system.run(() => {
            if (rawInv) {
                const data = JSON.parse(rawInv);

                data.main?.forEach(itemData => {
                    const item = deserializeItem(itemData);
                    if (item) dim.spawnItem(item, loc);
                });

                Object.values(data.armor || {}).forEach(itemData => {
                    const item = deserializeItem(itemData);
                    if (item) dim.spawnItem(item, loc);
                });
            }
            
            const item = new ItemStack("minecraft:player_head", 1);
            item.setLore([player.name]);
            dim.spawnItem(item, loc);
        });

        delete combatCache[player.id];
        H.setData("incombat", combatCache);
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const { player, initialSpawn } = event;
    if (!initialSpawn) return;

    if (player.getDynamicProperty("combat_logged") === true) {
        system.runTimeout(() => {
            if (!player.isValid) return;

            const container = player.getComponent("minecraft:inventory").container;
            for (let i = 0; i < container.size; i++) {
                container.setItem(i, undefined);
            }

            const equipment = player.getComponent("minecraft:equippable");
            if (equipment) {
                const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"];
                slots.forEach(slot => equipment.setEquipment(slot, undefined));
            }

            player.kill();
            player.setDynamicProperty("combat_logged", false);
            player.setDynamicProperty("Combat_Inventory", undefined);
        }, 20);
    }
});

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity } = event;
    if (!(deadEntity instanceof Player)) return;

    let combatCache = H.getData("incombat", {});
    if (combatCache[deadEntity.id]) {
        delete combatCache[deadEntity.id];
        H.setData("incombat", combatCache);
        deadEntity.sendMessage({ rawtext: [{ translate: "message.combat.out_of_combat" }] });
    }
});

system.runInterval(() => {
    if (!world.getDynamicProperty("combatfly")) return;
    const combatCache = H.getData("incombat", {});
    let hasAny = false;
    for (const _ in combatCache) { hasAny = true; break; }
    if (!hasAny) return;

    for (const player of world.getAllPlayers()) {
        if (player.isValid && player.isGliding && combatCache[player.id]) {
            player.teleport(player.location, {
                dimension: player.dimension,
                keepVelocity: false
            });
        }
    }
}, 1);

system.runInterval(() => {
    if (!world.getDynamicProperty("combatfly")) return;
    const combatCache = H.getData("incombat", {});
    let hasAny = false;
    for (const _ in combatCache) { hasAny = true; break; }
    if (!hasAny) return;

    for (const player of world.getAllPlayers()) {
        if (player.isValid && player.isGliding && combatCache[player.id]) {
            player.sendMessage({ rawtext: [{ translate: "message.combat.no_fly" }] });
        }
    }
}, 20);