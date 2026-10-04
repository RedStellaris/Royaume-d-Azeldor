import { world } from "@minecraft/server"
import * as UI from "./mainUI"
import * as H from "./helpers"
import { PlayerMainMenu } from "../player/playerUi"

world.afterEvents.itemUse.subscribe(({itemStack, source}) => {
    if (itemStack.typeId != "sh:admin_menu") return;
    if (!H.isOp(source)) return source.sendMessage({ rawtext: [{ translate: 'general.incorrectPermission' }]});
    UI.CentralAdminMenu(source);
})

world.afterEvents.itemUse.subscribe(({itemStack, source}) => {
    if (itemStack.typeId != "sh:player_menu") return;
    if (!world.getDynamicProperty("pmenu")) {
        source.sendMessage({rawText: [{translate: "playerMenu.error.disabled"}]});
        source.runCommand("clear @s sh:player_menu");
        return;
    }
    PlayerMainMenu(source)
})