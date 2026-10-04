import { world, system, CustomCommandParamType, BlockTypes, EquipmentSlot } from "@minecraft/server";
import { registerCommand } from "../commandRegister";
import * as H from "../general/helpers";

const MAX_TIME = 604800;
const CATEGORY_KEYS = ["ah_blocks", "ah_tools", "ah_armor", "ah_consumables", "ah_misc", "ah_modded"];

const stripCodes = (str) => str ? str.replace(/§[0-9a-fk-or]/gi, "") : "";

function determineCategory(typeId) {
    if (!typeId.startsWith("minecraft:")) return "ah_modded";
    const id = typeId.toLowerCase();
    const toolKeywords = ["sword", "pickaxe", "shovel", "hoe", "axe", "shears", "fishing_rod", "brush", "flint_and_steel", "compass", "clock", "bow", "trident", "mace", "spyglass"];
    if (toolKeywords.some(k => id.includes(k))) return "ah_tools";
    const armorKeywords = ["helmet", "chestplate", "leggings", "boots", "shield", "elytra"];
    if (armorKeywords.some(k => id.includes(k))) return "ah_armor";
    const foodKeywords = ["apple", "beef", "chicken", "stew", "bottle", "potion", "berry", "golden_", "carrot", "potato", "pie"];
    if (foodKeywords.some(k => id.includes(k))) return "ah_consumables";
    try { if (BlockTypes.get(typeId) !== undefined) return "ah_blocks"; } catch (e) { }
    return "ah_misc";
}

const commandInformation = {
    name: "ahsell",
    description: "Add an item to the Auction House",
    usage: [
        { name: "price", type: CustomCommandParamType.Integer, optional: false },
        { name: "amount", type: CustomCommandParamType.Integer, optional: false },
        { name: "currency", type: CustomCommandParamType.String, optional: false },
        { name: "time_seconds", type: CustomCommandParamType.Integer, optional: true }
    ]
};

registerCommand(commandInformation, (origin, price, amount, currencyInput, timeInput) => {
    system.run(() => {

        const MAX_LISTINGS = world.getDynamicProperty("maxah");
        const player = origin.sourceEntity;
        if (!player) {
            return;
        }

        const equippable = player.getComponent("equippable");
        const mainHandSlot = equippable.getEquipmentSlot(EquipmentSlot.Mainhand);
        const item = mainHandSlot.getItem();

        if (!item) {
            player.sendMessage({ rawtext: [{ translate: "command.ahsell.no_item_held" }] });
            return;
        }

        const typeId = item.typeId;

        if (typeId === "sh:mob_spawner" || typeId.includes("shulker")) {
            player.sendMessage({ rawtext: [{ translate: typeId.includes("shulker") ? "command.ahsell.cannot_list_shulker" : "command.ahsell.cannot_list_spawner" }] });
            return;
        }

        const categoryKey = determineCategory(typeId);

        const moddedAllowed = world.getDynamicProperty("ahModItems") ?? true;
        if (categoryKey === "ah_modded" && !moddedAllowed) {
            player.sendMessage({ rawtext: [{ translate: "command.ahsell.modded_not_allowed" }] });
            return;
        }

        let totalActiveListings = 0;
        for (const key of CATEGORY_KEYS) {
            const categoryData = H.getData(key) || {};
            for (const id in categoryData) {
                if (categoryData[id].sellerId === player.id) totalActiveListings++;
            }
        }

        if (totalActiveListings >= MAX_LISTINGS) {
            player.sendMessage({ rawtext: [{ translate: "command.ahsell.limit_reached", with: [String(MAX_LISTINGS)] }] });
            return;
        }

        if (amount > item.amount || amount <= 0) {
            player.sendMessage({ rawtext: [{ translate: "command.ahsell.invalid_amount" }] });
            return;
        }

        const allObjectives = world.scoreboard.getObjectives();
        const searchName = currencyInput.toLowerCase();
        const objective = allObjectives.find(obj =>
            obj.id.toLowerCase() === searchName ||
            stripCodes(obj.displayName).toLowerCase() === searchName
        );

        if (!objective) {
            player.sendMessage({ rawtext: [{ translate: "command.general.currency_not_found", with: [currencyInput] }] });
            return;
        }

        let enchants = {};
        const enchantable = item.getComponent("minecraft:enchantable");
        if (enchantable) {
            const allEnchants = enchantable.getEnchantments();
            allEnchants.forEach(e => {
                enchants[e.type.id] = e.level;
            });
        }

        const listingId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        if (!timeInput) timeInput = MAX_TIME;
        const timeToExpiry = Math.min(timeInput, MAX_TIME);

        const listing = {
            id: listingId,
            typeId: typeId,
            category: categoryKey,
            name: item.nameTag,
            lore: item.getLore(),
            price: price,
            amount: amount,
            enchants: enchants,
            currencyId: objective.id,
            currencyName: stripCodes(objective.displayName),
            seller: player.name,
            sellerId: player.id,
            expiry: Date.now() + (timeToExpiry * 1000),
            sold: false
        };

        const potionComp = item.getComponent("minecraft:potion");
        if (potionComp) {
            listing.potion = potionComp.potionType?.id || potionComp.potionEffectType?.id;
            listing.delivery = potionComp.potionDeliveryType?.id || "minecraft:bottle";
        }

        let db = H.getData(categoryKey);

        if (!db || typeof db !== "object" || Array.isArray(db)) {
            db = {};
        }

        db[listingId] = listing;

        try {
            H.setData(categoryKey, db);

            const verifyDB = H.getData(categoryKey);
            if (!verifyDB || !verifyDB[listingId]) {
                player.sendMessage({ rawtext: [{ translate: "command.ahsell.db_error_silent" }] });
                return;
            }

        } catch (error) {
            player.sendMessage({ rawtext: [{ translate: "command.ahsell.db_error_exception" }] });
            return;
        }

        if (item.amount === amount) {
            mainHandSlot.setItem(undefined);
        } else {
            item.amount -= amount;
            mainHandSlot.setItem(item);
        }

        let itemName = listing.name
            ? stripCodes(listing.name)
            : (listing.typeId.includes(":")
                ? listing.typeId.split(":")[1].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
                : listing.typeId);

        if (!listing.name && listing.potion) {
            const potName = listing.potion.includes(":")
                ? listing.potion.split(":")[1].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
                : listing.potion;
            itemName = `${potName} Potion`;
        }

        player.sendMessage({ rawtext: [{ translate: "message.ahsell.listed", with: [String(amount), itemName, String(price), listing.currencyName] }] });
        player.runCommand(`playsound random.levelup @s`);
    });
});

export default commandInformation;
