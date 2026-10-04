import { world } from "@minecraft/server"
import * as H from "../general/helpers"

world.afterEvents.entitySpawn.subscribe((event) => {
    const { entity } = event;
    const mobs = H.getData("mobs");
    try {
        if (mobs[entity.typeId]) {
            entity.remove();
        }
    } catch (err) { }
});