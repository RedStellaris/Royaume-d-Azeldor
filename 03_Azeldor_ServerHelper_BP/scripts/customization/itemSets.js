import { world, system, EquipmentSlot } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import * as H from "../general/helpers"
import { CustomizationMenu } from "./customizationUi"
import { helperMenu } from "../misc/helperMenu"

export function ItemSetMainMenu(player) {
    const form = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.itemsets.title" }] })
        .button({ rawtext: [{ translate: "ui.general.button.list" }] }, "textures/items/paper")
        .button({ rawtext: [{ translate: "ui.general.button.add" }] }, "textures/ui/color_plus")
        .button({ rawtext: [{ translate: "ui.general.button.remove" }] }, "textures/ui/realms_red_x")
        .button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 3) return H.isOp(player) ? CustomizationMenu(player) : helperMenu(player);
            switch (r.selection) {
                case 0: listSets(player); break;
                case 1: AddSetForm(player); break;
                case 2: RemoveSetForm(player); break;
            }
        })
}

function listSets(player) {
    const setData = H.getData("itemSets", {});
    const setIds = Object.keys(setData);

    if (setIds.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "message.itemsets.none_found" }] });
        return ItemSetMainMenu(player);
    }

    const rawtextParts = [
        { translate: "ui.general.list_header", with: ["Saved ItemSets"] }, 
        { text: "\n§r" }
    ];

    for (const setId of setIds) {
        const itemSet = setData[setId];
        rawtextParts.push({ translate: "message.itemsets.set_info", with: [setId, String(itemSet.items.length)] }, { text: "\n" });
        
        for (const item of itemSet.items) {
            const loc = item.location === "equipment" ? `Equip: ${item.slot}` : `Slot: ${item.slot}`;
            const cleanName = item.typeId.split(":")[1];
            
            rawtextParts.push({ translate: "message.itemsets.item_info", with: [String(item.amount), cleanName, loc] }, { text: "\n" });
            
            if (item.enchants) {
                const enchantCount = Object.keys(item.enchants).length;
                rawtextParts.push({ translate: "message.itemsets.enchant_info", with: [String(enchantCount)] }, { text: "\n" });
            }
        }
        rawtextParts.push({ text: "\n" });
    }

    player.sendMessage({ rawtext: rawtextParts });
    return ItemSetMainMenu(player);
}

function AddSetForm(player) {
    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.itemsets.title" }] })
        .textField(
            { rawtext: [{ translate: "form.itemsets.add.id_label" }] }, 
            { rawtext: [{ translate: "form.itemsets.add.id_placeholder" }] }
        )
        .show(player).then(r => {
            if (r.canceled) return ItemSetMainMenu(player);
            
            const itemSetId = r.formValues[0];
            if (!itemSetId) return player.sendMessage({ rawtext: [{ translate: "message.itemsets.invalid_id" }] });
            
            const playerInventory = captureInventory(player);
            const setData = H.getData("itemSets", {});
            
            setData[itemSetId] = playerInventory;
            H.setData("itemSets", setData);
            
            player.sendMessage({ rawtext: [{ translate: "message.itemsets.save_success", with: [itemSetId] }] });
            ItemSetMainMenu(player);
        });
}

function RemoveSetForm(player) {
    const setData = H.getData("itemSets", {});
    const setIds = Object.keys(setData);

    if (setIds.length === 0) {
        player.sendMessage({ rawtext: [{ translate: "message.itemsets.none_to_remove" }] });
        return ItemSetMainMenu(player);
    }

    const form = new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "form.itemsets.remove.title" }] })
        .dropdown({ rawtext: [{ translate: "form.itemsets.remove.dropdown_label" }] }, setIds)
        .show(player).then(r => {
            if (r.canceled) return ItemSetMainMenu(player);
            
            const targetId = setIds[r.formValues[0]];
            delete setData[targetId];
            
            H.setData("itemSets", setData);
            player.sendMessage({ rawtext: [{ translate: "message.itemsets.delete_success", with: [targetId] }] });
            ItemSetMainMenu(player);
        });
}

const MENUITEMS = [
    "sh:admin_menu",
    "sh:ah",
    "sh:bazaar",
    "sh:helper_menu",
    "sh:player_menu",
    "sh:shop",
    "sh:pv"
]

export function captureInventory(player) {
    const inventory = player.getComponent("minecraft:inventory").container;
    const equipment = player.getComponent("minecraft:equippable");
    const kitData = { items: [] };

    const processItem = (item, location, slot) => {
        if (!item || MENUITEMS.includes(item.typeId)) return;

        const itemEntry = {
            location,
            slot,
            typeId: item.typeId,
            amount: item.amount
        };
        if (item.typeId === "minecraft:arrow") {
            kitData.items.push(itemEntry);
            return;
        }

        const enchantable = item.getComponent("minecraft:enchantable");
        if (enchantable) {
            const enchants = enchantable.getEnchantments();
            if (enchants.length > 0) {
                itemEntry.enchants = {};
                enchants.forEach(e => {
                    itemEntry.enchants[e.type.id] = e.level;
                });
            }
        }

        const potionComp = item.getComponent("minecraft:potion");
        if (potionComp) {
            itemEntry.potion = potionComp.potionEffectType.id;
            itemEntry.delivery = potionComp.potionDeliveryType.id;
        }

        kitData.items.push(itemEntry);
    };

    for (let i = 0; i < inventory.size; i++) processItem(inventory.getItem(i), "slot", i);
    ["Head", "Chest", "Legs", "Feet", "Offhand"].forEach(s => {
        const slot = EquipmentSlot[s];
        if (slot) processItem(equipment.getEquipment(slot), "equipment", s);
    });

    return kitData;
}