import {
  world,
  system,
  EquipmentSlot,
  EntityEquippableComponent,
  BlockPermutation, ItemStack
} from "@minecraft/server";
import {
  ActionFormData,
  ModalFormData,
} from "@minecraft/server-ui";
export function addItem(player, itemId, keepOnDeath, lockMode, lore) {
  const container = player.getComponent("inventory").container;
  const item = new ItemStack(itemId);
  item.keepOnDeath = keepOnDeath;
  item.lockMode = lockMode;
  item.setLore(lore);
  container.addItem(item);
}
world.afterEvents.playerSpawn.subscribe(({ player: p }) => {
  if (!p.hasTag("system_dynamic_config")) {
    p.runCommand("gamerule showtags false");
    addItem(p, "stv:sdl_book_config", true, "none", [""]);
    p.addTag("system_dynamic_config");
  }
});
const CONFIG_ITEM_ID = "stv:sdl_book_config";
const PROPERTY_PREFIX = "system_dynamic_light:";
const UPDATE_INTERVAL_TICKS = 1;
const DIMENSIONS = [
  "overworld",
  "nether",
  "the_end",
];
const PLAYER_LIGHT_TAGS = [
  "helmet_light",
  "light_offhand",
  "light_mainhand",
];
const DROPPED_LIGHT_TAG =
  "system_dynamic_light:dropped_light";
const ENTITY_LIGHT_TAG =
  "system_dynamic_light:entity_light";
const ITEM_LORE_TAG =
  "§r§d[System Dynamic Lights]§r";
const playerLastLight = new Map();
const placementCooldown = new Set();
const LIGHT_GROUPS = {
  15: [
    "lit_pumpkin",
    "lava_bucket",
    "glowstone",
    "shroomlight",
    "beacon",
    "minecraft:lantern",
    "sea_lantern",
    ":campfire",
    "froglight",
    "end_rod",
    "conduit",
  ],
  13: [
    "minecraft:torch",
    "soul_lantern",
    "soul_campfire",
    "candle",
    "copper_lantern",
  ],
  11: [
    "crying_obsidian",
    "soul_torch",
    "copper_torch",
  ],
  9: [
    "fire_charge",
    "redstone_torch",
    "ender_chest",
    "enchanting_table",
    "catalyst",
    "totem_of_undying",
    "nether_star",
  ],
  6: [
    "enchanted_book",
    "dragon_breath",
    "ender_eye",
    "magma",
    "blaze_rod",
    "blaze_powder",
    "glow_ink_sac",
    "glow_berries",
    "glowstone_dust",
    "experience_bottle",
    "firefly_bush",
    "brewing_stand",
    "redstone",
    "repeater",
    "comparator",
  ],
};
const LIGHT_ALL = [
  "black_candle",
  "copper_torch",
  "red_candle",
  "green_candle",
  "brown_candle",
  "blue_candle",
  "cyan_candle",
  "purple_candle",
  "light_gray_candle",
  "gray_candle",
  "pink_candle",
  "lime_candle",
  "light_blue_candle",
  "yellow_candle",
  "white_candle",
  "magenta_candle",
  "orange_candle",
  "waxed_weathered_copper_lantern",
  "waxed_copper_lantern",
  "weathered_copper_lantern",
  "waxed_oxidized_copper_lantern",
  "waxed_exposed_copper_lantern",
  "oxidized_copper_lantern",
  "exposed_copper_lantern",
  "copper_lantern",
  "dragon_breath",
  "lava_bucket",
  "glowstone",
  "shroomlight",
  "beacon",
  "lantern",
  "sea_lantern",
  "campfire",
  "end_rod",
  "torch",
  "soul_lantern",
  "soul_campfire",
  "candle",
  "crying_obsidian",
  "soul_torch",
  "fire_charge",
  "redstone_torch",
  "ender_chest",
  "enchanting_table",
  "catalyst",
  "totem_of_undying",
  "nether_star",
  "magma",
  "blaze_rod",
  "blaze_powder",
  "glow_ink_sac",
  "glowstone_dust",
  "sea_pickle",
  "brewing_stand",
  "conduit",
  "firefly_bush",
  "repeater",
  "redstone",
  "comparator",
];
const HELMET_LIGHT = [
  "lantern_gold_helmet",
  "lantern_iron_helmet",
  "lantern_diamond_helmet",
  "lantern_netherite_helmet",
  "lantern_chainmain_helmet",
  "lantern_copper_helmet",
];
/*
 * Este formulario utiliza la sintaxis de
 * @minecraft/server-ui 1.x:
 *
 * toggle(label, boolean)
 * dropdown(label, options, defaultIndex)
 */
