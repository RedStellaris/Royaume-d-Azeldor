import { world, system } from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"
import { index } from "./index"
import * as H from "../general/helpers"
import { OpenMainMenu } from "../misc/economy"

export const MenuActions = {
    claim: (player) => index.ClaimSystem.LandClaimMenu(player),
    spawn: (player) => H.safeSpawn(player, world.getDimension("overworld")),
    home: (player) => index.HomeSystem.HomeMainMenu(player),
    warps: (player) => index.WarpSystem.WarpMenu(player),
    rtp: (player) => index.RTPSytem.RtpMenu(player),
    tpa: (player) => index.TPASystem.TPAMainMenu(player),
    shop: (player) => OpenMainMenu(player),
    spawners: (player) => index.BuySpawnerMenu(player),
    crates: (player) => index.CrateSystem.crateMenu(player),
    bounties: (player) => index.BountySystem.PlayerBountyMenu(player),
    quests: (player) => index.QuestSystem.QuestMenu(player),
    main: (player) => PlayerMainMenu(player),
    report: (player) => index.ReportSystem.MainUi(player),
    trade: (player) => index.TradeMenuSystem.TradeMainMenu(player)
};

export function PlayerMainMenu(player) {
    const canTpa = world.getDynamicProperty("tpa") === true;
    const maxHomes = world.getDynamicProperty("maxhomes") ?? 0;
    const hasEconomy = world.getDynamicProperty("economy") === true;
    const canClaim = world.getDynamicProperty("landclaim") === true;
    const crates = world.getDynamicProperty("cratetogle") === true;
    const canRTP = world.getDynamicProperty("rtp") === true;
    const bounties = world.getDynamicProperty("bountyToggle") === true;
    const canTrade = world.getDynamicProperty("playerTrading") === true;

    const spawnerData = H.getData("spawners", {});
    const hasSpawners = spawnerData != "{}";

    const hasQuests = Object.keys(H.getData("quests") ?? {}).length > 0;

    let rawData = world.getDynamicProperty("worldwarps");
    let warpData = {};
    try { warpData = rawData ? JSON.parse(rawData) : {}; } catch (e) { warpData = {}; }
    const warpNames = Object.keys(warpData);

    const allButtons = [
        {
            label: { rawtext: [{ translate: "ui.player.menu.claim" }] },
            icon: "textures/items/painting",
            condition: canClaim,
            action: MenuActions.claim
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.spawn" }] },
            icon: "textures/menutextures/nether",
            condition: true,
            action: MenuActions.spawn
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.home" }] },
            icon: "textures/menutextures/home",
            condition: maxHomes > 0,
            action: MenuActions.home
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.warps" }] },
            icon: "textures/items/ender_pearl",
            condition: warpNames.length > 0,
            action: MenuActions.warps
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.rtp" }] },
            icon: "textures/items/chorus_fruit",
            condition: canRTP,
            action: MenuActions.rtp
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.tpa" }] },
            icon: "textures/menutextures/tpa_2",
            condition: canTpa,
            action: MenuActions.tpa
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.shop" }] },
            icon: "textures/items/shop",
            condition: hasEconomy,
            action: MenuActions.shop
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.spawners" }] },
            icon: "textures/items/spawn_egg",
            condition: hasSpawners && hasEconomy,
            action: MenuActions.spawners
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.crates" }] },
            icon: "textures/ui/inventory_icon",
            condition: crates,
            action: MenuActions.crates
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.bounties" }] },
            icon: "textures/items/iron_sword",
            condition: bounties,
            action: MenuActions.bounties
        },
        {
            label: { rawtext: [{ translate: "ui.player.menu.quests" }] },
            icon: "textures/items/fishing_rod_uncast",
            condition: hasQuests,
            action: MenuActions.quests
        },
        {
            label: { rawtext: [{ translate: 'ui.player.menu.report' }]},
            icon: "textures/items/spyglass",
            condition: true,
            action: MenuActions.report
        },
        {
            label: { rawtext: [{ translate: 'ui.player.menu.trade' }] },
            icon: "textures/menutextures/tpa",
            condition: canTrade,
            action: MenuActions.trade
        }
    ];

    const visibleButtons = allButtons.filter(btn => btn.condition);
    const form = new ActionFormData().title({rawtext: [{ text: H.customUi() }, { translate: "ui.player.menu.title" }]});

    visibleButtons.forEach(btn => form.button(btn.label, btn.icon));

    form.show(player).then(r => {
        if (r.canceled || r.selection === undefined) return;
        visibleButtons[r.selection].action(player);
    });
}