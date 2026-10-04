import { world, system, MolangVariableMap, ItemStack, EquipmentSlot, EnchantmentTypes, Potions } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as H from "../general/helpers";
import { CustomizationMenu } from "./customizationUi";

function getLocKey(location, dimensionId) {
    return `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)},${dimensionId}`;
}


let particleTick = 0;

const PARTICLE_VIEW_DIST_SQ = 48 * 48;

system.runInterval(() => {
    const registry = H.getData("crateLocations") || {};

    particleTick++;
    const t = particleTick / 5;

    const playerLocsByDim = new Map();
    for (const p of world.getAllPlayers()) {
        if (!p.isValid) continue;
        const dimId = p.dimension.id;
        let arr = playerLocsByDim.get(dimId);
        if (!arr) { arr = []; playerLocsByDim.set(dimId, arr); }
        arr.push(p.location);
    }
    if (playerLocsByDim.size === 0) return;

    for (const locKey in registry) {
        const crate = registry[locKey];
        if (!crate.particle) continue;

        const parts = locKey.split(",");
        if (parts.length < 4) continue;

        const bx = parseInt(parts[0]);
        const by = parseInt(parts[1]);
        const bz = parseInt(parts[2]);
        const dimId = parts[3];

        const dimPlayers = playerLocsByDim.get(dimId) ?? playerLocsByDim.get(`minecraft:${dimId}`);
        if (!dimPlayers) continue;

        let anyoneNear = false;
        for (const loc of dimPlayers) {
            const dx = loc.x - bx, dy = loc.y - by, dz = loc.z - bz;
            if (dx * dx + dy * dy + dz * dz <= PARTICLE_VIEW_DIST_SQ) { anyoneNear = true; break; }
        }
        if (!anyoneNear) continue;

        const x = bx + 0.5;
        const y = by;
        const z = bz + 0.5;

        try {
            const dim = world.getDimension(dimId);
            const style = crate.particleStyle || "Point";

            if (style === "Point") {
                if (particleTick % 2 === 0) {
                    dim.spawnParticle(crate.particle, { x, y: y + 1.2, z });
                }
            } else if (style === "Circle") {
                const block = dim.getBlock({ x: bx, y: by, z: bz });
                const dir = block ? block.permutation.getState("minecraft:cardinal_direction") : "north";

                if (dir === "north" || dir === "south") {
                    dim.spawnParticle(crate.particle, {
                        x: x + Math.cos(t * 1.5) * 1.0,
                        y: y + 0.5 + Math.sin(t * 1.5) * 1.0,
                        z: z
                    });
                    dim.spawnParticle(crate.particle, {
                        x: x + Math.cos(t * 1.5 + Math.PI) * 1.0,
                        y: y + 0.5 + Math.sin(t * 1.5 + Math.PI) * 1.0,
                        z: z
                    });
                } else {
                    dim.spawnParticle(crate.particle, {
                        x: x,
                        y: y + 0.5 + Math.sin(t * 1.5) * 1.0,
                        z: z + Math.cos(t * 1.5) * 1.0
                    });
                    dim.spawnParticle(crate.particle, {
                        x: x,
                        y: y + 0.5 + Math.sin(t * 1.5 + Math.PI) * 1.0,
                        z: z + Math.cos(t * 1.5 + Math.PI) * 1.0
                    });
                }
            } else if (style === "Sphere") {
                dim.spawnParticle(crate.particle, {
                    x: x + Math.cos(t * 1.5) * 1.0,
                    y: y + 0.5 + Math.sin(t * 1.5) * 1.0,
                    z: z
                });

                dim.spawnParticle(crate.particle, {
                    x: x,
                    y: y + 0.5 + Math.sin(t * 1.5) * 1.0,
                    z: z + Math.cos(t * 1.5) * 1.0
                });
            } else if (style === "Halo") {
                dim.spawnParticle(crate.particle, {
                    x: x + Math.cos(t * 1.5) * 1.0,
                    y: y + 2.3,
                    z: z + Math.sin(t * 1.5) * 1.0
                });

                dim.spawnParticle(crate.particle, {
                    x: x + Math.cos(t * 1.5 + Math.PI) * 1.0,
                    y: y + 2.3,
                    z: z + Math.sin(t * 1.5 + Math.PI) * 1.0
                });
            } else if (style === "Orbital") {
                dim.spawnParticle(crate.particle, {
                    x: x + Math.cos(t) * 0.8,
                    y: y + 0.8 + Math.sin(t * 1.5) * 0.5,
                    z: z + Math.sin(t) * 0.8
                });
            } else if (style === "Spin") {
                const height = (particleTick % 30) / 15;

                dim.spawnParticle(crate.particle, {
                    x: x + Math.cos(t * 2.5) * 1.2,
                    y: y + 0.2 + height,
                    z: z + Math.sin(t * 2.5) * 1.2
                });

                dim.spawnParticle(crate.particle, {
                    x: x + Math.cos(t * 2.5 + Math.PI) * 1.2,
                    y: y + 0.2 + height,
                    z: z + Math.sin(t * 2.5 + Math.PI) * 1.2
                });
            }
        } catch (e) {
        }
    }
}, 2);

