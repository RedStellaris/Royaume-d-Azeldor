import * as H from "../general/helpers";
import { CentralAdminMenu } from "../general/mainUI";
import { index } from "./index";
import { helperMenu } from "../misc/helperMenu"
import { questsMenu } from "./questSystem"

const BountyMenu = (p) => index.BountySystem.bountyMenu(p);
const ItemSetsMenu = (p) => index.ItemSetSystem.ItemSetMainMenu(p);

const EconMenu = H.ActionFormHub("ui.economy.title", [
    { name: "ui.economy.editBuy", form: (player) => index.EconSystem.manageShopCategory(player, "buyshop_items"), texture: "textures/ui/color_plus" },
    { name: "ui.economy.editSell", form: (player) => index.EconSystem.manageShopCategory(player, "sellshop_items"), texture: "textures/ui/color_plus" },
    { name: "ui.economy.balances", form: (player) => index.EconSystem.viewableBalances(player), texture: "textures/ui/inventory_icon" },
    { name: "ui.economy.load", form: (player) => index.EconSystem.confirmPreMadeShop(player), texture: "textures/ui/copy" },
    { name: "ui.economy.clear", form: (player) => index.EconSystem.clearShopPrompt(player), texture: "textures/ui/trash" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
});

const AdminClaimMenu = H.ActionFormHub("ui.adminClaim.title", [
    { name: "ui.adminClaim.new", form: (player) => index.AdminClaimSystem.startClaim(player), texture: "textures/ui/color_plus" },
    { name: "ui.adminClaim.manage", form: (player) => index.AdminClaimSystem.adminListClaims(player), texture: "textures/items/paper" },
    { name: "ui.adminClaim.allowArea", form: (player) => AllowAreaMenu(player), texture: "textures/ui/gear" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
});

const AllowAreaMenu = H.ActionFormHub("ui.allowArea.title", [
    { name: "ui.allowArea.new", form: (player) => index.AdminClaimSystem.startAllowArea(player), texture: "textures/ui/color_plus" },
    { name: "ui.allowArea.manage", form: (player) => index.AdminClaimSystem.adminListAllowAreas(player), texture: "textures/items/paper" }
], (admin) => AdminClaimMenu(admin));

const HologramMenu = H.ActionFormHub("ui.hologram.title", [
    { name: "ui.hologram.newholo", form: (player) => index.HologramSystem.addHologram(player), texture: "textures/ui/color_plus" },
    { name: "ui.hologram.newleader", form: (player) => index.HologramSystem.addleaderboard(player), texture: "textures/ui/color_plus" },
    { name: "ui.hologram.list", form: (player) => index.HologramSystem.listHolograms(player), texture: "textures/items/paper" },
    { name: "ui.hologram.remove", form: (player) => index.HologramSystem.removeHologram(player), texture: "textures/ui/realms_red_x" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
});

const SpawnersMenu = H.LARActionForm({
    title: "ui.spawners.title",
    property: "spawners",
    type: "Spawner",
    backCallback: (admin) => {
        if (H.isOp(admin)) {
            CustomizationMenu(admin)
        } else helperMenu(admin);
    },
    fields: [
        {
            type: "textfield",
            text: "ui.spawners.mob_id",
            subtext: "ui.spawners.mob_id.subtext",
            attribute: "mob",
            isKey: true
        },
        {
            type: "dropdown",
            text: "ui.spawners.scoreboard",
            options: () => H.getScoreboardList(),
            attribute: "scoreboard"
        },
        {
            type: "textfield",
            text: "ui.spawners.cost",
            subtext: "ui.spawners.cost.subtext",
            attribute: "cost",
            valueType: "number"
        },
        {
            type: "textfield",
            text: "ui.spawners.texture",
            subtext: "ui.spawners.texture.subtext",
            attribute: "texture"
        }
    ],
    listFormatter: (id, data) => {
        return `§7${id} §8| §fCost: §a$${data.cost} §8| §fScoreboard: §e${data.scoreboard}`;
    }
});

const WarpsMenu = H.ActionFormHub("ui.warps.title", [
    { name: 'ui.general.button.list', form: (p) => index.WarpSystem.listWarps(p), texture: "textures/items/paper" },
    { name: "ui.general.button.add", form: (p) => index.WarpSystem.addWarp(p), texture: "textures/ui/color_plus" },
    { name: "ui.general.button.remove", form: (p) => index.WarpSystem.removeWarp(p), texture: "textures/ui/realms_red_x" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
})

const CratesMenu = H.ActionFormHub("ui.crates.title", [
    { name: "ui.general.button.add", form: (p) => index.CrateSystem.addCrate(p), texture: "textures/ui/color_plus" },
    { name: "ui.crates.physical", form: (p) => index.CrateSystem.physicalCrate(p), texture: "textures/ui/color_plus" },
    { name: "ui.crates.edit", form: (p) => index.CrateSystem.editCrates(p), texture: "textures/ui/gear" },
    { name: "ui.general.button.list", form: (p) => index.CrateSystem.listCrates(p), texture: "textures/items/paper" },
    { name: "ui.general.button.remove", form: (p) => index.CrateSystem.removeCrate(p), texture: "textures/ui/realms_red_x" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
})

const ChatTagsMenu = H.LARActionForm({
    title: "ui.chatTags.title", property: "chat_tags", type: "Rank", backCallback: (admin) => {
        if (H.isOp(admin)) {
            CustomizationMenu(admin)
        } else helperMenu(admin);
    }, fields: [
        {
            type: "textfield",
            text: "ui.chatTags.tag",
            subtext: "ui.chatTags.tag.subtext",
            attribute: "tag",
            isKey: true
        },
        {
            type: "textfield",
            text: "ui.chatTags.display",
            subtext: "ui.chatTags.display.subtext",
            attribute: "display"
        }
    ], listFormatter: (id, data) => {
        return `§7${id} | §r${data.display}`;
    }
})

const TradeMenu = H.LARActionForm({
    title: "ui.trade.title", property: "tradeables", type: "Currency", backCallback: (admin) => {
        if (H.isOp(admin)) {
            CustomizationMenu(admin)
        } else helperMenu(admin);
    }, fields: [
        {
            type: "dropdown",
            text: "ui.trade.scoreboard",
            options: () => H.getScoreboardList(),
            attribute: "scoreboard",
            isKey: true
        }
    ], listFormatter: (id) => {
        return `§f${id}`;
    }
})

const BroadcastMenu = H.LARActionForm({
    title: "ui.broadcast.title", property: "broadcasts", type: "Message", backCallback: (admin) => {
        if (H.isOp(admin)) {
            CustomizationMenu(admin)
        } else helperMenu(admin);
    }, fields: [
        {
            type: "textfield",
            text: "ui.broadcast.id",
            subtext: "ui.broadcast.id.subtext",
            attribute: "id",
            isKey: true
        },
        {
            type: "textfield",
            text: "ui.broadcast.msg",
            subtext: "ui.broadcast.msg.subtext",
            attribute: "msg"
        },
        {
            type: "textfield",
            valueType: "number",
            text: "ui.broadcast.interval",
            subtext: "ui.broadcast.interval.subtext",
            attribute: "interval"
        }
    ], listFormatter: (id, data) => {
        return `§f${id} | ${data.interval}(s)`;
    }
})

const MobSpawningMenu = H.LARActionForm({
    title: "ui.mobSpawning.title", property: "mobs", type: "Mob", backCallback: (admin) => {
        if (H.isOp(admin)) {
            CustomizationMenu(admin)
        } else helperMenu(admin);
    }, fields: [
        {
            type: "textfield",
            text: "ui.mobSpawning.mob_id",
            subtext: "ui.mobSpawning.mob_id.subtext",
            attribute: "mob",
            isKey: true
        }
    ], listFormatter: (id) => {
        return `§f${id}`;
    }
})

const DeathManager = H.ActionFormHub('ui.death.title', [
    { name: 'ui.death.button.particles', form: (p) => index.DeathSystem.deathSubMenu(p, "death_particle", 'death.label.particles'), texture: "textures/items/blaze_powder" },
    { name: 'ui.death.button.sounds', form: (p) => index.DeathSystem.deathSubMenu(p, "death_sound", 'death.label.sounds'), texture: "textures/items/record_13" },
    { name: 'ui.death.button.attacker_cmds', form: (p) => index.DeathSystem.deathSubMenu(p, "attacker_command", 'death.label.attacker_cmds'), texture: "textures/items/diamond_sword" },
    { name: 'ui.death.button.victim_cmds', form: (p) => index.DeathSystem.deathSubMenu(p, "deadEntity_command", 'death.label.victim_cmds'), texture: "textures/items/iron_sword" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
})

const CodeMenuHub = H.ActionFormHub("ui.codesHub.title", [
    { name: 'ui.codes.new', form: (p) => NewCodeMenu(p), texture: "textures/ui/color_plus" },
    { name: "ui.codes.edit", form: (p) => index.CodeSystem.manageCodesList(p), texture: "textures/items/paper" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
})

const NewCodeMenu = H.LARActionForm({
    title: "ui.newcode.title", property: "redeem_codes", type: "Code", backCallback: (admin) => {
        if (H.isOp(admin)) {
            CustomizationMenu(admin)
        } else helperMenu(admin);
    }, fields: [
        {
            type: "textfield",
            text: "ui.newcode.code",
            subtext: "ui.newcode.code.subtext",
            attribute: "code",
            isKey: true
        }
    ], listFormatter: (id) => {
        return `§f${id}`;
    }
})

const NPCMenu = H.ActionFormHub("ui.npcs.title", [
    { name: 'ui.general.button.list', form: (p) => index.NPCSystem.ListMenuNPCs(p), texture: "textures/items/paper" },
    { name: "ui.general.button.add", form: (p) => index.NPCSystem.AddMenuNPC(p), texture: "textures/ui/color_plus" },
    { name: "ui.general.button.remove", form: (p) => index.NPCSystem.RemoveMenuNPC(p), texture: "textures/ui/realms_red_x" }
], (admin) => {
    if (H.isOp(admin)) {
        CustomizationMenu(admin)
    } else helperMenu(admin);
})

export const CustomizationMenu = H.ActionFormHub("ui.custom.title", [
    { name: "ui.economy.title", form: EconMenu, texture: "textures/menutextures/shop" },
    { name: "ui.adminClaim.title", form: AdminClaimMenu, texture: "textures/items/painting" },
    { name: "ui.hologram.title", form: HologramMenu, texture: "textures/items/name_tag" },
    { name: "ui.spawners.title", form: SpawnersMenu, texture: "textures/items/spawn_egg" },
    { name: "ui.quests.title", form: (p) => questsMenu(p), texture: "textures/items/fishing_rod_uncast" },
    { name: "ui.warps.title", form: WarpsMenu, texture: "textures/items/ender_pearl" },
    { name: "ui.crates.title", form: CratesMenu, texture: "textures/ui/inventory_icon" },
    { name: 'ui.customTags.title', form: ChatTagsMenu, texture: "textures/menutextures/chatbubble" },
    { name: 'ui.trade.title', form: TradeMenu, texture: "textures/ui/MCoin" },
    { name: 'ui.broadcast.title', form: BroadcastMenu, texture: "textures/menutextures/speaker" },
    { name: 'ui.mobSpawning.title', form: MobSpawningMenu, texture: "textures/items/egg" },
    { name: 'ui.bounty.title', form: BountyMenu, texture: "textures/items/iron_sword" },
    { name: 'ui.death.title', form: DeathManager, texture: "textures/items/diamond_sword" },
    { name: 'ui.newcode.title', form: CodeMenuHub, texture: "textures/ui/book_addtextpage_default" },
    { name: 'ui.itemsets.title', form: ItemSetsMenu, texture: "textures/items/bundle" },
    { name: "ui.npcs.title", form: NPCMenu, texture: "textures/ui/icon_multiplayer"}
], CentralAdminMenu);

export { EconMenu, AdminClaimMenu, AllowAreaMenu, HologramMenu, SpawnersMenu, WarpsMenu, CratesMenu, ChatTagsMenu, TradeMenu, BroadcastMenu, MobSpawningMenu, BountyMenu, DeathManager, CodeMenuHub, NPCMenu };