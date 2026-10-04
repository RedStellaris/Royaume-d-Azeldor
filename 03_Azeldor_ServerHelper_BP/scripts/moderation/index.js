import "./antiDupe"
import "./bannedItems"
import viewEchestData from "./enderChestViewer"
import { playerInventoryView } from "./inventoryViewer"
import adminViewVault from "./vaultManage"
import ClaimManage from "./manageClaims"
import * as BanSystem from "./banSystem"
import * as FreezeSystem from "./freezeSystem"
import * as MuteSystem from "./muteSystem"
import * as SpySystem from "./spySystem"
import "./antiBundle"
import "./flyWarning"
import "./killAura"
import "./antiReach"

export const index = {
    adminViewVault,
    ClaimManage,
    SpySystem,
    MuteSystem,
    FreezeSystem,
    BanSystem,
    viewEchestData,
    playerInventoryView
}