function openAnimation(dimension, location, wonItem, player, crateName, directionStr) {
    const defaultTime = 5;
    const CrateTime = (world.getDynamicProperty("crateTime") ?? defaultTime) * 20;
    const DisplayTime = (world.getDynamicProperty("crateTime") ?? defaultTime) * 10;

    let ticks = 0;
    let cycleIndex = 0;

    const displayLoc = { x: location.x + 0.5, y: location.y + 1.2, z: location.z + 0.5 };
    const displayEnt = player.dimension.spawnEntity("sh:item_display", displayLoc);

    displayEnt.addTag(`crate_id:${crateName}`);
    displayEnt.addTag("sh:item_display");

    let targetRotation = 0;
    if (directionStr === "south") targetRotation = 180;
    else if (directionStr === "west") targetRotation = -90;
    else if (directionStr === "east") targetRotation = 90;

    displayEnt.setRotation({ x: 0, y: targetRotation });

    const crateItemsData = H.getData("crateItems") || {};
    let crateItems = crateItemsData[crateName] || [];

    if (crateItems.length === 0) {
        console.warn(`No items found for crate '${crateName}'. Using fallback items.`);
        crateItems = [{ id: "minecraft:gold_ingot" }, { id: "minecraft:emerald" }, { id: "minecraft:iron_ingot" }, { id: "minecraft:amethyst_shard" }];
    }

    const animInterval = system.runInterval(() => {
        ticks++;

        if (ticks < CrateTime) {
            if (ticks % 2 === 0) {
                const currentItem = crateItems[cycleIndex];
                const currentCycleItemId = currentItem.isSet ? "minecraft:chest" : (currentItem.potion ? "minecraft:potion" : (currentItem.id || currentItem.item || "minecraft:stone"));

                if (displayEnt.isValid) {
                    try {
                        displayEnt.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${currentCycleItemId}`);
                    } catch (e) { }
                }

                cycleIndex = (cycleIndex + 1) % crateItems.length;
            }

            try {
                if (ticks % 2 === 0) {
                    const pitchScale = 1.0 + (ticks / CrateTime);
                    player.playSound("random.click", { volume: 0.8, pitch: pitchScale });
                }
            } catch (e) { }
        } else if (ticks === CrateTime) {
            if (displayEnt.isValid) {
                const finalDisplayId = wonItem.isSet ? "minecraft:chest" : (wonItem.potion ? "minecraft:potion" : wonItem.id);
                try {
                    displayEnt.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${finalDisplayId}`);
                } catch (e) { }
            }

            player.sendMessage({ rawtext: [{ translate: 'crate.message.won', with: [wonItem.name] }] });

            if (wonItem.isSet) {
                const setData = H.getData("itemSets", {});
                const itemSet = setData[wonItem.id];
                if (itemSet) {
                    applyItemSet(player, itemSet);
                } else {
                    player.sendMessage("§cError: Saved Item Set data could not be found.");
                }
            } else {
                const container = player.getComponent("inventory").container;
                let remaining = wonItem.amount;

                const referenceStack = H.createItemStackFromData(wonItem, 1);
                const maxStack = referenceStack ? referenceStack.maxAmount : 64;

                while (remaining > 0) {
                    const currentAmount = Math.min(remaining, maxStack);
                    const itemStack = H.createItemStackFromData(wonItem, currentAmount);

                    if (itemStack) {
                        const leftover = container.addItem(itemStack);
                        if (leftover) player.dimension.spawnItem(leftover, player.location);
                    }
                    remaining -= currentAmount;
                }
            }

            player.playSound("random.levelup", { volume: 1.0, pitch: 1.0 });
            try {
                dimension.spawnParticle("minecraft:totem_particle", { x: location.x + 0.5, y: location.y + 1.5, z: location.z + 0.5 }, new MolangVariableMap());
            } catch (e) { }
        } else if (ticks >= CrateTime + DisplayTime) {
            system.clearRun(animInterval);
            if (displayEnt.isValid) {
                displayEnt.remove();
            }
        }
    }, 1);
}

