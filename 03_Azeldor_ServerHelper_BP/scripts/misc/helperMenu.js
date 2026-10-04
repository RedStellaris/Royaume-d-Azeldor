import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CentralAdminMenu, togglesMenu, settingsMenu } from "../general/mainUI";
import * as modUi from "../moderation/moderationUi";
import * as custUi from "../customization/customizationUi";
import * as H from "../general/helpers"

const ALL_ITEMS = [
    { id: "dupe", label: { rawtext: [{ translate: "form.helper.button.dupe" }] }, icon: "textures/items/diamond" },
    { id: "inventory", label: { rawtext: [{ translate: "form.helper.button.inventory" }] }, icon: "textures/menutextures/chest" },
    { id: "echest", label: { rawtext: [{ translate: "form.helper.button.echest" }] }, icon: "textures/menutextures/echest" },
    { id: "ban", label: { rawtext: [{ translate: "form.helper.button.ban" }] }, icon: "textures/menutextures/barrier" },
    { id: "freeze", label: { rawtext: [{ translate: "form.helper.button.freeze" }] }, icon: "textures/menutextures/freeze" },
    { id: "mute", label: { rawtext: [{ translate: "form.helper.button.mute" }] }, icon: "textures/menutextures/speaker_mute" },
    { id: "spy", label: { rawtext: [{ translate: "form.helper.button.spy" }] }, icon: "textures/items/spyglass" },
    { id: "itemban", label: { rawtext: [{ translate: "form.helper.button.itemban" }] }, icon: "textures/items/nether_star" },
    { id: "manageclaims", label: { rawtext: [{ translate: "form.helper.button.manageclaims" }] }, icon: "textures/items/painting" },
    { id: "vaults", label: { rawtext: [{ translate: "form.helper.button.vaults" }] }, icon: "textures/ui/World" },
    { id: "economy", label: { rawtext: [{ translate: "form.helper.button.helper_economy" }] }, icon: "textures/menutextures/shop" }, 
    { id: "adminClaim", label: { rawtext: [{ translate: "form.helper.button.adminClaim" }] }, icon: "textures/items/painting" },
    { id: "holograms", label: { rawtext: [{ translate: "form.helper.button.holograms" }] }, icon: "textures/items/name_tag" },
    { id: "spawners", label: { rawtext: [{ translate: "form.helper.button.spawners" }] }, icon: "textures/items/spawn_egg" },
    { id: "warps", label: { rawtext: [{ translate: "form.helper.button.warps" }] }, icon: "textures/items/ender_pearl" },
    { id: "crates", label: { rawtext: [{ translate: "form.helper.button.crates" }] }, icon: "textures/ui/inventory_icon" },
    { id: "chatTags", label: { rawtext: [{ translate: "form.helper.button.chatTags" }] }, icon: "textures/menutextures/chatbubble" },
    { id: "trade", label: { rawtext: [{ translate: "form.helper.button.trade" }] }, icon: "textures/ui/MCoin" },
    { id: "broadcast", label: { rawtext: [{ translate: "form.helper.button.broadcast" }] }, icon: "textures/menutextures/speaker" },
    { id: "mobSpawn", label: { rawtext: [{ translate: "form.helper.button.mobSpawn" }] }, icon: "textures/items/egg" },
    { id: "bounties", label: { rawtext: [{ translate: "form.helper.button.bounties" }] }, icon: "textures/items/iron_sword" },
    { id: "toggles", label: { rawtext: [{ translate: "form.helper.button.toggles" }] }, icon: "textures/menutextures/switch" },
    { id: "settings", label: { rawtext: [{ translate: "form.helper.button.settings" }] }, icon: "textures/items/redstone_dust" }
];

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    if (event.itemStack.typeId !== "sh:helper_menu") return;
    
    if (!player.hasTag("helper") && !H.isOp(player)) {
        return player.sendMessage({ rawtext: [{ translate: "message.helper.no_permission" }] });
    }
    
    if (!world.getDynamicProperty("helper")) {
        return player.sendMessage({ rawtext: [{ translate: "message.helper.disabled" }] });
    }

    helperMenu(player);
});

export function helperMenu(player) {
    const allowedItems = ALL_ITEMS.filter(item => world.getDynamicProperty(item.id) === true);
    const isAdmin = player.hasTag("admin");

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "form.helper.title" }] });

    if (allowedItems.length === 0) {
        menu.button({ rawtext: [{ translate: "form.helper.button.noperms" }] });
    } else {
        allowedItems.forEach(item => menu.button(item.label, item.icon));
    }

    if (isAdmin) {
        menu.button({ rawtext: [{ text: "§cBack to Admin Menu" }] }, "textures/ui/cancel");
    }

    menu.show(player).then(r => {
        if (r.canceled) return;

        if (!player.isValid) return;

        const adminButtonIndex = allowedItems.length === 0 ? 1 : allowedItems.length;

        if (isAdmin && r.selection === adminButtonIndex) {
            return CentralAdminMenu(player); 
        }

        if (allowedItems.length === 0) return;

        const selected = allowedItems[r.selection];
        if (!selected) return;

        switch (selected.id) {
            case "dupe": modUi.AntiDupeMenu(player); break;
            case "inventory": modUi.InventoryView(player); break;
            case "echest": modUi.EchestView(player); break;
            case "ban": modUi.BanMenu(player); break;
            case "freeze": modUi.FreezeMenu(player); break;
            case "mute": modUi.MuteMenu(player); break;
            case "spy": modUi.SpyMenu(player); break;
            case "itemban": modUi.ItemBanMenu(player); break;
            case "manageclaims": modUi.ClaimManage(player); break;
            case "vaults": modUi.VaultsMenu(player); break;
            case "economy": custUi.EconMenu(player); break;
            case "adminClaim": custUi.AdminClaimMenu(player); break;
            case "holograms": custUi.HologramMenu(player); break;
            case "spawners": custUi.SpawnersMenu(player); break;
            case "warps": custUi.WarpsMenu(player); break;
            case "crates": custUi.CratesMenu(player); break;
            case "chatTags": custUi.ChatTagsMenu(player); break;
            case "trade": custUi.TradeMenu(player); break;
            case "broadcast": custUi.BroadcastMenu(player); break;
            case "mobSpawn": custUi.MobSpawningMenu(player); break;
            case "bounties": custUi.BountyMenu(player); break;
            case "toggles": togglesMenu(player); break;
            case "settings": settingsMenu(player); break;
        }
    });
}