const SETTINGS = [
  {
    id: "enable_dynamic_light",
    name: "Enable Dynamic Light",
    type: "toggle",
    defaultValue: true,
    description:
      "Master control for the entire addon.\n\n" +
      "§2Enabled: §7All dynamic lighting features work normally.\n\n" +
      "§cDisabled: §7Dynamic lights, automatic offhand activation and special placement are disabled.",
  },
  {
    id: "offhand_light",
    name: "Offhand Light",
    type: "toggle",
    defaultValue: true,
    description:
      "Controls light produced by supported items in the offhand.\n\n" +
      "§2Enabled: §7Supported offhand items produce dynamic light.\n\n" +
      "§cDisabled: §7Offhand items do not produce dynamic light.",
  },
  {
    id: "helmet_light",
    name: "Helmet Light",
    type: "toggle",
    defaultValue: true,
    description:
      "Controls light produced by compatible lantern helmets.\n\n" +
      "§2Enabled: §7Compatible helmets produce level 15 light.\n\n" +
      "§cDisabled: §7The helmets can be worn, but do not produce light.",
  },
  {
    id: "preferred_light_source",
    name: "Preferred Light Source",
    type: "dropdown",
    defaultValue: "brightest",
    legacyTrue: "brightest",
    legacyFalse: "original",
    options: [
      {
        label: "Brightest Available",
        value: "brightest",
      },
      {
        label: "Original Priority",
        value: "original",
      },
      {
        label: "Prefer Helmet",
        value: "helmet",
      },
      {
        label: "Prefer Offhand",
        value: "offhand",
      },
      {
        label: "Prefer Main Hand",
        value: "mainhand",
      },
    ],
    description:
      "Controls which player light source has priority.\n\n" +
      "§5Brightest Available: §7Uses the source with the highest light level.\n\n" +
      "§5Original Priority: §7Uses Helmet, then Offhand, then Main Hand.\n\n" +
      "§5Prefer Helmet / Offhand / Main Hand: §7Prioritizes the selected source. If it is unavailable, the brightest remaining source is used.",
  },
  {
    id: "offhand_activation_method",
    name: "Placed Offhand Activation Method",
    type: "dropdown",
    defaultValue: "use_item",
    legacyTrue: "use_item",
    legacyFalse: "disabled",
    options: [
      {
        label: "Disabled",
        value: "disabled",
      },
      {
        label: "Use Item",
        value: "use_item",
      },
      {
        label: "Sneak + Use Item",
        value: "sneak_use",
      },
    ],
    description:
      "Controls how supported light items are moved automatically to an empty offhand.\n\n" +
      "§cDisabled: §7It cannot be placed on the second hand.\n\n" +
      "§5Use Item: §7Use a supported item while looking at the air.\n\n" +
      "§5Sneak + Use Item: §7Sneak and use a supported item while looking at the air.",
  },
  {
    id: "torch_placement",
    name: "Offhand Torch Placement",
    type: "dropdown",
    defaultValue: "sneak_hit",
    legacyTrue: "sneak_hit",
    legacyFalse: "disabled",
    options: [
      {
        label: "Disabled",
        value: "disabled",
      },
      {
        label: "Sneak + Hit",
        value: "sneak_hit",
      },
    ],
    description:
      "Controls how a compatible light block is placed from the offhand.\n\n" +
      "§cDisabled: §7Special offhand placement is disabled.\n\n" +
      "§5Sneak + Hit: §7Sneak and hit a block.\n\n" +
      "§5Sneak + Interact: §7Sneak and interact with a block.",
  },
  {
    id: "place_all_light_blocks",
    name: "Offhand Place Light Blocks",
    type: "dropdown",
    defaultValue: "torches_only",
    legacyTrue: "all",
    legacyFalse: "torches_only",
    options: [
      {
        label: "Torches Only",
        value: "torches_only",
      },
      {
        label: "Torches and Lanterns",
        value: "torches_lanterns",
      },
      {
        label: "All Placeable Lights",
        value: "all",
      },
    ],
    description:
      "Controls which supported offhand items can use special placement.\n\n" +
      "§5Torches Only: §7Only items containing 'torch'.\n\n" +
      "§5Torches and Lanterns: §7Items containing 'torch' or 'lantern'.\n\n" +
      "§5All Placeable Lights: §7Every supported item that has a valid block version.",
  },
  {
    id: "dropped_items",
    name: "Dropped Item Lights",
    type: "toggle",
    defaultValue: true,
    description:
      "Controls light produced by supported items dropped on the ground.\n\n" +
      "§2Enabled: §7Supported dropped items produce dynamic light.\n\n" +
      "§cDisabled: §7Dropped items do not produce dynamic light.",
  },
  {
    id: "maximum_dropped_lights",
    name: "Maximum Dropped Items Light",
    type: "dropdown",
    defaultValue: 25,
    legacyTrue: 25,
    legacyFalse: -1,
    options: [
      {
        label: "10 Lights",
        value: 10,
      },
      {
        label: "25 Lights",
        value: 25,
      },
      {
        label: "50 Lights",
        value: 50,
      },
      {
        label: "Unlimited",
        value: -1,
      },
    ],
    description:
      "Controls the maximum number of dropped item lights processed in each dimension.\n\n" +
      "§510 / 25 / 50 Lights: §7Only the nearest selected amount is processed.\n\n" +
      "§cUnlimited: §7All supported dropped items are processed and performance may be affected.",
  },
  {
    id: "entity_lighting",
    name: "Entity Lighting",
    type: "dropdown",
    defaultValue: "all",
    legacyTrue: "all",
    legacyFalse: "disabled",
    options: [
      {
        label: "Disabled",
        value: "disabled",
      },
      {
        label: "Burning Entities Only",
        value: "burning",
      },
      {
        label: "Natural Glowing Mobs Only",
        value: "natural",
      },
      {
        label: "All Supported Entities",
        value: "all",
      },
    ],
    description:
      "Controls dynamic lighting produced by living entities.\n\n" +
      "§cDisabled: §7Entities do not produce light.\n\n" +
      "§5Burning Entities Only: §7Only entities currently on fire produce light.\n\n" +
      "§5Natural Glowing Mobs Only: §7Blazes, Magma Cubes and Glow Squids produce light.\n\n" +
      "§5All Supported Entities: §7Both burning entities and natural glowing mobs produce light.",
  },
  {
    id: "item_information",
    name: "Item Information",
    type: "dropdown",
    defaultValue: "full",
    legacyTrue: "full",
    legacyFalse: "disabled",
    options: [
      {
        label: "Disabled",
        value: "disabled",
      },
      {
        label: "Light Level Only",
        value: "light_level",
      },
      {
        label: "Full Information",
        value: "full",
      },
    ],
    description:
      "Controls the information added to supported item lore.\n\n" +
      "§cDisabled: §7Removes System Dynamic Lights information.\n\n" +
      "§5Light Level Only: §7Shows only the light level.\n\n" +
      "§5Full Information: §7Shows the light level and usage instructions.",
  },
  {
    id: "dimension_settings",
    name: "Dimension Settings",
    type: "dropdown",
    defaultValue: "all",
    legacyTrue: "all",
    legacyFalse: "overworld_only",
    options: [
      {
        label: "Overworld Only",
        value: "overworld_only",
      },
      {
        label: "Overworld + Nether",
        value: "overworld_nether",
      },
      {
        label: "Overworld + The End",
        value: "overworld_end",
      },
      {
        label: "All Dimensions",
        value: "all",
      },
    ],
    description:
      "Controls the dimensions where dynamic lighting works.\n\n" +
      "§5Overworld Only: §7Only the Overworld.\n\n" +
      "§5Overworld + Nether: §7The Overworld and Nether.\n\n" +
      "§5Overworld + The End: §7The Overworld and The End.\n\n" +
      "§5All Dimensions: §7The Overworld, Nether and The End.",
  },
];
function propertyId(id) {
  return `${PROPERTY_PREFIX}${id}`;
}
function settingDefinition(id) {
  return SETTINGS.find(
    (setting) => setting.id === id
  );
}
export function getDynamicLightSetting(id) {
  const setting =
    settingDefinition(id);
  if (!setting) {
    return undefined;
  }
  const saved =
    world.getDynamicProperty(
      propertyId(id)
    );
  if (saved === undefined) {
    return setting.defaultValue;
  }
  if (setting.type === "toggle") {
    return typeof saved === "boolean"
      ? saved
      : setting.defaultValue;
  }
  /*
   * Convierte los valores booleanos guardados
   * por la versión anterior del sistema.
   */
  if (typeof saved === "boolean") {
    return saved
      ? setting.legacyTrue
      : setting.legacyFalse;
  }
  const valid =
    setting.options.some(
      (option) =>
        option.value === saved
    );
  return valid
    ? saved
    : setting.defaultValue;
}
export function isDynamicLightSettingEnabled(id) {
  const value =
    getDynamicLightSetting(id);
  if (typeof value === "boolean") {
    return value;
  }
  return value !== "disabled";
}
function saveSetting(id, value) {
  const setting =
    settingDefinition(id);
  if (!setting) {
    return;
  }
  if (setting.type === "toggle") {
    if (typeof value === "boolean") {
      world.setDynamicProperty(
        propertyId(id),
        value
      );
    }
    return;
  }
  const valid =
    setting.options.some(
      (option) =>
        option.value === value
    );
  if (valid) {
    world.setDynamicProperty(
      propertyId(id),
      value
    );
  }
}
function settingOptionIndex(
  setting,
  value
) {
  const index =
    setting.options.findIndex(
      (option) =>
        option.value === value
    );
  return index >= 0
    ? index
    : 0;
}
function settingDisplayValue(setting) {
  const value =
    getDynamicLightSetting(
      setting.id
    );
  if (setting.type === "toggle") {
    return value
      ? "§2Enabled"
      : "§cDisabled";
  }
  const option =
    setting.options.find(
      (entry) =>
        entry.value === value
    );
  return `§5${option?.label ?? "Unknown"}`;
}
/* =========================================================
   DIMENSIONES
========================================================= */
function normalizeDimensionId(id) {
  if (id.endsWith(":overworld")) {
    return "overworld";
  }
  if (id.endsWith(":nether")) {
    return "nether";
  }
  if (id.endsWith(":the_end")) {
    return "the_end";
  }
  return id;
}
function processedDimensionIds() {
  const mode =
    getDynamicLightSetting(
      "dimension_settings"
    );
  switch (mode) {
    case "overworld_nether":
      return [
        "overworld",
        "nether",
      ];
    case "overworld_end":
      return [
        "overworld",
        "the_end",
      ];
    case "all":
      return DIMENSIONS;
    default:
      return [
        "overworld",
      ];
  }
}
function dimensionEnabled(dimension) {
  return processedDimensionIds().includes(
    normalizeDimensionId(
      dimension.id
    )
  );
}
/* =========================================================
   DETECCIÓN DE LUCES
========================================================= */
function lightFunction(
  level,
  special
) {
  if (special === "sea_pickle") {
    return "sea_pickle";
  }
  if (special === "noOffhand") {
    return "noOffhand";
  }
  if (level === 15) {
    return "light15";
  }
  if (level === 13) {
    return "light13";
  }
  if (level === 11) {
    return "light11";
  }
  if (level === 9) {
    return "light9";
  }
  if (level === 6) {
    return "light6";
  }
  return null;
}
function getLightInfoFromItemId(id) {
  if (!id) {
    return null;
  }
  if (
    id.includes("lit_pumpkin") ||
    id.includes("froglight")
  ) {
    return {
      level: 15,
      special: "noOffhand",
    };
  }
  if (id.includes("sea_pickle")) {
    return {
      level: 13,
      special: "sea_pickle",
    };
  }
  if (
    id.includes("ender_eye") ||
    id.includes("glow_berries") ||
    id.includes("experience_bottle") ||
    id.includes("enchanted_book")
  ) {
    return {
      level: 6,
      special: "noOffhand",
    };
  }
  if (
    id.includes(
      "glowstone_dust"
    )
  ) {
    return {
      level: 6,
    };
  }
  for (
    const [levelText, ids]
    of Object.entries(LIGHT_GROUPS)
  ) {
    for (const key of ids) {
      if (id.includes(key)) {
        return {
          level:
            Number(levelText),
        };
      }
    }
  }
  return null;
}
/* =========================================================
   EJECUTAR Y ELIMINAR LUCES
========================================================= */
function runLight(
  entity,
  info,
  verticalOffset = 1
) {
  const fn =
    lightFunction(
      info?.level,
      info?.special
    );
  if (!fn) {
    return;
  }
  try {
    entity.runCommandAsync(
      `execute as @s positioned ~ ~${verticalOffset} ~ run function ${fn}`
    );
  } catch {
    // La entidad dejó de ser válida.
  }
}
function runNoLight(entity) {
  try {
    entity.runCommandAsync(
      "function no_light"
    );
  } catch {
    // La entidad dejó de ser válida.
  }
}
function clearLightAt(
  dimensionId,
  location,
  verticalOffset = 1
) {
  if (
    !dimensionId ||
    !location
  ) {
    return;
  }
  system.run(() => {
    try {
      const dimension =
        world.getDimension(
          normalizeDimensionId(
            dimensionId
          )
        );
      const x =
        Math.floor(
          location.x
        );
      const y =
        Math.floor(
          location.y
        ) + verticalOffset;
      const z =
        Math.floor(
          location.z
        );
      dimension.runCommand(
        `execute positioned ${x} ${y} ${z} run function no_light`
      );
    } catch {
      // La posición ya no está disponible.
    }
  });
}
function setTag(
  entity,
  tag,
  enabled
) {
  try {
    const has =
      entity.hasTag(tag);
    if (
      enabled &&
      !has
    ) {
      entity.addTag(tag);
    }
    if (
      !enabled &&
      has
    ) {
      entity.removeTag(tag);
    }
  } catch {
    // Entidad inválida.
  }
}
function removePlayerLightTags(player) {
  for (
    const tag
    of PLAYER_LIGHT_TAGS
  ) {
    setTag(
      player,
      tag,
      false
    );
  }
}
function squaredDistance(a, b) {
  const x =
    a.x - b.x;
  const y =
    a.y - b.y;
  const z =
    a.z - b.z;
  return (
    x * x +
    y * y +
    z * z
  );
}
/* =========================================================
   INFORMACIÓN EN OBJETOS
========================================================= */
function addonLore(
  level,
  special,
  mode
) {
  const lore = [
    `§5Lighting: §7${level} Blocks`,
  ];
  if (mode === "full") {
    if (
      special ===
      "sea_pickle"
    ) {
      lore.push(
        "§9You can use it underwater"
      );
    } else if (
      special !==
      "noOffhand"
    ) {
      lore.push(
        "§cUse the item to switch to the offhand"
      );
    }
  }
  lore.push(
    ITEM_LORE_TAG
  );
  return lore;
}
function removeAddonLore(lore) {
  const result = [];
  for (
    const line
    of lore ?? []
  ) {
    if (
      line.includes(
        "[System Dynamic Lights]"
      )
    ) {
      continue;
    }
    if (
      line.startsWith(
        "§5Lighting: §7"
      )
    ) {
      continue;
    }
    if (
      line.startsWith(
        "§5Lightning: §7"
      )
    ) {
      continue;
    }
    if (
      line.startsWith(
        "§6Lighting: §7"
      )
    ) {
      continue;
    }
    if (
      line.startsWith(
        "§6Lightning: §7"
      )
    ) {
      continue;
    }
    if (
      line.includes(
        "You can use it underwater"
      )
    ) {
      continue;
    }
    if (
      line.includes(
        "Use the item to switch to the offhand"
      )
    ) {
      continue;
    }
    result.push(line);
  }
  return result;
}
function updateItemLore(
  item,
  info,
  mode
) {
  if (
    !item ||
    !info
  ) {
    return false;
  }
  const current =
    item.getLore() ?? [];
  const clean =
    removeAddonLore(
      current
    );
  const next =
    mode === "disabled"
      ? clean
      : [
          ...clean,
          ...addonLore(
            info.level,
            info.special,
            mode
          ),
        ];
  if (
    JSON.stringify(current) ===
    JSON.stringify(next)
  ) {
    return false;
  }
  item.setLore(next);
  return true;
}
function processPlayerItemInformation(player) {
  let inventory;
  try {
    inventory =
      player.getComponent(
        "minecraft:inventory"
      )?.container;
  } catch {
    return;
  }
  if (!inventory) {
    return;
  }
  const mode =
    getDynamicLightSetting(
      "item_information"
    );
  for (
    let slot = 0;
    slot < inventory.size;
    slot++
  ) {
    const item =
      inventory.getItem(slot);
    if (!item) {
      continue;
    }
    const info =
      getLightInfoFromItemId(
        item.typeId
      );
    if (!info) {
      continue;
    }
    try {
      const changed =
        updateItemLore(
          item,
          info,
          mode
        );
      if (changed) {
        inventory.setItem(
          slot,
          item
        );
      }
    } catch {
      // El objeto cambió durante el proceso.
    }
  }
}
/* =========================================================
   LUZ DEL JUGADOR
========================================================= */
function hasLightHelmet(item) {
  return Boolean(
    item &&
    HELMET_LIGHT.some(
      (helmetId) =>
        item.typeId.includes(
          helmetId
        )
    )
  );
}
function brightestCandidate(candidates) {
  return candidates.reduce(
    (
      brightest,
      current
    ) =>
      current.level >
      brightest.level
        ? current
        : brightest
  );
}
function choosePlayerLight(
  head,
  mainhand,
  offhand
) {
  const candidates = [];
  if (
    getDynamicLightSetting(
      "helmet_light"
    ) &&
    hasLightHelmet(head)
  ) {
    candidates.push({
      source: "helmet",
      level: 15,
      special: null,
    });
  }
  if (
    getDynamicLightSetting(
      "offhand_light"
    )
  ) {
    const info =
      getLightInfoFromItemId(
        offhand?.typeId
      );
    if (info) {
      candidates.push({
        source: "offhand",
        ...info,
      });
    }
  }
  const mainhandInfo =
    getLightInfoFromItemId(
      mainhand?.typeId
    );
  if (mainhandInfo) {
    candidates.push({
      source: "mainhand",
      ...mainhandInfo,
    });
  }
  if (
    candidates.length === 0
  ) {
    return null;
  }
  const mode =
    getDynamicLightSetting(
      "preferred_light_source"
    );
  if (mode === "brightest") {
    return brightestCandidate(
      candidates
    );
  }
  if (mode === "original") {
    return (
      candidates.find(
        (entry) =>
          entry.source ===
          "helmet"
      ) ??
      candidates.find(
        (entry) =>
          entry.source ===
          "offhand"
      ) ??
      candidates.find(
        (entry) =>
          entry.source ===
          "mainhand"
      ) ??
      null
    );
  }
  return (
    candidates.find(
      (entry) =>
        entry.source === mode
    ) ??
    brightestCandidate(
      candidates
    )
  );
}
function clearLastPlayerLight(player) {
  const previous =
    playerLastLight.get(
      player.id
    );
  if (!previous) {
    return;
  }
  clearLightAt(
    previous.dimensionId,
    previous.location,
    1
  );
  playerLastLight.delete(
    player.id
  );
}
function processPlayerLight(player) {
  const addonEnabled =
    getDynamicLightSetting(
      "enable_dynamic_light"
    );
  if (
    !addonEnabled ||
    !dimensionEnabled(
      player.dimension
    )
  ) {
    clearLastPlayerLight(
      player
    );
    const hasActiveTag =
      PLAYER_LIGHT_TAGS.some(
        (tag) =>
          player.hasTag(tag)
      );
    if (hasActiveTag) {
      runNoLight(player);
      removePlayerLightTags(
        player
      );
    }
    return;
  }
  let equippable;
  let head;
  let mainhand;
  let offhand;
  try {
    equippable =
      player.getComponent(
        "minecraft:equippable"
      );
    head =
      equippable?.getEquipment(
        EquipmentSlot.Head
      );
    mainhand =
      equippable?.getEquipment(
        EquipmentSlot.Mainhand
      );
    offhand =
      equippable?.getEquipment(
        EquipmentSlot.Offhand
      );
  } catch {
    return;
  }
  const selected =
    choosePlayerLight(
      head,
      mainhand,
      offhand
    );
  if (!selected) {
    clearLastPlayerLight(
      player
    );
    const hasActiveTag =
      PLAYER_LIGHT_TAGS.some(
        (tag) =>
          player.hasTag(tag)
      );
    if (hasActiveTag) {
      runNoLight(player);
      removePlayerLightTags(
        player
      );
    }
    return;
  }
  const selectedTag =
    selected.source ===
    "helmet"
      ? "helmet_light"
      : selected.source ===
        "offhand"
        ? "light_offhand"
        : "light_mainhand";
  for (
    const tag
    of PLAYER_LIGHT_TAGS
  ) {
    setTag(
      player,
      tag,
      tag === selectedTag
    );
  }
  const currentDimensionId =
    player.dimension.id;
  const previous =
    playerLastLight.get(
      player.id
    );
  if (
    previous &&
    normalizeDimensionId(
      previous.dimensionId
    ) !==
      normalizeDimensionId(
        currentDimensionId
      )
  ) {
    clearLightAt(
      previous.dimensionId,
      previous.location,
      1
    );
  }
  playerLastLight.set(
    player.id,
    {
      dimensionId:
        currentDimensionId,
      location: {
        ...player.location,
      },
    }
  );
  runLight(
    player,
    selected,
    1
  );
}
/* =========================================================
   OBJETOS TIRADOS
========================================================= */
function getDroppedLightEntities(dimension) {
  let items = [];
  try {
    items =
      dimension.getEntities({
        type:
          "minecraft:item",
      });
  } catch {
    return [];
  }
  return items.filter(
    (entity) => {
      try {
        const itemStack =
          entity.getComponent(
            "minecraft:item"
          )?.itemStack;
        return Boolean(
          getLightInfoFromItemId(
            itemStack?.typeId
          )
        );
      } catch {
        return false;
      }
    }
  );
}
function nearestDistanceToPlayers(
  entity,
  players
) {
  if (
    players.length === 0
  ) {
    return Number.POSITIVE_INFINITY;
  }
  let nearest =
    Number.POSITIVE_INFINITY;
  for (
    const player
    of players
  ) {
    const distance =
      squaredDistance(
        entity.location,
        player.location
      );
    if (
      distance < nearest
    ) {
      nearest = distance;
    }
  }
  return nearest;
}
function processDroppedItems(dimension) {
  const enabled =
    getDynamicLightSetting(
      "enable_dynamic_light"
    ) &&
    getDynamicLightSetting(
      "dropped_items"
    ) &&
    dimensionEnabled(
      dimension
    );
  const allItems =
    getDroppedLightEntities(
      dimension
    );
  if (!enabled) {
    for (
      const entity
      of allItems
    ) {
      if (
        entity.hasTag(
          DROPPED_LIGHT_TAG
        )
      ) {
        runNoLight(entity);
        setTag(
          entity,
          DROPPED_LIGHT_TAG,
          false
        );
      }
    }
    return;
  }
  let activeItems =
    allItems;
  const limit =
    getDynamicLightSetting(
      "maximum_dropped_lights"
    );
  if (
    typeof limit === "number" &&
    limit > 0
  ) {
    let players = [];
    try {
      players =
        dimension.getPlayers();
    } catch {
      players = [];
    }
    activeItems = [
      ...allItems,
    ]
      .sort(
        (a, b) =>
          nearestDistanceToPlayers(
            a,
            players
          ) -
          nearestDistanceToPlayers(
            b,
            players
          )
      )
      .slice(
        0,
        limit
      );
  }
  const activeIds =
    new Set(
      activeItems.map(
        (entity) =>
          entity.id
      )
    );
  for (
    const entity
    of allItems
  ) {
    if (
      !activeIds.has(
        entity.id
      )
    ) {
      if (
        entity.hasTag(
          DROPPED_LIGHT_TAG
        )
      ) {
        runNoLight(entity);
        setTag(
          entity,
          DROPPED_LIGHT_TAG,
          false
        );
      }
      continue;
    }
    const itemStack =
      entity.getComponent(
        "minecraft:item"
      )?.itemStack;
    const info =
      getLightInfoFromItemId(
        itemStack?.typeId
      );
    if (!info) {
      continue;
    }
    setTag(
      entity,
      DROPPED_LIGHT_TAG,
      true
    );
    runLight(
      entity,
      info,
      0
    );
  }
}
/* =========================================================
   ILUMINACIÓN DE ENTIDADES
========================================================= */
function isBurningEntity(entity) {
  try {
    return Boolean(
      entity.getComponent(
        "minecraft:onfire"
      )
    );
  } catch {
    return false;
  }
}
function naturalEntityLightInfo(entity) {
  if (
    entity.typeId ===
    "minecraft:blaze"
  ) {
    return {
      level: 11,
      special: null,
    };
  }
  if (
    entity.typeId ===
    "minecraft:magma_cube"
  ) {
    return {
      level: 9,
      special: null,
    };
  }
  if (
    entity.typeId ===
    "minecraft:glow_squid"
  ) {
    return {
      level: 13,
      special: "sea_pickle",
    };
  }
  return null;
}
function entityLightInfo(
  entity,
  mode
) {
  if (mode === "disabled") {
    return null;
  }
  const burning =
    isBurningEntity(
      entity
    );
  const natural =
    naturalEntityLightInfo(
      entity
    );
  if (mode === "burning") {
    return burning
      ? {
          level: 11,
          special: null,
        }
      : null;
  }
  if (mode === "natural") {
    return natural;
  }
  if (burning) {
    return {
      level: 11,
      special: null,
    };
  }
  return natural;
}
function processEntityLighting(dimension) {
  const addonEnabled =
    getDynamicLightSetting(
      "enable_dynamic_light"
    ) &&
    dimensionEnabled(
      dimension
    );
  const mode =
    addonEnabled
      ? getDynamicLightSetting(
          "entity_lighting"
        )
      : "disabled";
  let entities = [];
  try {
    entities =
      dimension
        .getEntities()
        .filter(
          (entity) =>
            entity.typeId !==
              "minecraft:item" &&
            entity.typeId !==
              "minecraft:player"
        );
  } catch {
    return;
  }
  for (
    const entity
    of entities
  ) {
    const info =
      entityLightInfo(
        entity,
        mode
      );
    if (info) {
      setTag(
        entity,
        ENTITY_LIGHT_TAG,
        true
      );
      runLight(
        entity,
        info,
        1
      );
    } else if (
      entity.hasTag(
        ENTITY_LIGHT_TAG
      )
    ) {
      runNoLight(entity);
      setTag(
        entity,
        ENTITY_LIGHT_TAG,
        false
      );
    }
  }
}
/* =========================================================
   LIMPIEZA GENERAL
========================================================= */
function cleanupDimensionLights(dimensionId) {
  let dimension;
  let entities;
  try {
    dimension =
      world.getDimension(
        dimensionId
      );
    entities =
      dimension.getEntities();
  } catch {
    return;
  }
  for (
    const entity
    of entities
  ) {
    const dropped =
      entity.hasTag(
        DROPPED_LIGHT_TAG
      );
    const glowing =
      entity.hasTag(
        ENTITY_LIGHT_TAG
      );
    if (
      dropped ||
      glowing
    ) {
      runNoLight(entity);
      setTag(
        entity,
        DROPPED_LIGHT_TAG,
        false
      );
      setTag(
        entity,
        ENTITY_LIGHT_TAG,
        false
      );
    }
  }
  for (
    const player
    of dimension.getPlayers()
  ) {
    const hasLight =
      PLAYER_LIGHT_TAGS.some(
        (tag) =>
          player.hasTag(tag)
      );
    if (hasLight) {
      runNoLight(player);
      removePlayerLightTags(
        player
      );
    }
  }
}
function cleanupAllDynamicLights() {
  for (
    const dimensionId
    of DIMENSIONS
  ) {
    cleanupDimensionLights(
      dimensionId
    );
  }
  playerLastLight.clear();
}
/* =========================================================
   MENÚ PRINCIPAL
========================================================= */
export async function openDynamicLightMenu(player) {
  try {
    const response =
      await new ActionFormData()
        .title(
          "§l§5System Dynamic Light"
        )
        .body(
          "§7Configure the addon or read detailed information about each option."
        )
        .button(
          "§l§2Settings\n§r§8Configure features"
        )
        .button(
          "§l§9Information\n§r§8Read option descriptions"
        )
        .button(
          "§l§cClose"
        )
        .show(player);
    if (response.canceled) {
      return;
    }
    if (
      response.selection === 0
    ) {
      system.run(() => {
        openSettingsForm(
          player
        );
      });
    } else if (
      response.selection === 1
    ) {
      system.run(() => {
        openInformationForm(
          player
        );
      });
    }
  } catch (error) {
    console.warn(
      `[System Dynamic Light] Main form error: ${error}`
    );
  }
}
/* =========================================================
   CONFIGURACIÓN
   Esta sección corrige el error de toggle().
========================================================= */
async function openSettingsForm(player) {
  try {
    const form =
      new ModalFormData()
        .title(
          "§l§5Dynamic Light Settings"
        );
    for (
      const setting
      of SETTINGS
    ) {
      const current =
        getDynamicLightSetting(
          setting.id
        );
      if (
        setting.type ===
        "toggle"
      ) {
        /*
         * CORRECCIÓN:
         *
         * En server-ui 1.x el segundo argumento
         * debe ser un booleano, no un objeto.
         */
        form.toggle(
          setting.name,
          Boolean(current)
        );
      } else {
        /*
         * Los ajustes con varios valores
         * utilizan dropdown.
         */
        form.dropdown(
          setting.name,
          setting.options.map(
            (option) =>
              option.label
          ),
          settingOptionIndex(
            setting,
            current
          )
        );
      }
    }
    const response =
      await form.show(
        player
      );
    if (
      response.canceled ||
      !response.formValues
    ) {
      system.run(() => {
        openDynamicLightMenu(
          player
        );
      });
      return;
    }
    for (
      let index = 0;
      index < SETTINGS.length;
      index++
    ) {
      const setting =
        SETTINGS[index];
      const formValue =
        response.formValues[
          index
        ];
      if (
        setting.type ===
        "toggle"
      ) {
        if (
          typeof formValue ===
          "boolean"
        ) {
          saveSetting(
            setting.id,
            formValue
          );
        }
        continue;
      }
      if (
        typeof formValue ===
        "number"
      ) {
        const option =
          setting.options[
            formValue
          ];
        if (option) {
          saveSetting(
            setting.id,
            option.value
          );
        }
      }
    }
    cleanupAllDynamicLights();
    player.sendMessage(
      "§2[System Dynamic Light] §7Settings saved successfully."
    );
    system.run(() => {
      openDynamicLightMenu(
        player
      );
    });
  } catch (error) {
    console.warn(
      `[System Dynamic Light] Settings form error: ${error}`
    );
  }
}
/* =========================================================
   INFORMACIÓN
========================================================= */
async function openInformationForm(player) {
  try {
    const form =
      new ActionFormData()
        .title(
          "§l§9Dynamic Light Information"
        )
        .body(
          "§7Select an option to read its complete explanation."
        );
    for (
      const setting
      of SETTINGS
    ) {
      form.button(
        `${setting.name}\n§r${settingDisplayValue(setting)}`
      );
    }
    form.button(
      "§l§cBack"
    );
    const response =
      await form.show(
        player
      );
    if (response.canceled) {
      return;
    }
    if (
      response.selection ===
      SETTINGS.length
    ) {
      system.run(() => {
        openDynamicLightMenu(
          player
        );
      });
      return;
    }
    const setting =
      SETTINGS[
        response.selection
      ];
    if (setting) {
      system.run(() => {
        openSettingInformation(
          player,
          setting
        );
      });
    }
  } catch (error) {
    console.warn(
      `[System Dynamic Light] Information form error: ${error}`
    );
  }
}
async function openSettingInformation(
  player,
  setting
) {
  try {
    const response =
      await new ActionFormData()
        .title(
          `§l§9${setting.name}`
        )
        .body(
          `${setting.description}\n\nCurrent Setting: ${settingDisplayValue(setting)}`
        )
        .button(
          "§l§cBack"
        )
        .button(
          "§l§5Main Menu"
        )
        .show(player);
    if (response.canceled) {
      return;
    }
    if (
      response.selection === 0
    ) {
      system.run(() => {
        openInformationForm(
          player
        );
      });
    } else if (
      response.selection === 1
    ) {
      system.run(() => {
        openDynamicLightMenu(
          player
        );
      });
    }
  } catch (error) {
    console.warn(
      `[System Dynamic Light] Option information error: ${error}`
    );
  }
}
/* =========================================================
   ACTIVACIÓN AUTOMÁTICA DE OFFHAND
========================================================= */
function supportsAutomaticOffhand(typeId) {
  return LIGHT_ALL.some(
    (id) =>
      typeId ===
      `minecraft:${id}`
  );
}
world.afterEvents.itemUse.subscribe(
  ({
    itemStack,
    source,
  }) => {
    if (
      source?.typeId !==
        "minecraft:player" ||
      !itemStack
    ) {
      return;
    }
    if (
      itemStack.typeId ===
      CONFIG_ITEM_ID
    ) {
      system.run(() => {
        openDynamicLightMenu(
          source
        );
      });
      return;
    }
    if (
      !getDynamicLightSetting(
        "enable_dynamic_light"
      )
    ) {
      return;
    }
    if (
      !dimensionEnabled(
        source.dimension
      )
    ) {
      return;
    }
    if (
      !supportsAutomaticOffhand(
        itemStack.typeId
      )
    ) {
      return;
    }
    const method =
      getDynamicLightSetting(
        "offhand_activation_method"
      );
    if (
      method === "disabled"
    ) {
      return;
    }
    if (
      method === "sneak_use" &&
      !source.isSneaking
    ) {
      return;
    }
    let blockInView;
    try {
      blockInView =
        source.getBlockFromViewDirection({
          maxDistance: 8,
        });
    } catch {
      return;
    }
    /*
     * Solo se mueve a la offhand
     * cuando el jugador mira al aire.
     */
    if (blockInView) {
      return;
    }
    let equippable;
    let offhand;
    try {
      equippable =
        source.getComponent(
          EntityEquippableComponent.componentId
        );
      offhand =
        equippable?.getEquipment(
          EquipmentSlot.Offhand
        );
    } catch {
      return;
    }
    if (
      !equippable ||
      offhand
    ) {
      return;
    }
    try {
      source.runCommand(
        `replaceitem entity @s slot.weapon.offhand 0 ${itemStack.typeId} ${itemStack.amount}`
      );
      equippable.setEquipment(
        EquipmentSlot.Mainhand,
        undefined
      );
    } catch {
      // El inventario cambió durante el uso.
    }
  }
);
/* =========================================================
   COLOCACIÓN DESDE OFFHAND
========================================================= */
function canSpecialPlace(typeId) {
  if (
    !getLightInfoFromItemId(
      typeId
    )
  ) {
    return false;
  }
  const mode =
    getDynamicLightSetting(
      "place_all_light_blocks"
    );
  if (mode === "all") {
    return true;
  }
  if (
    mode ===
    "torches_lanterns"
  ) {
    return (
      typeId.includes("torch") ||
      typeId.includes("lantern")
    );
  }
  return typeId.includes(
    "torch"
  );
}
function offsetLocationFromFace(
  blockLocation,
  face
) {
  const location = {
    ...blockLocation,
  };
  switch (String(face)) {
    case "Up":
      location.y++;
      break;
    case "Down":
      location.y--;
      break;
    case "North":
      location.z--;
      break;
    case "South":
      location.z++;
      break;
    case "East":
      location.x++;
      break;
    case "West":
      location.x--;
      break;
    default:
      return null;
  }
  return location;
}
function placementTargetFromView(player) {
  let view;
  try {
    view =
      player.getBlockFromViewDirection({
        maxDistance: 7,
      });
  } catch {
    return null;
  }
  if (!view?.block) {
    return null;
  }
  const location =
    offsetLocationFromFace(
      view.block.location,
      view.face
    );
  return location
    ? {
        block: view.block,
        location,
      }
    : null;
}
function placeOffhandLight(
  player,
  targetLocation
) {
  if (
    placementCooldown.has(
      player.id
    )
  ) {
    return;
  }
  if (
    !getDynamicLightSetting(
      "enable_dynamic_light"
    )
  ) {
    return;
  }
  if (
    !dimensionEnabled(
      player.dimension
    )
  ) {
    return;
  }
  if (!player.isSneaking) {
    return;
  }
  let equippable;
  let offhand;
  try {
    equippable =
      player.getComponent(
        "minecraft:equippable"
      );
    offhand =
      equippable?.getEquipment(
        EquipmentSlot.Offhand
      );
  } catch {
    return;
  }
  if (
    !offhand ||
    !canSpecialPlace(
      offhand.typeId
    )
  ) {
    return;
  }
  let block;
  try {
    block =
      player.dimension.getBlock(
        targetLocation
      );
  } catch {
    return;
  }
  if (!block?.isAir) {
    return;
  }
  try {
    block.setPermutation(
      BlockPermutation.resolve(
        offhand.typeId
      )
    );
    player.runCommand(
      `clear @s ${offhand.typeId} 0 1`
    );
    placementCooldown.add(
      player.id
    );
    system.runTimeout(
      () => {
        placementCooldown.delete(
          player.id
        );
      },
      2
    );
  } catch {
    /*
     * El objeto no tiene una versión
     * de bloque válida.
     */
  }
}
/*
 * Modo Sneak + Hit
 */