export function physicalCrate(player) {
    const crates = H.getData("crates") || {};
    const keys = Object.keys(crates);

    if (keys.length === 0) {
        return player.sendMessage({ rawtext: [{ translate: 'crate.message.no_crates' }] });
    }

    const directions = ["North", "East", "South", "West"];
    const sbs = ["None", ...H.getScoreboardList()];
    const particleStyles = ["Point", "Circle", "Halo", "Orbital", "Spin", "Sphere"];

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.physical.title' }] })
        .dropdown({ rawtext: [{ translate: 'crate.ui.physical.select_crate' }] }, keys)
        .label({ rawtext: [{ translate: 'crate.ui.physical.choice_label' }] })
        .dropdown({ rawtext: [{ translate: 'crate.ui.physical.scoreboard_label' }] }, sbs)
        .textField({ rawtext: [{ translate: 'crate.ui.physical.item_label' }] }, { rawtext: [{ translate: 'crate.ui.physical.item_help' }] })
        .dropdown({ rawtext: [{ translate: 'crate.ui.physical.direction_label' }] }, directions)
        .textField({ rawtext: [{ translate: 'crate.ui.physical.x_label' }] }, { rawtext: [{ translate: 'crate.ui.physical.blank_help' }] })
        .textField({ rawtext: [{ translate: 'crate.ui.physical.y_label' }] }, { rawtext: [{ translate: 'crate.ui.physical.blank_help' }] })
        .textField({ rawtext: [{ translate: 'crate.ui.physical.z_label' }] }, { rawtext: [{ translate: 'crate.ui.physical.blank_help' }] })
        .textField({ rawtext: [{ translate: 'crate.ui.physical.particle_label' }] }, { rawtext: [{ text: 'minecraft:totem_particle' }] })
        .dropdown({ rawtext: [{ translate: 'crate.ui.physical.particle_style_label' }] }, particleStyles);

    form.show(player).then(r => {
        if (r.canceled) return cratesMenu(player);

        const index = r.formValues[0];
        const sbSelection = sbs[r.formValues[2]];
        const itemId = r.formValues[3];
        const dirIndex = r.formValues[4];
        const x = r.formValues[5];
        const y = r.formValues[6];
        const z = r.formValues[7];
        const particle = r.formValues[8];
        const pStyle = particleStyles[r.formValues[9]];

        const scoreboard = sbSelection === "None" ? "" : sbSelection;

        if (scoreboard && itemId) {
            return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.both_inputs' }] });
        }

        const directionStr = directions[dirIndex] ? directions[dirIndex].toLowerCase() : "north";

        const location = {
            x: x !== "" ? Math.floor(Number(x)) : Math.floor(player.location.x),
            y: y !== "" ? Math.floor(Number(y)) : Math.floor(player.location.y),
            z: z !== "" ? Math.floor(Number(z)) : Math.floor(player.location.z)
        };

        const dimension = player.dimension;
        const block = dimension.getBlock(location);
        if (!block) return;

        block.setType("minecraft:ender_chest");
        const perm = block.permutation.withState("minecraft:cardinal_direction", directionStr);
        block.setPermutation(perm);

        const crateName = keys[index];

        const holoLoc = { x: location.x + 0.5, y: location.y + 1.2, z: location.z + 0.5 };
        const ent = player.dimension.spawnEntity("sh:blank", holoLoc);
        ent.addTag("sh:hologram");

        const costText = scoreboard ? `${crates[crateName].cost} ${scoreboard}` : `1 ${itemId.replace("minecraft:", "")}`;
        const displayText = `${crateName}§r\n§lCost: §f${costText}`;

        ent.nameTag = displayText;

        const holoData = H.getData("holograms") || {};
        holoData[ent.id] = {
            type: "text",
            id: `crate_${crateName.replace(/\s+/g, "")}`,
            text: displayText,
            x: holoLoc.x,
            y: holoLoc.y - 0.5,
            z: holoLoc.z
        };
        H.setData("holograms", holoData);

        const registry = H.getData("crateLocations") || {};
        const locKey = getLocKey(location, dimension.id);

        registry[locKey] = {
            crateId: keys[index],
            scoreboard: itemId ? null : (scoreboard || null),
            item: itemId || null,
            particle: particle || null,
            particleStyle: pStyle
        };

        H.setData("crateLocations", registry);

        const mode = itemId ? "Item" : "Scoreboard";
        player.sendMessage({ rawtext: [{ translate: 'crate.message.registered', with: [mode, pStyle] }] });
    }).catch(e => console.error(e));
}

