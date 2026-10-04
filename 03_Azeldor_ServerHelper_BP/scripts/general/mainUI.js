import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as H from "./helpers";
import { ModerationMenu } from "../moderation/moderationUi";
import { CustomizationMenu } from "../customization/customizationUi";
import { helperMenu } from "../misc/helperMenu"

const TOGGLES_CATEGORIES = [
    {
        groupKey: "ui.toggles.group.global",
        items: ["ah", "ahModItems", "bazaar", "cratetoggle", "customTagVisible", "economy", "helper", "maintenance", "menuCommands", "menuItemCommands", "oldinvsee", "pmenu", "protectedspawner", "proxchat", "simple_spawners", "builtInTags"],
        texture: "textures/ui/World"
    },
    {
        groupKey: "ui.toggles.group.world",
        items: ["end", "nether", "worldBorderEnabled"],
        texture: "textures/blocks/barrier"
    },
    {
        groupKey: "ui.toggles.group.teleport",
        items: ["back", "rtp", "rtp_end", "rtp_nether", "tpa"],
        texture: "textures/items/ender_pearl"
    },
    {
        groupKey: "ui.toggles.group.gameplay",
        items: ["bountyToggle", "combatfly", "combatlog", "ctags", "headRank", "itemNames", "itemclear", "landclaim", "mobCL", "mobStack", "mtags", "playerheads", "pv", "visableHealth", "wither", "playerTrading"],
        texture: "textures/items/diamond_sword"
    },
    {
        groupKey: "ui.toggles.group.anticheat",
        items: ["antiBundle", "aurakick", "cpskick", "dupekick", "itemkick", "wordkick", "reachkick"],
        texture: "textures/ui/hammer_l"
    }
];

const SETTINGS_CATEGORIES = [
    {
        groupKey: "ui.settings.group.global",
        items: ["crateTime", "minbounty"],
        texture: "textures/ui/World"
    },
    {
        groupKey: "ui.settings.group.world",
        items: ["worldBorder_nether", "worldBorder_overworld", "worldBorder_the_end"],
        texture: "textures/blocks/barrier"
    },
    {
        groupKey: "ui.settings.group.teleport",
        items: ["rtpAtt", "rtpCd", "rtpRad", "teleportTime"],
        texture: "textures/items/ender_pearl"
    },
    {
        groupKey: "ui.settings.group.gameplay",
        items: ["chatrange", "cleardelay", "cleartime", "combattime", "maxah", "maxhomes", "maxland", "maxspawnerstack", "mobStackRad", "pv_amount"],
        texture: "textures/items/diamond_sword"
    },
    {
        groupKey: "ui.settings.group.anticheat",
        items: ["max_cps", "minflyheight", "minflytime", "minkillauradeg", "reachdistance"],
        texture: "textures/ui/hammer_l"
    }
];

const HELPER_CATEGORIES = [
    {
        group: { rawtext: [{ translate: "form.helper.group.moderation" }] },
        items: ["dupe", "inventory", "echest", "ban", "freeze", "mute", "spy", "itemban", "manageclaims", "vaults"]
    },
    {
        group: { rawtext: [{ translate: "form.helper.group.customization" }] },
        items: ["economy", "adminClaim", "holograms", "spawners", "warps", "crates", "chatTags", "trade", "broadcast", "mobSpawn", "bounties"]
    },
    {
        group: { rawtext: [{ translate: "form.helper.group.misc" }] },
        items: ["toggles", "settings"]
    }
];

const ANIMATION_OPTIONS = ["Static", "Color Cycle", "Color Gradient"];

const UI_TOGGLES = [
    { key: "stat_playtime", lang: "playtime" },
    { key: "stat_killstreak", lang: "killstreak" },
    { key: "stat_rank", lang: "rank" },
    { key: "stat_custom_obj_toggle", lang: "custom_obj" },
    { key: "onlineside", lang: "online_count" },
    { key: "boldtext", lang: "bold_text" }
];

