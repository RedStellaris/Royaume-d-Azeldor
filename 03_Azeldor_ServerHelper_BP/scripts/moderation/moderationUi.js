import * as H from "../general/helpers";
import { CentralAdminMenu } from "../general/mainUI";
import { index } from "./index";
import { helperMenu } from "../misc/helperMenu"

const ClaimManage = index.ClaimManage

const AntiDupeMenu = H.LARActionForm({
    title: "ui.antidupe.title", property: "tracked_items", type: "Item", backCallback: (admin) => {
        if (H.isOp(admin)) {
            ModerationMenu(admin)
        } else helperMenu(admin);
    }, listFormatter: (id, quantity) => { return `§7${id} §8| §fAmount: §a${quantity}`; }
});

const InventoryView = H.TargetActionForm("ui.inventory.title", index.playerInventoryView, undefined, (admin) => {
    if (H.isOp(admin)) {
        ModerationMenu(admin)
    } else helperMenu(admin);
});
const EchestView = H.TargetActionForm("ui.echestselect.title", index.viewEchestData, undefined, (admin) => {
    if (H.isOp(admin)) {
        ModerationMenu(admin)
    } else helperMenu(admin);
});
const BanStatusMenu = H.ActionFormHub("ui.ban.status.title", [
    { name: "ui.ban.status.online", form: index.BanSystem.BanPlayerOnline, texture: "textures/ui/Friend2" },
    { name: "ui.ban.status.offline", form: index.BanSystem.BanPlayerOffline, texture: "textures/ui/icon_multiplayer" }
], (admin) => BanMenu(admin));
const BanMenu = H.ActionFormHub("ui.ban.title", [
    { name: "ui.ban.button.ban", form: BanStatusMenu, texture: "textures/menutextures/barrier" },
    { name: "ui.ban.button.unban", form: index.BanSystem.UnbanPlayerOffline, texture: "textures/menutextures/greenbarrier" }
], (admin) => {
    if (H.isOp(admin)) {
        ModerationMenu(admin)
    } else helperMenu(admin);
});
const FreezeSelect = H.TargetActionForm("ui.freeze.select.freeze", (admin, target) => index.FreezeSystem.freezePlayer(admin, target), undefined, (p) => FreezeMenu(p));
const UnfreezeSelect = H.TargetActionForm("ui.freeze.select.unfreeze", (admin, target) => index.FreezeSystem.unfreezePlayer(admin, target), (t) => t.hasTag("frozen"), (p) => FreezeMenu(p));
const FreezeMenu = H.ActionFormHub("ui.freeze.title", [
    { name: "ui.freeze.button.freeze", form: FreezeSelect, texture: "textures/menutextures/freeze" },
    { name: "ui.freeze.button.unfreeze", form: UnfreezeSelect, texture: "textures/items/campfire" }
], (admin) => {
    if (H.isOp(admin)) {
        ModerationMenu(admin)
    } else helperMenu(admin);
});
const MuteSelect = H.TargetActionForm("ui.mute.title", (admin, target) => index.MuteSystem.mutePlayer(admin, target), undefined, (p) => MuteMenu(p));
const UnmuteSelect = H.TargetActionForm("ui.unmute.title", (admin, target) => index.MuteSystem.unmutePlayer(admin, target), (t) => t.hasTag("muted"), (p) => MuteMenu(p));
const MuteMenu = H.ActionFormHub("ui.mute.title", [
    { name: "ui.mute.button.mute", form: MuteSelect, texture: "textures/menutextures/speaker_mute" },
    { name: "ui.mute.button.unmute", form: UnmuteSelect, texture: "textures/menutextures/speaker" }
], (admin) => {
    if (H.isOp(admin)) {
        ModerationMenu(admin)
    } else helperMenu(admin);
});
const SpySelect = H.TargetActionForm('ui.spy.select.follow', (admin, target) => index.SpySystem.spy(admin, target.name), undefined, undefined);
const SpyMenu = H.ActionFormHub('ui.spy.menu.title', [
    { name: 'ui.spy.menu.view_data', form: index.SpySystem.SpyData, texture: "textures/items/map_filled" },
    { name: 'ui.spy.menu.follow', form: SpySelect, texture: "textures/items/ender_eye" }
], (admin) => {
    if (H.isOp(admin)) {
        ModerationMenu(admin)
    } else helperMenu(admin);
});
const ItemBanMenu = H.LARActionForm({
    title: "ui.itemban.title", property: "banned_items", type: "Item", backCallback: (admin) => {
        if (H.isOp(admin)) {
            ModerationMenu(admin)
        } else helperMenu(admin);
    }, requireAmount: false, listFormatter: (id) => { return `${id}` }
});
const VaultsMenu = H.TargetActionForm('ui.vaultViewMenu.title', (admin, target) => index.adminViewVault(admin, target), undefined, (admin) => {
    if (H.isOp(admin)) {
        ModerationMenu(admin)
    } else helperMenu(admin);
});
const BannedWordsMenu = H.LARActionForm({
    title: 'ui.bannedWords.title', property: "banned_words", type: "word", backCallback: (admin) => {
        if (H.isOp(admin)) {
            ModerationMenu(admin)
        } else helperMenu(admin);
    }, fields: [
        {
            type: "textfield",
            text: "ui.bannedWords.field.word",
            subtext: "ui.bannedWords.field.word.subtext",
            attribute: "word",
            isKey: true
        },
        {
            type: "textfield",
            text: "ui.bannedWords.field.threshold",
            subtext: "ui.bannedWords.field.threshold.subtext",
            attribute: "threshold"
        }
    ], listFormatter: (id) => { return `${id}` }
})

export const ModerationMenu = H.ActionFormHub("ui.moderation.title", [
    { name: 'ui.moderation.button.antidupe', form: AntiDupeMenu, texture: "textures/items/diamond" },
    { name: 'ui.moderation.button.inventory', form: InventoryView, texture: "textures/menutextures/chest" },
    { name: 'ui.moderation.button.enderchests', form: EchestView, texture: "textures/menutextures/echest" },
    { name: 'ui.moderation.button.ban', form: BanMenu, texture: "textures/menutextures/barrier" },
    { name: 'ui.moderation.button.freeze', form: FreezeMenu, texture: "textures/menutextures/freeze" },
    { name: 'ui.moderation.button.mute', form: MuteMenu, texture: "textures/menutextures/speaker_mute" },
    { name: 'ui.moderation.button.spy', form: SpyMenu, texture: "textures/items/spyglass" },
    { name: 'ui.moderation.button.itemban', form: ItemBanMenu, texture: "textures/items/nether_star" },
    { name: 'ui.moderation.button.claims', form: ClaimManage, texture: "textures/items/painting" },
    { name: 'ui.moderation.button.vaults', form: VaultsMenu, texture: "textures/ui/World" },
    { name: 'ui.moderation.button.bannedwords', form: BannedWordsMenu, texture: "textures/items/book_writable" }
], (player) => CentralAdminMenu(player));

export { AntiDupeMenu, InventoryView, EchestView, BanStatusMenu, BanMenu, FreezeSelect, UnfreezeSelect, FreezeMenu, MuteSelect, UnmuteSelect, MuteMenu, SpySelect, SpyMenu, ItemBanMenu, VaultsMenu, BannedWordsMenu, ClaimManage };