let spinTickCount = 0;

let cachedDisplayEntities = [];
const baseRotationCache = new Map();

function refreshDisplayEntities() {
    const dimensions = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
    const found = [];
    const liveIds = new Set();

    for (const dimId of dimensions) {
        let dim;
        try { dim = world.getDimension(dimId); } catch (e) { continue; }

        let displayEntities;
        try { displayEntities = dim.getEntities({ tags: ["sh:item_display"] }); } catch (e) { continue; }

        for (const ent of displayEntities) {
            if (!ent || !ent.isValid) continue;
            found.push(ent);
            liveIds.add(ent.id);

            try {
                const bx = Math.floor(ent.location.x);
                const by = Math.floor(ent.location.y - 1);
                const bz = Math.floor(ent.location.z);

                const block = dim.getBlock({ x: bx, y: by, z: bz });
                let targetRotation = 0;

                if (block && block.typeId === "minecraft:ender_chest") {
                    const dir = block.permutation.getState("minecraft:cardinal_direction");
                    if (dir === "south") targetRotation = 180;
                    else if (dir === "west") targetRotation = -90;
                    else if (dir === "east") targetRotation = 90;
                }
                baseRotationCache.set(ent.id, targetRotation);
            } catch (e) { }
        }
    }

    for (const id of baseRotationCache.keys()) {
        if (!liveIds.has(id)) baseRotationCache.delete(id);
    }
    cachedDisplayEntities = found;
}

system.runInterval(() => {
    spinTickCount++;

    if (spinTickCount % 20 === 1) refreshDisplayEntities();

    {
        for (const ent of cachedDisplayEntities) {
            if (!ent || !ent.isValid) continue;

            try {
                const targetRotation = baseRotationCache.get(ent.id) ?? 0;
                ent.setRotation({ x: 0, y: (targetRotation + spinTickCount * 3) % 360 });
            } catch (e) { }

            if (spinTickCount % 40 === 0) {
                const crateIdTag = ent.getTags().find(t => t.startsWith("crate_id:"));
                if (!crateIdTag) continue;

                const crateId = crateIdTag.replace("crate_id:", "");
                const crateItemsData = H.getData("crateItems") || {};
                const crateItems = crateItemsData[crateId] || [];

                if (crateItems.length === 0) continue;

                let cycleIndex = ent.getDynamicProperty("cycle_index") ?? 0;
                cycleIndex = (cycleIndex + 1) % crateItems.length;
                ent.setDynamicProperty("cycle_index", cycleIndex);

                const currentItem = crateItems[cycleIndex];
                const itemToDisplay = currentItem.isSet ? "minecraft:chest" : (currentItem.potion ? "minecraft:potion" : (currentItem.id || currentItem.item || "minecraft:stone"));
                const equippable = ent.getComponent("minecraft:equippable");

                if (equippable) {
                    try {
                        equippable.setEquipment("Mainhand", new ItemStack(itemToDisplay, 1));
                    } catch (e) { }
                }
            }
        }
    }
}, 1);

export function cratesMenu(player) {
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.menu.title' }] })
        .body({ rawtext: [{ translate: 'crate.ui.menu.body' }] })
        .button({ rawtext: [{ translate: 'crate.ui.menu.button.new' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'crate.ui.menu.button.physical' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'crate.ui.menu.button.edit' }] }, "textures/ui/gear")
        .button({ rawtext: [{ translate: 'crate.ui.menu.button.list' }] }, "textures/items/book_writable")
        .button({ rawtext: [{ translate: 'crate.ui.menu.button.remove' }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: 'ui.button.back_double' }] });

    form.show(player).then(r => {
        if (r.canceled || r.selection === 5) return CustomizationMenu(player);

        system.run(() => {
            switch (r.selection) {
                case 0: addCrate(player); break;
                case 1: physicalCrate(player); break;
                case 2: editCrates(player); break;
                case 3: listCrates(player); break;
                case 4: removeCrate(player); break;
            }
        });
    });
}

