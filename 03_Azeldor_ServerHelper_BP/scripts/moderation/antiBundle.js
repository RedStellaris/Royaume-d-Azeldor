import { system, world } from '@minecraft/server';
import * as H from "../general/helpers"

const blocks = ["minecraft:hopper", "minecraft:dispenser", "minecraft:dropper"];
const RADIUS = 5;

function getSafeSpawnLocation(dim, block) {
    const loc = block.location;
    const offsets = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 }
    ];

    for (const offset of offsets) {
        const checkPos = { x: Math.floor(loc.x) + offset.x, y: Math.floor(loc.y) + offset.y, z: Math.floor(loc.z) + offset.z };
        try {
            const checkBlock = dim.getBlock(checkPos);
            if (checkBlock && (checkBlock.isAir || checkBlock.typeId === "minecraft:air")) {
                return { x: checkPos.x + 0.5, y: checkPos.y + 0.2, z: checkPos.z + 0.5 };
            }
        } catch (e) { }
    }
    return { x: loc.x + 0.5, y: loc.y + 1.2, z: loc.z + 0.5 };
}

system.runInterval(() => {
    if (!world.getDynamicProperty("antiBundle")) return;
    for (const player of world.getAllPlayers()) {
        if (!player.isValid) continue;

        const dim = player.dimension;
        const pos = player.location;
        
        const centerX = Math.floor(pos.x);
        const centerY = Math.floor(pos.y);
        const centerZ = Math.floor(pos.z);

        let foundCount = 0;

        for (let x = -RADIUS; x <= RADIUS; x++) {
            for (let y = -RADIUS; y <= RADIUS; y++) {
                for (let z = -RADIUS; z <= RADIUS; z++) {
                    const targetPos = { x: centerX + x, y: centerY + y, z: centerZ + z };
                    
                    try {
                        const block = dim.getBlock(targetPos);
                        
                        if (!block) continue;

                        if (blocks.includes(block.typeId)) {
                            foundCount++;
                            
                            const invComp = block.getComponent("minecraft:inventory");
                            if (!invComp || !invComp.container) {
                                continue;
                            }

                            const container = invComp.container;
                            for (let slot = 0; slot < container.size; slot++) {
                                const item = container.getItem(slot);
                                
                                if (item && item.typeId.includes("bundle")) {
                                    const spawnPos = getSafeSpawnLocation(dim, block);
                                    dim.spawnItem(item, spawnPos);
                                    container.setItem(slot, undefined);
                                    H.addLog("Bundle", { loc: block.location });
                                }
                            }
                        }
                    } catch (err) {
                    }
                }
            }
        }
        
        if (foundCount === 0) {
        }
    }
}, 20);