const WARNING_TAGS = ["flywarningdisabled", "itemwarningdisabled", "killaurawarningdisabled"];

export function CentralAdminMenu(player) {
    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.title' }] })
        .button({ rawtext: [{ translate: 'ui.admin.button.moderation' }] }, "textures/items/iron_sword")
        .button({ rawtext: [{ translate: 'ui.admin.button.customization' }] }, "textures/items/painting")
        .button({ rawtext: [{ translate: 'ui.admin.button.helpers' }] }, "textures/ui/FriendsIcon")
        .button({ rawtext: [{ translate: 'ui.admin.button.warnings' }] }, "textures/menutextures/textbubble")
        .button({ rawtext: [{ translate: 'ui.admin.button.toggles' }] }, "textures/menutextures/switch")
        .button({ rawtext: [{ translate: 'ui.admin.button.settings' }] }, "textures/ui/gear")
        .button({ rawtext: [{ translate: 'ui.admin.button.logs' }] }, "textures/items/paper")
        .button({ rawtext: [{ translate: 'ui.admin.button.reports' }] }, "textures/items/spyglass")
        .show(player).then(r => {
            if (!player || !player.isValid) return;
            if (r.canceled) return;

            switch (r.selection) {
                case 0: ModerationMenu(player); break;
                case 1: CustomizationMenu(player); break;
                case 2: helper(player); break;
                case 3: warningMenu(player); break;
                case 4: togglesMenu(player); break;
                case 5: settingsMenu(player); break;
                case 6: LogsMenu(player); break;
                case 7: ReportsMenu(player); break;
            }
        });
}


export function ReportsMenu(player) {
    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.admin.button.reports' }] })
        .button({ rawtext: [{ translate: 'ui.player.report.bug' }] }, "textures/items/book_enchanted")
        .button({ rawtext: [{ translate: 'ui.player.report.player' }] }, "textures/items/name_tag")
        .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (!player || !player.isValid) return;
            if (r.canceled || r.selection === 2) return CentralAdminMenu(player);

            if (r.selection === 0) return viewReportList(player, "bugReports");
            if (r.selection === 1) return viewReportList(player, "playerReports");
        });
}

function viewReportList(player, reportType) {
    const data = H.getData(reportType, {});
    const keys = Object.keys(data);

    const titleKey = reportType === "bugReports" ? 'ui.player.report.bug' : 'ui.player.report.player';
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: titleKey }] });

    if (keys.length === 0) {
        form.body({ rawtext: [{ translate: "ui.report.none_found" }] });
    }

    keys.forEach(key => {
        form.button({ 
            rawtext: [{ translate: "ui.report.list_entry", with: [key, data[key].pName] }] 
        });
    });

    form.button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back");

    form.show(player).then(r => {
        if (!player || !player.isValid) return;
        if (r.canceled || r.selection === keys.length) return ReportsMenu(player);

        const selectedKey = keys[r.selection];
        readReport(player, reportType, selectedKey, data[selectedKey]);
    });
}

function readReport(player, reportType, reportKey, reportData) {
    const rawtextBody = [
        { translate: "ui.report.body.title", with: [reportKey] },
        { translate: "ui.report.body.reporter", with: [reportData.pName, reportData.date] }
    ];
    
    if (reportType === "playerReports" && reportData.rPlayer) {
        rawtextBody.push({ translate: "ui.report.body.target", with: [reportData.rPlayer] });
    }
    
    rawtextBody.push({ translate: "ui.report.body.content", with: [reportData.report] });

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { text: reportKey }] })
        .body({ rawtext: rawtextBody })
        .button({ rawtext: [{ translate: "ui.button.delete_report" }] }, "textures/ui/trash_default")
        .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (!player || !player.isValid) return;
            if (r.canceled || r.selection === 1) return viewReportList(player, reportType);

            if (r.selection === 0) {
                const data = H.getData(reportType, {});
                delete data[reportKey];
                H.setData(reportType, data);

                player.sendMessage({ 
                    rawtext: [{ translate: "message.report.deleted_success", with: [reportKey] }] 
                });
                viewReportList(player, reportType);
            }
        });
}