export function addCrate(player) {
    const crates = H.getData("crates") || {};
    const crateItems = H.getData("crateItems") || {};
    const sbs = H.getScoreboardList() || [];
    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.add.title' }] })
        .textField({ rawtext: [{ translate: 'crate.ui.add.name_label' }] }, { rawtext: [{ translate: 'crate.ui.add.name_placeholder' }] })
        .dropdown({ rawtext: [{ translate: 'crate.ui.add.scoreboard_label' }] }, sbs)
        .textField({ rawtext: [{ translate: 'crate.ui.add.cost_label' }] }, { rawtext: [{ translate: 'crate.ui.add.cost_placeholder' }] });

    form.show(player).then(r => {
        if (r.canceled) return cratesMenu(player);
        const [crateName, sbIndex, cost] = r.formValues;
        const scoreboard = sbs[sbIndex];

        if (!crateName || !scoreboard || !cost) {
            return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.missing_input' }] });
        }
        if (isNaN(cost)) {
            return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.cost_nan' }] });
        }

        system.run(() => {
            crates[crateName] = {
                scoreboard: scoreboard,
                cost: Number(cost),
                name: crateName
            };
            crateItems[crateName] = [];

            H.setData("crates", crates);
            H.setData("crateItems", crateItems);
            cratesMenu(player);
        });
    });
}

export function editCrates(player) {
    const crates = H.getData("crates") || {};
    const keys = Object.keys(crates);
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.edit.title' }] });

    if (keys.length === 0) {
        form.body({ rawtext: [{ translate: 'crate.ui.edit.none_found' }] });
    } else {
        for (const id of keys) {
            form.button({ rawtext: [{ text: `§b${crates[id].name}` }] }, "textures/ui/inventory_icon");
        }
    }
    form.button({ rawtext: [{ translate: 'ui.button.back_double' }] });

    form.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return cratesMenu(player);
        const selectedCrateName = keys[r.selection];

        manageCrate(player, selectedCrateName);
    });
}

