import { world, system, Potions, EnchantmentTypes, MolangVariableMap, ItemStack } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"

export function isOp(player) {
    return player.playerPermissionLevel === 2;
}

export function playSuccess(player) {
    try { player.playSound("random.levelup"); } catch (e) { }
}

export function playPurchase(player) {
    try { player.playSound("random.orb"); } catch (e) { }
}

export function playClick(player) {
    try { player.playSound("random.click"); } catch (e) { }
}

export function playCancel(player) {
    try { player.playSound("random.pop"); } catch (e) { }
}

export function playDenied(player) {
    try { player.playSound("note.bass", { pitch: 0.5, volume: 1.0 }); } catch (e) { }
}

export function spawnRewardParticle(dimension, location) {
    try {
        dimension.spawnParticle("minecraft:totem_particle", { x: location.x + 0.5, y: location.y + 1.3, z: location.z + 0.5 }, new MolangVariableMap());
    } catch (e) { }
}

export function spawnTeleportBurst(dimension, location) {
    try {
        const center = { x: location.x + 0.5, y: location.y + 1, z: location.z + 0.5 };
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            dimension.spawnParticle("minecraft:endrod", {
                x: center.x + Math.cos(angle) * 0.6,
                y: center.y + 0.2,
                z: center.z + Math.sin(angle) * 0.6
            });
        }
        dimension.spawnParticle("minecraft:villager_happy", center);
    } catch (e) { }
}

export const customUi = () => {
    return world.getDynamicProperty("customTagVisible") ?? true ? "§c§u§s§t§o§m" : "";
};

export function getScoreboardList() {
    const objs = world.scoreboard.getObjectives().map(o => o.id);
    return objs.length > 0 ? objs : ["No Scoreboards Found"];
};

export function addBalance(player, scoreboard, amount) {
    try {
        player.runCommand(`scoreboard players add @s "${scoreboard}" ${amount}`);
        return true;
    } catch (e) {
        return false;
    }
}

export function getBalance(player, scoreboard) {
    try {
        return world.scoreboard.getObjective(scoreboard).getScore(player.scoreboardIdentity) ?? 0;
    } catch { return 0; }
}

export function removeBalance(player, scoreboard, amount) {
    let bal = getBalance(player, scoreboard);
    if (bal < amount) return false;
    player.runCommand(`scoreboard players remove @s "${scoreboard}" ${amount}`);
    return true;
}

const dataCache = new Map();

export const getData = (key, defaultValue) => {
    if (!key) return;
    let raw = world.getDynamicProperty(key);
    if (raw === undefined) return defaultValue;

    const cached = dataCache.get(key);
    if (cached && cached.raw === raw) return cached.parsed;

    if (typeof raw === "string" && raw.startsWith("CHUNKED:")) {
        const header = raw;
        const chunkCount = parseInt(raw.split(":")[1]);
        let fullString = "";
        for (let i = 0; i < chunkCount; i++) {
            const chunk = world.getDynamicProperty(`${key}_chunk_${i}`);
            if (chunk !== undefined) fullString += chunk;
        }
        try {
            const parsed = JSON.parse(fullString);
            dataCache.set(key, { raw: header, parsed });
            return parsed;
        } catch {
            return defaultValue;
        }
    }

    try {
        const parsed = JSON.parse(raw);
        if (defaultValue && (typeof parsed !== typeof defaultValue || Array.isArray(parsed) !== Array.isArray(defaultValue))) {
            world.sendMessage(`§cType mismatch for key: ${key}. Expected ${typeof defaultValue}, got ${typeof parsed}. resetting property...`);
            world.setDynamicProperty(key, defaultValue)
            return defaultValue;
        }

        dataCache.set(key, { raw, parsed });
        return parsed;
    } catch {
        return defaultValue;
    }
};

export const setData = (key, value) => {
    const str = JSON.stringify(value);

    const oldProp = world.getDynamicProperty(key);
    if (typeof oldProp === "string" && oldProp.startsWith("CHUNKED:")) {
        const oldChunks = parseInt(oldProp.split(":")[1]);
        for (let i = 0; i < oldChunks; i++) {
            world.setDynamicProperty(`${key}_chunk_${i}`, undefined);
        }
    }

    if (str && str.length > 30000) {
        console.warn(`Large data save: ${key}, ${str.length}`);
        const chunks = Math.ceil(str.length / 30000);
        world.setDynamicProperty(key, `CHUNKED:${chunks}`);

        for (let i = 0; i < chunks; i++) {
            world.setDynamicProperty(`${key}_chunk_${i}`, str.substring(i * 30000, (i + 1) * 30000));
        }
        dataCache.set(key, { raw: `CHUNKED:${chunks}`, parsed: value });
    } else {
        world.setDynamicProperty(key, str);
        dataCache.set(key, { raw: str, parsed: value });
    }
};

