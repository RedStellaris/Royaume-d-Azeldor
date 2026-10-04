import { world } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import { PlayerMainMenu } from "./playerUi"
import * as H from "../general/helpers"

export function MainUi(player) {
    new ActionFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.player.menu.report' }] })
        .button({ rawtext: [{ translate: 'ui.player.report.bug' }] })
        .button({ rawtext: [{ translate: 'ui.player.report.player' }] })
        .button({ rawtext: [{ translate: "ui.button.back" }] }, "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled || r.selection === 2) return PlayerMainMenu(player);
            switch (r.selection) {
                case 0: reportBug(player); break;
                case 1: reportPlayer(player); break;
            }
        })
}

function reportBug(player) {
    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.player.report.bug' }] })
        .textField({ rawtext: [{ translate: 'ui.report.bug.title' }] }, 'ui.report.bug.textfield')
        .label({ rawtext: [{ translate: 'ui.report.maxchar' }] })
        .textField("", "")
        .textField("", "")
        .textField("", "")
        .show(player).then(r => {
            if (r.canceled) return MainUi(player);
            if (!r.formValues[0] || r.formValues[0] === "") return player.sendMessage('ui.report.invalidTitle');
            if (!r.formValues[2] && !r.formValues[3] && !r.formValues[4]) return player.sendMessage("ui.report.invalidReport");

            let report = "";
            report += (r.formValues[2] ?? "") + " ";
            report += (r.formValues[3] ?? "") + " ";
            report += (r.formValues[4] ?? "") + " ";
            
            const bugReportData = H.getData("bugReports", {});
            bugReportData[r.formValues[0]] = { report: report.trim(), date: H.getPSTString(), pId: player.id, pName: player.name };
            H.setData("bugReports", bugReportData);
        })
}

function reportPlayer(player) {
    const playerNames = world.getAllPlayers().map(p => p.name);

    new ModalFormData()
        .title({ rawtext: [{ text: H.customUi() }, { translate: 'ui.player.report.player' }] })
        .textField({ rawtext: [{ translate: 'ui.report.bug.title' }] }, 'ui.report.player.textfield')
        .dropdown({ rawtext: [{ translate: 'ui.report.player.select'}] }, playerNames)
        .label({ rawtext: [{ translate: 'ui.report.maxchar' }] })
        .textField("", "")
        .textField("", "")
        .textField("", "")
        .show(player).then(r => {
            if (r.canceled) return MainUi(player);
            if (!r.formValues[0] || r.formValues[0] === "") return player.sendMessage('ui.report.invalidTitle');
            if (!r.formValues[3] && !r.formValues[4] && !r.formValues[5]) return player.sendMessage("ui.report.invalidReport");

            let report = "";
            report += (r.formValues[3] ?? "") + " ";
            report += (r.formValues[4] ?? "") + " ";
            report += (r.formValues[5] ?? "") + " ";
            
            const bugReportData = H.getData("playerReports", {});
            const reportedPlayer = playerNames[r.formValues[1]]; 
            
            bugReportData[r.formValues[0]] = { rPlayer: reportedPlayer, report: report.trim(), date: H.getPSTString(), pId: player.id, pName: player.name };
            H.setData("playerReports", bugReportData);
        })
}