function manageCrate(player, selectedCrateName) {
    const crates = H.getData("crates") || {};
    const crateItems = H.getData("crateItems") || {};

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.manage.title', with: [selectedCrateName] }] })
        .button({ rawtext: [{ translate: 'crate.ui.manage.button.add_items' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'crate.ui.loadItemSet' }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: 'crate.ui.manage.button.remove_items' }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: 'crate.ui.manage.button.edit_cost' }] }, "textures/items/gold_ingot")
        .button({ rawtext: [{ translate: 'crate.ui.manage.button.edit_scoreboard' }] }, "textures/items/diamond")
        .button({ rawtext: [{ translate: 'ui.button.back_double' }] })
        .show(player).then(res => {
            if (res.canceled || res.selection === 5) return editCrates(player);

            switch (res.selection) {
                case 0: {
                    const addItemForm = new ModalFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { text: selectedCrateName }] })
                        .textField({ rawtext: [{ translate: 'crate.ui.manage.add.item_id_label' }] }, { rawtext: [{ translate: 'crate.ui.manage.add.item_id_placeholder' }] })
                        .textField({ rawtext: [{ translate: 'crate.ui.manage.add.cover_name_label' }] }, { rawtext: [{ translate: 'crate.ui.manage.add.cover_name_placeholder' }] })
                        .textField({ rawtext: [{ translate: 'crate.ui.manage.add.quantity_label' }] }, { rawtext: [{ translate: 'crate.ui.manage.add.quantity_placeholder' }] })
                        .textField({ rawtext: [{ translate: 'crate.ui.manage.add.weight_label' }] }, { rawtext: [{ translate: 'crate.ui.manage.add.weight_placeholder' }] })
                        .textField("Potion Type (Optional)", "e.g. healing / minecraft:swiftness")
                        .textField("Potion Delivery (Optional)", "Consume / Splash / Lingering");

                    addItemForm.show(player).then(itemRes => {
                        if (itemRes.canceled) return manageCrate(player, selectedCrateName);

                        const [itemId, name, amount, chance, potion, delivery] = itemRes.formValues;
                        if ((!itemId && !potion) || !amount || !chance) {
                            return player.sendMessage("§cMissing standard fields or Potion details.");
                        }

                        const numAmount = Number(amount);
                        const numChance = Number(chance);

                        if (isNaN(numAmount) || isNaN(numChance)) {
                            return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.nan' }] });
                        }

                        if (numChance <= 0) {
                            return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.weight_zero' }] });
                        }

                        system.run(() => {
                            if (!crateItems[selectedCrateName]) crateItems[selectedCrateName] = [];
                            
                            const itemPayload = { 
                                name: name || (potion ? `${delivery || "Consume"} ${potion}` : itemId), 
                                id: itemId || "minecraft:potion", 
                                amount: numAmount, 
                                chance: numChance 
                            };
                            
                            if (potion) {
                                itemPayload.potion = potion;
                                itemPayload.delivery = delivery || "Consume";
                            }

                            crateItems[selectedCrateName].push(itemPayload);
                            H.setData("crateItems", crateItems);
                            player.sendMessage({ rawtext: [{ translate: 'crate.message.added_item', with: [itemId || potion, selectedCrateName] }] });
                            manageCrate(player, selectedCrateName);
                        });
                    });
                    break;
                }
                case 1: {
                    const rawItemSets = H.getData("itemSets", {});
                    const itemSetIds = Object.keys(rawItemSets);
                    
                    if (itemSetIds.length === 0) {
                        player.sendMessage("§cNo Item Sets found. Create one first.");
                        return manageCrate(player, selectedCrateName);
                    }

                    const form = new ModalFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { translate: "crate.ui.upload.title" }] })
                        .dropdown({ rawtext: [{ translate: "crate.ui.upload.select_set" }] }, itemSetIds)
                        .textField({ rawtext: [{ translate: "crate.ui.upload.weight_label" }] }, { rawtext: [{ translate: "crate.ui.upload.weight_placeholder" }] }, {defaultValue: "1"})
                        .show(player).then(itemRes => {
                            if (itemRes.canceled) return manageCrate(player, selectedCrateName);

                            const selectedSetId = itemSetIds[itemRes.formValues[0]];
                            const chance = Number(itemRes.formValues[1]);
                            
                            if (isNaN(chance) || chance <= 0) {
                                player.sendMessage("§cInvalid weight provided.");
                                return manageCrate(player, selectedCrateName);
                            }

                            const selectedSet = rawItemSets[selectedSetId];
                            
                            system.run(() => {
                                if (!crateItems[selectedCrateName]) crateItems[selectedCrateName] = [];
                                
                                let addedCount = 0;
                                for (const item of selectedSet.items) {
                                    const cleanName = item.typeId.replace("minecraft:", "");

                                    const cratePayload = { 
                                        name: cleanName, 
                                        id: item.typeId, 
                                        amount: item.amount, 
                                        chance: chance,
                                        enchants: item.enchants
                                    };

                                    if (item.potion) {
                                        cratePayload.potion = item.potion;
                                        cratePayload.delivery = item.delivery || "Consume";
                                    }

                                    crateItems[selectedCrateName].push(cratePayload);
                                    addedCount++;
                                }

                                H.setData("crateItems", crateItems);
                                player.sendMessage(`§aUnloaded ${addedCount} items from "${selectedSetId}" into the crate.`);
                                manageCrate(player, selectedCrateName);
                            });
                        });
                    break;
                }
                case 2: {
                    const itemsList = crateItems[selectedCrateName] || [];
                    const removeItemForm = new ActionFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.remove_item.title', with: [selectedCrateName] }] });

                    for (const item of itemsList) {
                        const displayName = item.potion ? `${item.delivery || "Consume"} Potion of ${item.potion}` : item.id.split(":")[1];
                        removeItemForm.button({ rawtext: [{ text: `${displayName} (x${item.amount})` }] });
                    }
                    removeItemForm.button({ rawtext: [{ translate: 'ui.button.admin_back' }] }, "textures/ui/back");

                    removeItemForm.show(player).then(removeRes => {
                        if (removeRes.canceled || removeRes.selection === itemsList.length) return manageCrate(player, selectedCrateName);

                        system.run(() => {
                            const selectedIndex = removeRes.selection;
                            const removedItemName = itemsList[selectedIndex].potion || itemsList[selectedIndex].id;

                            itemsList.splice(selectedIndex, 1);
                            crateItems[selectedCrateName] = itemsList;
                            H.setData("crateItems", crateItems);

                            player.sendMessage({ rawtext: [{ translate: 'crate.message.removed_item', with: [removedItemName] }] });
                            manageCrate(player, selectedCrateName);
                        });
                    });
                    break;
                }
                case 3: {
                    const editCostForm = new ModalFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { text: selectedCrateName }] })
                        .textField({ rawtext: [{ translate: 'crate.ui.manage.button.edit_cost' }] }, { rawtext: [{ text: "100" }] }, { defaultValue: String(crates[selectedCrateName].cost) });

                    editCostForm.show(player).then(editCostRes => {
                        if (editCostRes.canceled) return manageCrate(player, selectedCrateName);

                        const input = editCostRes.formValues[0];
                        if (!input) return player.sendMessage({ rawtext: [{ translate: 'message.error.empty_input' }] });
                        if (isNaN(input)) return player.sendMessage({ rawtext: [{ translate: 'message.error.invalid_number' }] });

                        system.run(() => {
                            crates[selectedCrateName].cost = Number(input);
                            H.setData("crates", crates);
                            player.sendMessage({ rawtext: [{ translate: 'crate.message.cost_updated' }] });
                            manageCrate(player, selectedCrateName);
                        });
                    });
                    break;
                }
                case 4: {
                    const sbs = H.getScoreboardList() || [];
                    let defIndex = sbs.indexOf(crates[selectedCrateName].scoreboard);
                    if (defIndex === -1) defIndex = 0;

                    const editScoreboardForm = new ModalFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { text: selectedCrateName }] })
                        .dropdown({ rawtext: [{ translate: 'crate.ui.manage.button.edit_scoreboard' }] }, sbs, { defaultValueIndex: defIndex });

                    editScoreboardForm.show(player).then(editScoreboardRes => {
                        if (editScoreboardRes.canceled) return manageCrate(player, selectedCrateName);

                        const input = sbs[editScoreboardRes.formValues[0]];
                        if (!input) return player.sendMessage({ rawtext: [{ translate: 'message.error.empty_input' }] });

                        system.run(() => {
                            crates[selectedCrateName].scoreboard = input;
                            H.setData("crates", crates);
                            player.sendMessage({ rawtext: [{ translate: 'crate.message.scoreboard_updated' }] });
                            manageCrate(player, selectedCrateName);
                        });
                    });
                    break;
                }
            }
        });
}