export function LARActionForm(options) {
    const {
        title,
        property,
        type,
        backCallback,
        fields = null,
        listFormatter = null,
        requireAmount = true,
        customText = []
    } = options;

    return function showMenu(player) {
        const titleText = typeof title === "string" ? { translate: title } : title;

        new ActionFormData()
            .title({ rawtext: [{ text: customUi() }, titleText] })
            .button({ rawtext: [{ translate: "ui.general.button.list" }] }, "textures/items/paper")
            .button({ rawtext: [{ translate: "ui.general.button.add" }] }, "textures/ui/color_plus")
            .button({ rawtext: [{ translate: "ui.general.button.remove" }] }, "textures/ui/realms_red_x")
            .button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back")
            .show(player).then(r => {
                if (r.canceled) {
                    if (backCallback) backCallback(player);
                    return;
                }
                playClick(player);
                if (r.selection === 3) {
                    if (backCallback) backCallback(player);
                    return;
                }
                if (r.selection === 0) {

                    let rawData = getData(property);
                    const items = Array.isArray(rawData) ? Object.assign({}, rawData) : (rawData || {});

                    let msg = { rawtext: [{ translate: "ui.general.list_header", with: [`${type}(s)`] }, { text: "\n§r" }] };

                    for (let id in items) {
                        if (listFormatter) {
                            msg.rawtext.push({ text: listFormatter(id, items[id]) + "\n" });
                        } else {
                            const displayData = typeof items[id] === 'object' ? JSON.stringify(items[id]) : items[id];
                            msg.rawtext.push({ text: `§7${id}: §f${displayData}\n` });
                        }
                    }
                    player.sendMessage(msg);
                }

                else if (r.selection === 1) {
                    const addForm = new ModalFormData()
                        .title({ rawtext: [{ text: customUi() }, { translate: 'ui.general.add_title', with: [type] }] });

                    if (fields && fields.length > 0) {
                        const cachedDropdownOptions = [];

                        fields.forEach((f, index) => {
                            const fType = f.type.toLowerCase();
                            if (fType === "textfield") {
                                addForm.textField({rawtext: [{translate: f.text}]}, {rawtext: [{translate: f.subtext}]} || "", {defaultValue: f.defaultValue || ""});
                            } else if (fType === "dropdown") {
                                const resolvedOptions = typeof f.options === "function" ? f.options() : (f.options || []);
                                const safeOptions = resolvedOptions.length > 0 ? resolvedOptions : ["No Options"];
                                cachedDropdownOptions[index] = safeOptions;
                                addForm.dropdown({rawtext: [{translate: f.text}]}, safeOptions, {defaultValueIndex: f.defaultValueIndex || 0});
                            } else if (fType === "toggle") {
                                addForm.toggle({rawtext: [{translate: f.text}]}, {defaultValue: f.defaultValue || false});
                            } else if (fType === "slider") {
                                addForm.slider({rawtext: [{translate: f.text}]}, f.min || 0, f.max || 100, f.step || 1);
                            }
                        });

                        addForm.show(player).then(addRes => {
                            if (addRes.canceled) return showMenu(player);

                            let rawData = getData(property);
                            const items = Array.isArray(rawData) ? Object.assign({}, rawData) : (rawData || {});

                            let newItem = {};
                            let mainKey = null;

                            fields.forEach((f, index) => {
                                let val = addRes.formValues[index];

                                if (f.type.toLowerCase() === "dropdown") {
                                    val = cachedDropdownOptions[index][val];
                                }

                                if (f.valueType === "number") {
                                    val = Number(val);
                                    if (isNaN(val)) val = 0;
                                }

                                newItem[f.attribute] = val;

                                if (f.isKey) mainKey = val;
                            });

                            if (mainKey === null || mainKey === undefined || mainKey === "") {
                                mainKey = newItem[fields[0].attribute];
                            }

                            items[mainKey] = newItem;

                            setData(property, items);
                            playSuccess(player);
                            showMenu(player);
                        }).catch(e => console.warn("[UI Error] " + e));
                    }
                    else {
                        const idLabel = customText[0]?.header || { translate: "ui.general.enter_id", with: [type] };
                        const idPlaceholder = customText[0]?.placeholder !== undefined ? customText[0].placeholder : { translate: "ui.general.example_id" };
                        addForm.textField(idLabel, idPlaceholder);

                        if (requireAmount) {
                            const valLabel = customText[1]?.header || { translate: "ui.general.enter_value" };
                            const valPlaceholder = customText[1]?.placeholder !== undefined ? customText[1].placeholder : { translate: "ui.general.example_value" };
                            addForm.textField(valLabel, valPlaceholder);
                        }

                        addForm.show(player).then(addRes => {
                            if (addRes.canceled) return showMenu(player);

                            let rawData = getData(property);
                            const items = Array.isArray(rawData) ? Object.assign({}, rawData) : (rawData || {});

                            const idInput = addRes.formValues[0];
                            let quantity = 1;

                            if (requireAmount) {
                                const valueInput = addRes.formValues[1];
                                quantity = parseInt(valueInput) || valueInput || 1;
                            }

                            items[idInput] = quantity;
                            setData(property, items);
                            playSuccess(player);
                            showMenu(player);
                        }).catch(e => console.warn("[UI Error] " + e));
                    }
                }

                else if (r.selection === 2) {
                    const items = getData(property) || {};
                    const keys = Object.keys(items);

                    if (keys.length === 0) {
                        player.sendMessage({ rawtext: [{ translate: "ui.general.none_found", with: [`${type}s`] }] });
                        playDenied(player);
                        return showMenu(player);
                    }

                    const removeMenu = new ActionFormData()
                        .title({ rawtext: [{ text: customUi() }, { translate: "ui.general.remove.title", with: [type] }] });

                    keys.forEach(id => removeMenu.button(id));

                    removeMenu.show(player).then(remRes => {
                        if (remRes.canceled) return showMenu(player);

                        const selectedId = keys[remRes.selection];
                        delete items[selectedId];
                        setData(property, items);
                        playCancel(player);
                        showMenu(player);
                    }).catch(e => console.warn("[UI Error] " + e));
                }
            }).catch(e => {
                console.warn("[UI Error LAR] " + e);
            });
    };
}