world.afterEvents.entityHitBlock.subscribe(
  ({
    damagingEntity,
  }) => {
    if (
      damagingEntity?.typeId !==
      "minecraft:player"
    ) {
      return;
    }
    if (
      getDynamicLightSetting(
        "torch_placement"
      ) !== "sneak_hit"
    ) {
      return;
    }
    const target =
      placementTargetFromView(
        damagingEntity
      );
    if (target) {
      placeOffhandLight(
        damagingEntity,
        target.location
      );
    }
  }
);
/*
 * Modo Sneak + Interact.
 *
 * Optional chaining evita errores si esta señal
 * no está disponible en la versión usada.
 */
world.afterEvents
  .playerInteractWithBlock
  ?.subscribe(
    (event) => {
      if (
        getDynamicLightSetting(
          "torch_placement"
        ) !==
        "sneak_interact"
      ) {
        return;
      }
      if (
        event.isFirstEvent ===
        false
      ) {
        return;
      }
      const location =
        offsetLocationFromFace(
          event.block.location,
          event.blockFace
        );
      if (location) {
        system.run(() => {
          placeOffhandLight(
            event.player,
            location
          );
        });
      }
    }
  );
/* =========================================================
   LIMPIEZA DE ENTIDADES ELIMINADAS
========================================================= */
world.beforeEvents.entityRemove.subscribe(
  ({
    removedEntity,
  }) => {
    let shouldClear = false;
    let verticalOffset = 1;
    let dimensionId;
    let location;
    try {
      if (
        removedEntity.hasTag(
          DROPPED_LIGHT_TAG
        )
      ) {
        shouldClear = true;
        verticalOffset = 0;
      } else if (
        removedEntity.hasTag(
          ENTITY_LIGHT_TAG
        )
      ) {
        shouldClear = true;
      }
      if (!shouldClear) {
        return;
      }
      dimensionId =
        removedEntity.dimension.id;
      location = {
        ...removedEntity.location,
      };
    } catch {
      return;
    }
    clearLightAt(
      dimensionId,
      location,
      verticalOffset
    );
  }
);
/* =========================================================
   LIMPIEZA AL SALIR
========================================================= */
world.beforeEvents.playerLeave.subscribe(
  ({
    player,
  }) => {
    let fallbackDimensionId;
    let fallbackLocation;
    try {
      fallbackDimensionId =
        player.dimension.id;
      fallbackLocation = {
        ...player.location,
      };
    } catch {
      // Se usará la última ubicación guardada.
    }
    const previous =
      playerLastLight.get(
        player.id
      );
    playerLastLight.delete(
      player.id
    );
    if (previous) {
      clearLightAt(
        previous.dimensionId,
        previous.location,
        1
      );
    } else if (
      fallbackDimensionId &&
      fallbackLocation
    ) {
      clearLightAt(
        fallbackDimensionId,
        fallbackLocation,
        1
      );
    }
  }
);
/* =========================================================
   LIMPIEZA AL MORIR
========================================================= */
world.afterEvents.entityDie.subscribe(
  ({
    deadEntity,
  }) => {
    let dimensionId;
    let location;
    let verticalOffset = 1;
    let shouldClear = false;
    try {
      dimensionId =
        deadEntity.dimension.id;
      location = {
        ...deadEntity.location,
      };
      if (
        deadEntity.typeId ===
        "minecraft:player"
      ) {
        shouldClear = true;
        playerLastLight.delete(
          deadEntity.id
        );
      } else if (
        deadEntity.hasTag(
          DROPPED_LIGHT_TAG
        )
      ) {
        shouldClear = true;
        verticalOffset = 0;
      } else if (
        deadEntity.hasTag(
          ENTITY_LIGHT_TAG
        )
      ) {
        shouldClear = true;
      }
    } catch {
      return;
    }
    if (shouldClear) {
      clearLightAt(
        dimensionId,
        location,
        verticalOffset
      );
    }
  }
);
/* =========================================================
   BUCLE PRINCIPAL
========================================================= */
system.runInterval(
  () => {
    for (
      const player
      of world.getPlayers()
    ) {
      processPlayerItemInformation(
        player
      );
      processPlayerLight(
        player
      );
    }
    const enabledDimensions =
      new Set(
        processedDimensionIds()
      );
    for (
      const dimensionId
      of DIMENSIONS
    ) {
      if (
        !enabledDimensions.has(
          dimensionId
        )
      ) {
        continue;
      }
      try {
        const dimension =
          world.getDimension(
            dimensionId
          );
        processDroppedItems(
          dimension
        );
        processEntityLighting(
          dimension
        );
      } catch {
        /*
         * La dimensión puede estar
         * descargada temporalmente.
         */
      }
    }
  },
  UPDATE_INTERVAL_TICKS
);
/* =========================================================
   LIMPIEZA INICIAL
========================================================= */
system.runTimeout(
  () => {
    cleanupAllDynamicLights();
  },
  20
);
