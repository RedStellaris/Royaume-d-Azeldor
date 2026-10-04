import * as H from "../general/helpers"
import { ActionFormData, MessageFormData } from "@minecraft/server-ui"
import { VaultsMenu } from "./moderationUi"

export default async function adminViewVault(admin, target) {
    if (!admin.isValid || !target.isValid) return; 

    const rawData = target.getDynamicProperty("pv_items");
    let allItems = [];

    if (rawData) {
        try { allItems = JSON.parse(rawData); } catch {}
    }
    const activeItems = [];
    for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        if (item && item.typeId) {
            activeItems.push({ ...item, originalIndex: i });
        }
    }

    const menu = new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.vault.title', with: [target.name] }] });

    if (activeItems.length === 0) {
        menu.body({ rawtext: [{ translate: 'ui.vault.empty' }] });
    } else {
        menu.body({ rawtext: [{ translate: 'ui.vault.body', with: [String(activeItems.length)] }] });
    }

    for (const item of activeItems) {
        const cleanId = item.typeId.split(":")[1] || item.typeId;
        const itemName = cleanId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        const page = Math.floor(item.originalIndex / 54) + 1;
        
        menu.button({ rawtext: [{ translate: 'ui.vault.item_button', with: [itemName, String(item.amount), String(page)] }] }, `textures/items/${cleanId}`);
    }

    menu.button({ rawtext: [{ translate: 'ui.button.back' }] }, "textures/ui/cancel");
    const r = await menu.show(admin);
    
    if (r.canceled || r.selection === activeItems.length) {
        return VaultsMenu(admin);
    }

    const selectedItem = activeItems[r.selection];

    const confirmMenu = new MessageFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.vault.confirm.title' }] })
        .body({ rawtext: [{ translate: 'ui.vault.confirm.body', with: [selectedItem.typeId, target.name] }] })
        .button1({ rawtext: [{ translate: 'ui.button.confirm' }] })
        .button2({ rawtext: [{ translate: 'ui.button.cancel' }] });

    const res = await confirmMenu.show(admin);

    if (!admin.isValid || !target.isValid) return;

    if (!res.canceled && res.selection === 0) { 
        allItems[selectedItem.originalIndex] = null;
        target.setDynamicProperty("pv_items", JSON.stringify(allItems));
        admin.sendMessage({ translate: 'message.vault.removed' });
    }
    
    adminViewVault(admin, target);
}