export function TargetActionForm(title, codeToRun, filter = undefined, backCallback) {
    return function showMenu(player) {
        const form = new ActionFormData()
            .title({ rawtext: [{ text: customUi() }, { translate: title }] });
        let players
        if (filter) players = world.getAllPlayers().filter(filter)
        else players = world.getAllPlayers();

        for (const p of players) {
            form.button(p.name);
        }
        form.button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back");

        form.show(player).then(r => {
            if (r.canceled) {
                if (backCallback) backCallback(player);
                return;
            }
            playClick(player);
            if (r.selection === players.length) {
                if (backCallback) backCallback(player);
                return;
            }
            const selectedTarget = players[r.selection];
            codeToRun(player, selectedTarget);

        }).catch(e => {
            console.warn("[UI Error Target] " + e);
        });
    };
}

export function ActionFormHub(title, options = [], backCallback) {
    return function showMenu(player) {
        const form = new ActionFormData()
            .title({ rawtext: [{ text: customUi() }, { translate: title }] });

        for (const button of options) {
            form.button(button.name, button.texture);
        }
        form.button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back");

        form.show(player).then(r => {
            if (r.canceled) {
                if (backCallback) backCallback(player);
                return;
            }
            playClick(player);
            if (r.selection === options.length) {
                if (backCallback) backCallback(player);
                return;
            }
            const selectedForm = options[r.selection];
            selectedForm.form(player);

        })
    };
}

