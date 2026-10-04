import { system, world } from "@minecraft/server"
import * as H from "../general/helpers"

system.runInterval(() => {
    const broadcasts = H.getData("broadcasts");
    const currentTime = Date.now();
    let needsSaving = false;

    for (const id in broadcasts) {
        const data = broadcasts[id];
        if (!data.lastSent) {
            data.lastSent = currentTime;
            needsSaving = true;
            continue;
        }
        if ((currentTime - data.lastSent) / 1000 >= data.interval) {
            world.sendMessage(data.msg);
            data.lastSent = currentTime;
            needsSaving = true;
        }
    }
    if (needsSaving) H.setData("broadcasts", broadcasts);
}, 20);