function formatLogEntry(key, log, isPlayerView = false) {
    let dateStr = "Unknown";

    if (log?.timestampPST) {
        dateStr = log.timestampPST;
    }
    else if (log?.date) {
        const pstDate = new Date(log.date - 28800000);
        const M = pstDate.getUTCMonth() + 1;
        const D = pstDate.getUTCDate();
        const Y = pstDate.getUTCFullYear();
        const h = String(pstDate.getUTCHours()).padStart(2, '0');
        const m = String(pstDate.getUTCMinutes()).padStart(2, '0');
        const s = String(pstDate.getUTCSeconds()).padStart(2, '0');
        dateStr = `${M}/${D}/${Y} ${h}:${m}:${s} PST`;
    }

    let modType = null;
    let baseComponent = null;

    if (key.startsWith("Join_")) {
        baseComponent = { translate: "ui.logs.entry.join", with: [String(log?.pName ?? log?.pId ?? "Unknown"), dateStr] };
    }
    else if (key.startsWith("Leave_")) {
        baseComponent = { translate: "ui.logs.entry.leave", with: [String(log?.pName ?? log?.pId ?? "Unknown"), dateStr] };
    }
    else if (key.startsWith("Kill_")) {
        baseComponent = {
            translate: "ui.logs.entry.kill",
            with: [
                String(log?.aName ?? log?.aId ?? "Unknown"),
                String(log?.tName ?? log?.tId ?? "Unknown"),
                dateStr
            ],
        };
    }
    else if (key.startsWith("Bundle_")) {
        modType = "Bundle Exploit";
        const loc = log?.loc;
        const locStr = loc ? `${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)}` : "Unknown";
        baseComponent = { translate: "ui.logs.entry.bundle", with: [locStr, dateStr] };
    }
    else if (key.startsWith("AntiDupe_")) {
        modType = "Anti-Dupe";
        baseComponent = {
            translate: "ui.logs.entry.antiDupe",
            with: [
                String(log?.pName ?? log?.pId ?? "Unknown"),
                String(log?.item ?? "Unknown"),
                dateStr
            ],
        };
    }
    else if (key.startsWith("BannedItem_")) {
        modType = "Banned Item";
        baseComponent = {
            translate: "ui.logs.entry.bannedItem",
            with: [
                String(log?.pName ?? log?.pId ?? "Unknown"),
                String(log?.item ?? "Unknown"),
                dateStr
            ],
        };
    }
    else if (key.startsWith("Fly_")) {
        modType = "Fly";
        baseComponent = { translate: "ui.logs.entry.fly", with: [String(log?.pName ?? log?.pId ?? "Unknown"), dateStr] };
    }
    else if (key.startsWith("KillAura_")) {
        modType = "Kill Aura";
        baseComponent = { translate: "ui.logs.entry.killAura", with: [String(log?.pName ?? log?.pId ?? "Unknown"), dateStr] };
    }
    else if (key.startsWith("AntiReach_")) {
        modType = "Anti-Reach";
        baseComponent = { translate: "ui.logs.entry.antiReach", with: [String(log?.pName ?? log?.pId ?? "Unknown"), dateStr] };
    }
    else {
        baseComponent = { text: key };
    }

    if (modType) {
        if (isPlayerView) {
            return [
                { text: `§c[${modType}] ` },
                baseComponent
            ];
        }
        return [
            { text: `§c` },
            baseComponent
        ];
    }

    return [baseComponent];
}