export function startTeleportWithDelay(player, targetPos, dimension, name) {
    if (!player || !player.isValid) return;

    const startLoc = player.location;
    const startDimension = player.dimension;
    const delay = world.getDynamicProperty("teleportTime") ?? 3;
    let ticks = 0;
    
    player.sendMessage({ rawtext: [{ translate: "message.teleport.starting", with: [String(delay)] }] });
    
    for (let i = delay - 1; i > 0; i--) {
        system.runTimeout(() => {
            if (!player || !player.isValid) return;
player.runCommand(`playsound note.chime @s`);
            try {
                player.dimension.spawnParticle("minecraft:endrod", { x: player.location.x, y: player.location.y + 0.1, z: player.location.z });
            } catch (e) { }
        }, (delay - i) * 20);
    }
    
    const runId = system.runInterval(() => {
        if (!world.getAllPlayers().includes(player) || Math.hypot(player.location.x - startLoc.x, player.location.z - startLoc.z) > 0.5) {
            if (player && player.isValid) {
                player.sendMessage({ rawtext: [{ translate: "message.teleport.cancelled" }] });
                playCancel(player);
            }
            system.clearRun(runId);
            return;
        }
        
        ticks++;
        if (ticks >= delay * 20) {
            system.clearRun(runId);
            if (player && player.isValid) {
                spawnTeleportBurst(startDimension, startLoc);
                player.runCommand(`playsound mob.endermen.portal @s`);
                player.teleport({x: targetPos.x + 0.5, y: targetPos.y, z: targetPos.z + 0.5}, { dimension: dimension });
                spawnTeleportBurst(dimension, targetPos);
                player.sendMessage({ rawtext: [{ translate: "message.teleport.success", with: [name] }] });
            }
        }
    }, 1);
}

export function safeSpawn(player, dimension) {
    if (!player || !player.isValid) return;
    if (!dimension) dimension = player.dimension

    const spawn = world.getDefaultSpawnLocation();

    if (spawn.y > 30000) {
        player.sendMessage({ 
            rawtext: [{ translate: "message.teleport.bug" }] 
        });
        return;
    }

    startTeleportWithDelay(player, spawn, dimension, "Spawn");
}

export function createItemStackFromData(item, targetAmount) {
    let stack;

    if (item.potion) {
        const allEffects = Potions.getAllEffectTypes();
        const allDeliveries = Potions.getAllDeliveryTypes();
        
        const searchEffect = item.potion.toLowerCase().replace("minecraft:", "");
        const searchDelivery = (item.delivery || "Consume").toLowerCase();
        
        const effectType = allEffects.find(e => e.id.toLowerCase().includes(searchEffect));
        const deliveryType = allDeliveries.find(d => d.id.toLowerCase().includes(searchDelivery));

        if (effectType && deliveryType) {
            stack = Potions.resolve(effectType, deliveryType);
            if (stack) stack.amount = targetAmount || item.amount || 1;
        }
    } 
    
    if (!stack && item.id) {
        stack = new ItemStack(item.id, targetAmount || item.amount || 1);
    }

    if (stack) {
        if (item.enchants) {
            const enchantable = stack.getComponent("minecraft:enchantable");
            if (enchantable) {
                for (const [enchId, level] of Object.entries(item.enchants)) {
                    try {
                        const enchType = EnchantmentTypes.get(enchId);
                        if (enchType) {
                            enchantable.addEnchantment({ type: enchType, level });
                        }
                    } catch (e) { console.warn(`Failed to add enchantment ${enchId}: ${e}`); }
                }
            }
        }
        if (item.nameTag) {
            stack.nameTag = item.nameTag;
        }
    }
    
    return stack;
}

export function getPSTString() {
    const pstDate = new Date(Date.now() - 28800000);

    const M = pstDate.getUTCMonth() + 1;
    const D = pstDate.getUTCDate();
    const Y = pstDate.getUTCFullYear();
    const h = String(pstDate.getUTCHours()).padStart(2, '0');
    const m = String(pstDate.getUTCMinutes()).padStart(2, '0');
    const s = String(pstDate.getUTCSeconds()).padStart(2, '0');

    return `${M}/${D}/${Y} ${h}:${m}:${s} PST`;
}

const LOG_FLUSH_TICKS = 100;
let logFlushScheduled = false;
let pendingLogData = null;

export function flushLogs() {
    logFlushScheduled = false;
    if (!pendingLogData) return;
    const data = pendingLogData;
    pendingLogData = null;
    setData("logs", data);
}

export function addLog(prefix, data) {
    if (!pendingLogData) pendingLogData = getData("logs", {});
    const logData = pendingLogData;
    const key = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const timeString = getPSTString();
    
    logData[key] = { 
        ...data, 
        timestampPST: timeString,
        date: Date.now() 
    };
    
    if (!logFlushScheduled) {
        logFlushScheduled = true;
        system.runTimeout(flushLogs, LOG_FLUSH_TICKS);
    }
}