import { world, Player, ItemStack } from "@minecraft/server"

world.afterEvents.entityDie.subscribe((event) => {
    if (!world.getDynamicProperty("playerheads")) return;
    if (!(event.deadEntity instanceof Player)) return;
    if (!(event.damageSource.damagingEntity instanceof Player)) return;
    const item = new ItemStack("minecraft:player_head", 1)
    item.setLore([event.deadEntity.name])
    event.deadEntity.dimension.spawnItem(item, event.deadEntity.location)
})