export function listCrates(player) {
    const crates = H.getData("crates") || {};
    const crateItems = H.getData("crateItems") || {};
    let rawtextBody = [{ text: "§8§m" + "—".repeat(25) + "§r\n" }];
    let hasCrates = false;

    for (const id in crates) {
        hasCrates = true;
        const crate = crates[id];
        const itemsList = crateItems[id] || [];

        rawtextBody.push({ text: `§3${crate.name.toUpperCase()}§r\n` });
        rawtextBody.push({ translate: 'crate.ui.list.cost', with: [String(crate.cost), String(crate.scoreboard)] });
        rawtextBody.push({ translate: 'crate.ui.list.items_header' });

        if (itemsList.length === 0) {
            rawtextBody.push({ translate: 'crate.ui.list.none' });
        } else {
            for (const item of itemsList) {
                const descriptor = item.potion ? `${item.delivery || "Consume"} Potion [${item.potion}]` : item.id;
                rawtextBody.push({ text: `\n §8• §f${descriptor} §7(x${item.amount}) §e${item.chance}§r` });
            }
            rawtextBody.push({ text: "\n" });
        }
        rawtextBody.push({ text: "§8§m" + "—".repeat(25) + "§r\n" });
    }

    if (!hasCrates) {
        rawtextBody = [{ translate: 'crate.ui.list.empty' }];
    }

    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.list.title' }] })
        .body({ rawtext: rawtextBody })
        .button({ rawtext: [{ translate: 'ui.button.back_double' }] });

    form.show(player).then(r => {
        if (r.canceled || r.selection === 0) return cratesMenu(player);
    });
}

export function removeCrate(player) {
    const crates = H.getData("crates") || {};
    const keys = Object.keys(crates);
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'crate.ui.remove.title' }] });

    if (keys.length === 0) {
        form.body({ rawtext: [{ translate: 'crate.ui.list.empty' }] });
    } else {
        for (const id in crates) form.button({ rawtext: [{ text: crates[id].name }] });
    }
    form.button({ rawtext: [{ translate: 'ui.button.admin_back' }] }, "textures/ui/back");

    form.show(player).then(r => {
        if (r.canceled || r.selection === keys.length) return cratesMenu(player);
        if (!keys[r.selection]) return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.not_exists' }] });

        system.run(() => {
            const selection = keys[r.selection];
            delete crates[selection];
            H.setData("crates", crates);
            removeCrate(player);
        });
    });
}

function removeBalance(player, scoreboard, amount) {
    let bal = getBalance(player, scoreboard);
    if (bal < amount) return false;
    player.runCommand(`scoreboard players remove @s "${scoreboard}" ${amount}`);
    return true;
}

