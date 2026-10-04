import {Dimension, MinecraftDimensionTypes, system, world} from '@minecraft/server'
system.runInterval(()=>{
    let dimensions = [MinecraftDimensionTypes.overworld, MinecraftDimensionTypes.nether, MinecraftDimensionTypes.theEnd]
    for(let dimension of dimensions){
        const npcEntities = world.getDimension(dimension).getEntities({families:["npc"]})
        for(let npc of npcEntities){
            if(npc.hasTag("adjustNameVisibility")){
                const nearbyPlayer = world.getDimension(dimension).getEntities({type:"minecraft:player", maxDistance: 6, location:npc.location})
                if(nearbyPlayer.length >= 1){
                    if(!npc.hasTag("nameVisibleTrue")){
                        npc.addTag("nameVisibleTrue")
                    }
                    if(npc.hasTag("nameVisibleFalse")){
                        npc.removeTag("nameVisibleFalse")
                    }
                }else{
                    if(!npc.hasTag("nameVisibleFalse")){
                        npc.addTag("nameVisibleFalse")
                    }
                    if(npc.hasTag("nameVisibleTrue")){
                        npc.removeTag("nameVisibleTrue")
                    }
                }
            }else{
                if(npc.hasTag("nameVisibleFalse") || npc.hasTag("nameVisibleTrue")){
                    npc.removeTag("nameVisibleFalse")
                    npc.removeTag("nameVisibleTrue")
                }
            }
        }
    }
},10)