function buildLogsBody(filterFn, isPlayerView = false) {
    const logData = H.getData("logs", {});
    const entries = Object.entries(logData)
        .filter(([key, log]) => log && filterFn(key, log))
        .sort((a, b) => (b[1]?.date ?? 0) - (a[1]?.date ?? 0))
        .slice(0, 50);

    if (entries.length === 0) return { rawtext: [{ translate: "ui.logs.body.empty" }] };

    const rawtext = [];
    for (const [key, log] of entries) {
        const formatted = formatLogEntry(key, log, isPlayerView);
        
        if (Array.isArray(formatted)) {
            rawtext.push(...formatted);
        } else {
            rawtext.push(formatted);
        }
        
        rawtext.push({ text: "§r\n" });
    }
    return { rawtext };
}

export function LogsMenu(player) {
    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.admin.button.logs" }] })
        .body({ rawtext: [{ translate: "ui.logs.warning" }] })
        .button({ rawtext: [{ translate: "ui.logs.button.moderation" }] })
        .button({ rawtext: [{ translate: "ui.logs.button.general" }] })
        .button({ rawtext: [{ translate: "ui.logs.button.player" }] })
        .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 3) return CentralAdminMenu(player);

            switch (r.selection) {
                case 0: {
                    const moderation = (player) => new ActionFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.logs.button.moderation" }] })
                        .body({ rawtext: [{ translate: "ui.logs.warning" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.bundle" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.dupe" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.bannedItems" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.fly" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.killAura" }] })
                        .button({ rawtext: [{ translate: 'ui.logs.button.antiReach'}]})
                        .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
                        .show(player).then(r2 => {
                            if (r2.canceled || r2.selection === 6) return LogsMenu(player);

                            const pages = [
                                { titleKey: "ui.logs.button.bundle", filterFn: (key) => key.startsWith("Bundle_") },
                                { titleKey: "ui.logs.button.dupe", filterFn: (key) => key.startsWith("AntiDupe_") },
                                { titleKey: "ui.logs.button.bannedItems", filterFn: (key) => key.startsWith("BannedItem_") },
                                { titleKey: "ui.logs.button.fly", filterFn: (key) => key.startsWith("Fly_") },
                                { titleKey: "ui.logs.button.killAura", filterFn: (key) => key.startsWith("KillAura_") },
                                { titleKey: 'ui.logs.button.antiReach', filterFn: (key) => key.startsWith("AntiReach_")}
                            ];
                            const page = pages[r2.selection];

                            new ActionFormData()
                                .title({ rawtext: [{ text: H.customUi() }, { translate: page.titleKey }] })
                                .body(buildLogsBody(page.filterFn))
                                .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
                                .show(player).then(r3 => {
                                    if (r3.canceled || r3.selection === 0) return moderation(player);
                                });
                        });
                    moderation(player);
                } break;

                case 1: {
                    const general = (player) => new ActionFormData()
                        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.logs.button.general" }] })
                        .body({ rawtext: [{ translate: "ui.logs.warning" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.joins" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.leaves" }] })
                        .button({ rawtext: [{ translate: "ui.logs.button.kills" }] })
                        .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
                        .show(player).then(r2 => {
                            if (r2.canceled || r2.selection === 3) return LogsMenu(player);

                            const pages = [
                                { titleKey: "ui.logs.button.joins", filterFn: (key) => key.startsWith("Join_") },
                                { titleKey: "ui.logs.button.leaves", filterFn: (key) => key.startsWith("Leave_") },
                                { titleKey: "ui.logs.button.kills", filterFn: (key) => key.startsWith("Kill_") },
                            ];
                            const page = pages[r2.selection];

                            new ActionFormData()
                                .title({ rawtext: [{ text: H.customUi() }, { translate: page.titleKey }] })
                                .body(buildLogsBody(page.filterFn))
                                .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
                                .show(player).then(r3 => {
                                    if (r3.canceled || r3.selection === 0) return general(player);
                                });
                        });
                    general(player);
                } break;

                case 2: {
                    H.TargetActionForm(
                        "ui.logs.button.player",
                        (target) => LogTargetForm(player, target),
                        undefined,
                        (p) => LogsMenu(p)
                    )(player);
                } break;
            }
        });
}

function LogTargetForm(player, target) {
    if (!target?.isValid) return LogsMenu(player);   

    const targetId = target.id;
    const targetName = target.name;
    
    const body = buildLogsBody(
        (key, log) => 
            log?.pId === targetId || 
            log?.aId === targetId || 
            log?.tId === targetId ||
            log?.pName === targetName ||
            log?.aName === targetName ||
            log?.tName === targetName,
        true
    );

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.logs.title.player", with: [String(target.name)] }] })
        .body(body)
        .button({ rawtext: [{ translate: "ui.button.admin_back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 0) return H.TargetActionForm(
                "ui.logs.button.player",
                (t) => LogTargetForm(player, t),
                undefined,
                (p) => LogsMenu(p)
            )(player);
        });
}

export function togglesMenu(player) {
    const hubMenu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.toggles.title' }] });

    TOGGLES_CATEGORIES.forEach(cat => {
        hubMenu.button({ rawtext: [{ translate: cat.groupKey }] }, cat.texture);
    });
    hubMenu.button({ rawtext: [{ translate: 'ui.button.admin_back' }] }, "textures/ui/back");

    hubMenu.show(player).then(r => {
        if (!player || !player.isValid) return;
        if (r.canceled || r.selection === TOGGLES_CATEGORIES.length) return H.isOp(player) ? CentralAdminMenu(player) : helperMenu(player);

        openCategoryModal(player, TOGGLES_CATEGORIES[r.selection]);
    });

    function openCategoryModal(player, category) {
        const modal = new ModalFormData().title({ rawtext: [{ text: H.customUi() }, { translate: category.groupKey }] });
        const properties = [];

        category.items.forEach(propKey => {
            const val = world.getDynamicProperty(propKey) ?? false;
            modal.toggle({ rawtext: [{ translate: `ui.toggles.label.${propKey}` }] }, { defaultValue: val });
            properties.push(propKey);
        });

        modal.show(player).then(r => {
            if (!player || !player.isValid) return;
            if (r.canceled) return togglesMenu(player);

            r.formValues.forEach((newValue, i) => {
                const prop = properties[i];
                if (!prop) return;

                const oldValue = world.getDynamicProperty(prop) ?? false;

                if (newValue !== oldValue) {
                    world.setDynamicProperty(prop, newValue);
                    const stateKey = newValue ? 'ui.status.enabled' : 'ui.status.disabled';

                    player.sendMessage({
                        rawtext: [
                            { text: "§6[Admin] §f" },
                            { translate: `ui.toggles.label.${prop}` },
                            { text: " §7" },
                            { translate: 'message.toggles.is_now' },
                            { text: " " },
                            { translate: stateKey }
                        ]
                    });
                }
            });
            togglesMenu(player);
        });
    }
}

export function settingsMenu(player) {
    const hubMenu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.settings.title' }] });

    SETTINGS_CATEGORIES.forEach(cat => {
        hubMenu.button({ rawtext: [{ translate: cat.groupKey }] }, cat.texture);
    });
    hubMenu.button({ rawtext: [{ translate: 'ui.button.admin_back' }] }, "textures/ui/back");

    hubMenu.show(player).then(r => {
        if (!player || !player.isValid) return;
        if (r.canceled || r.selection === SETTINGS_CATEGORIES.length) return H.isOp(player) ? CentralAdminMenu(player) : helperMenu(player);

        openSettingsModal(player, SETTINGS_CATEGORIES[r.selection]);
    });

    function openSettingsModal(player, category) {
        const modal = new ModalFormData().title({ rawtext: [{ text: H.customUi() }, { translate: category.groupKey }] });
        const properties = [];

        if (category.items.some(item => item === "cleartime" || item === "cleardelay")) {
            modal.label({ rawtext: [{ translate: 'ui.settings.warning.reload' }] });
        }
        if (category.items.includes("rtpRad")) {
            modal.label({ rawtext: [{ translate: 'ui.settings.warning.radius' }] });
        }

        category.items.forEach(propKey => {
            const val = (world.getDynamicProperty(propKey) ?? 0).toString();
            modal.textField({ rawtext: [{ translate: `ui.settings.label.${propKey}` }] }, "Number", { defaultValue: val });
            properties.push(propKey);
        });

        modal.show(player).then(r => {
            if (!player || !player.isValid) return;
            if (r.canceled) return settingsMenu(player);

            let propertyIndex = 0;
            r.formValues.forEach((val) => {
                if (val === undefined || val === null) return;

                const prop = properties[propertyIndex];
                propertyIndex++;
                if (!prop) return;

                const parsedVal = parseInt(val);
                const oldVal = world.getDynamicProperty(prop) ?? 0;

                if (!isNaN(parsedVal) && parsedVal !== oldVal) {
                    world.setDynamicProperty(prop, parsedVal);
                    player.sendMessage({
                        rawtext: [
                            { text: "§6[Admin] §f" },
                            { translate: `ui.settings.label.${prop}` },
                            { text: ` §7-> §b${parsedVal}` }
                        ]
                    });
                }
            });
            settingsMenu(player);
        });
    }
}



function warningMenu(player) {
    const getStatusKey = (tag) => player.hasTag(tag) ? "status.off" : "status.on";

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "form.warning.title" }] })
        .button({ rawtext: [{ translate: "form.warning.button.fly" }, { translate: getStatusKey(WARNING_TAGS[0]) }] }, "textures/items/feather")
        .button({ rawtext: [{ translate: "form.warning.button.item" }, { translate: getStatusKey(WARNING_TAGS[1]) }] }, "textures/items/diamond")
        .button({ rawtext: [{ translate: "form.warning.button.killaura" }, { translate: getStatusKey(WARNING_TAGS[2]) }] }, "textures/items/iron_sword")
        .button({ rawtext: [{ translate: "form.warning.button.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (!player || !player.isValid) return;
            if (r.canceled || r.selection === 3) return CentralAdminMenu(player);

            const selectedTag = WARNING_TAGS[r.selection];
            if (selectedTag) {
                if (player.hasTag(selectedTag)) {
                    player.removeTag(selectedTag);
                } else {
                    player.addTag(selectedTag);
                }
                warningMenu(player);
            }
        });
}

function helper(player) {
    const menu = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "form.helper.title" }] });

    const flatProps = [];

    HELPER_CATEGORIES.forEach(cat => {
        menu.label(cat.group);
        flatProps.push(null);

        cat.items.forEach(propKey => {
            const rawVal = world.getDynamicProperty(propKey);
            const val = typeof rawVal === "boolean" ? rawVal : false;
            const label = { rawtext: [{ translate: `form.helper.toggle.${propKey}` }] };

            menu.toggle(label, { defaultValue: val });
            flatProps.push(propKey);
        });
    });

    menu.show(player).then(r => {
        if (!player || !player.isValid) return;
        if (r.canceled) return CentralAdminMenu(player);

        r.formValues.forEach((newValue, i) => {
            const prop = flatProps[i];
            if (!prop) return;

            const rawOldValue = world.getDynamicProperty(prop);
            const oldBoolValue = typeof rawOldValue === "boolean" ? rawOldValue : false;

            if (newValue !== oldBoolValue) {
                world.setDynamicProperty(prop, newValue);

                player.sendMessage({
                    rawtext: [
                        { text: "§2[Helper] §f" },
                        { translate: `form.helper.toggle.${prop}` },
                        { text: " " },
                        { translate: "message.helper.is_now" },
                        { text: " " },
                        { translate: newValue ? "status.enabled" : "status.disabled" }
                    ]
                });
            }
        });
        CentralAdminMenu(player);
    });
}