function getBalance(player, scoreboard) {
    try {
        return world.scoreboard.getObjective(scoreboard)?.getScore(player.scoreboardIdentity) ?? 0;
    } catch {
        return 0;
    }
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block, player } = event;
    if (block.typeId !== "minecraft:ender_chest") return;

    const registry = H.getData("crateLocations") || {};
    const locKey = getLocKey(block.location, player.dimension.id);
    const crateData = registry[locKey];

    if (!crateData) {
        return;
    }

    event.cancel = true;

    system.run(() => {
        const crates = H.getData("crates") || {};
        const crateItems = H.getData("crateItems") || {};
        const itemsList = crateItems[crateData.crateId] || [];
        const crateConfig = crates[crateData.crateId];

        const totalChance = itemsList.reduce((acc, item) => acc + item.chance, 0);

        if (player.isSneaking) {
            let sneakMsg = [{ translate: 'crate.message.contains_header', with: [crateConfig.name] }];
            for (const item of itemsList) {
                sneakMsg.push({ text: `§6${item.amount} §dx §r${item.name} §7[${((item.chance / totalChance) * 100).toFixed(1)}%]\n` });
            }
            player.sendMessage({ rawtext: sneakMsg });
            return;
        }

        if (itemsList.length === 0) {
            return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.empty_interact' }] });
        }

        if (crateData.item) {
            const inv = player.getComponent("inventory").container;
            const requiredItem = crateData.item;
            const requiredAmount = 1;

            let hasItem = false;
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item && item.typeId === requiredItem && item.amount >= requiredAmount) {
                    if (item.amount === requiredAmount) {
                        inv.setItem(i, undefined);
                    } else {
                        item.amount -= requiredAmount;
                        inv.setItem(i, item);
                    }
                    hasItem = true;
                    break;
                }
            }

            if (!hasItem) {
                return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.missing_key' }] });
            }

        } else if (crateData.scoreboard) {
            const cost = crateConfig.cost || 0;
            if (!removeBalance(player, crateData.scoreboard, cost)) {
                return player.sendMessage({ rawtext: [{ translate: 'crate.message.error.insufficient_funds_custom', with: [crateData.scoreboard] }] });
            }
        }

        let random = Math.random() * totalChance;
        let runningTotal = 0;
        let wonItem = null;

        for (const item of itemsList) {
            runningTotal += item.chance;
            if (random <= runningTotal) {
                wonItem = item;
                break;
            }
        }

        if (wonItem) {
            let directionStr = "north";
            try {
                directionStr = block.permutation.getState("minecraft:cardinal_direction");
            } catch (e) { }

            openAnimation(player.dimension, block.location, wonItem, player, crateData.crateId, directionStr);
        }
    });
});

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const { block, dimension } = event;
    const registry = H.getData("crateLocations") || {};
    const locKey = getLocKey(block.location, dimension.id);

    if (registry[locKey]) {
        delete registry[locKey];
        H.setData("crateLocations", registry);

        const holoData = H.getData("holograms") || {};
        for (const id in holoData) {
            const holo = holoData[id];
            if (Math.abs(holo.x - (block.location.x + 0.5)) < 0.1 &&
                Math.abs(holo.z - (block.location.z + 0.5)) < 0.1) {
                const ent = world.getEntity(id);
                if (ent && ent.isValid) {
                    system.run(() => ent.remove());
                }
                delete holoData[id];
                H.setData("holograms", holoData);
            }
        }

        const displayLoc = { x: block.location.x + 0.5, y: block.location.y + 0.8, z: block.location.z + 0.5 };
        const displays = dimension.getEntities({ tags: ["sh:item_display"] });

        for (const e of displays) {
            if (e.isValid &&
                Math.abs(e.location.x - displayLoc.x) < 0.1 &&
                Math.abs(e.location.y - displayLoc.y) < 0.1 &&
                Math.abs(e.location.z - displayLoc.z) < 0.1) {
                system.run(() => e.remove());
            }
        }
    }
});

function applyItemSet(player, itemSet) {
    const inventory = player.getComponent("minecraft:inventory").container;
    const equipment = player.getComponent("minecraft:equippable");

    for (const itemData of itemSet.items) {
        try {
            const itemStack = H.createItemStackFromData(itemData, itemData.amount);
            if (!itemStack) continue;

            if (itemData.location === "slot") {
                inventory.setItem(itemData.slot, itemStack);
            } else if (itemData.location === "equipment") {
                const eqSlot = EquipmentSlot[itemData.slot];
                if (eqSlot) equipment.setEquipment(eqSlot, itemStack);
            }
        } catch (e) {
            console.warn(`Failed to process item ${itemData.typeId || itemData.potion}: ` + e);
        }
    }
}