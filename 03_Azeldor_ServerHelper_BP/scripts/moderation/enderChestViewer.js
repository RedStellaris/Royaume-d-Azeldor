import { world, system, ItemTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ModerationMenu } from "./moderationUi";
import * as H from "../general/helpers";

export default function viewEchestData(admin, target) {
    let content = { rawtext: [] };
    let found = false;

    for (let i = 0; i < 27; i++) {
        const data = target.getDynamicProperty(`echest_slot${i}`);

        if (data && data.includes("|")) {
            const [id, qty] = data.split("|");
            const shortId = id.includes(":") ? id.split(":")[1] : id;

            content.rawtext.push(
                { translate: "ui.echest.item_format", with: [shortId.replace(/_/g, " "), String(qty)] },
                { text: "\n" }
            );
            found = true;
        }
    }

    if (found) {
        content.rawtext.pop();
    }

    const bodyContent = found ? content : { rawtext: [{ translate: "ui.echest.empty" }] };

    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: "ui.echest.title", with: [target.name] }] })
        .body(bodyContent)
        .button({ rawtext: [{ translate: "ui.general.button.back" }] }, "textures/ui/back")
        .show(admin).then((res) => {
            if (res.canceled) return;
            H.TargetActionForm("ui.echest.title", viewEchestData, ModerationMenu);
        });
}

function getItemQuantity(player, itemId) {
    let low = 1, high = 1728, count = 0;

    try {
        player.runCommand(`tag @s[hasitem={item=${itemId},location=slot.enderchest,quantity=1..}] add sh_check`);
    } catch { }

    if (!player.hasTag("sh_check")) return 0;

    try { player.runCommand(`tag @s remove sh_check`); } catch { }

    while (low <= high) {
        let mid = Math.floor((low + high) / 2);

        try {
            player.runCommand(`tag @s[hasitem={item=${itemId},location=slot.enderchest,quantity=${mid}..}] add sh_check`);
        } catch { }

        if (player.hasTag("sh_check")) {
            count = mid;
            low = mid + 1;
            try { player.runCommand(`tag @s remove sh_check`); } catch { }
        } else {
            high = mid - 1;
        }
    }
    return count;
}

function* scanEchestTask(player) {
    if (!player.isValid) return;

    for (let i = 0; i < 27; i++) {
        player.setDynamicProperty(`echest_slot${i}`, undefined);
    }

    const allTypes = ItemTypes.getAll();
    let slot = 0;
    let checksThisTick = 0;

    for (const type of allTypes) {
        if (!player.isValid) break;
        if (slot >= 27) break;

        const qty = getItemQuantity(player, type.id);
        if (qty > 0) {
            player.setDynamicProperty(`echest_slot${slot}`, `${type.id}|${qty}`);
            slot++;
        }
        checksThisTick++;
        if (checksThisTick >= 25) {
            checksThisTick = 0;
            yield;
        }
    }
}

world.afterEvents.playerInteractWithBlock.subscribe(event => {
    const { player, block } = event;
    if (block.typeId !== "minecraft:ender_chest") return;
    system.runJob(scanEchestTask(player));
});