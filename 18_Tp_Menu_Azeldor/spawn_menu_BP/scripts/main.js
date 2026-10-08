import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";

// ---------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------
const CONFIG = {
  ITEM_ID: "minecraft:compass", // objet qui ouvre le menu
  ITEM_NAME: "spawn",           // nom de l'objet (insensible a la casse)
  ADMIN_TAG: "gesttp",          // tag qui autorise la gestion des destinations
  STORAGE_KEY: "spawnmenu_destinations",
  MAX_DESTINATIONS: 30,
  MAX_NAME_LENGTH: 32,
  DEBOUNCE_TICKS: 10,
};

const DIMENSIONS = [
  { id: "overworld", label: "Overworld" },
  { id: "nether", label: "Nether" },
  { id: "the_end", label: "End" },
];

// ---------------------------------------------------------------
// OUTILS
// ---------------------------------------------------------------
function wait(ticks) {
  return new Promise((resolve) => system.runTimeout(resolve, ticks));
}

// Affiche un formulaire, et reessaie si le joueur est occupe (chat, inventaire...)
async function showForm(form, player, retries = 20) {
  for (let i = 0; i < retries; i++) {
    const res = await form.show(player);
    if (res.canceled && res.cancelationReason === FormCancelationReason.UserBusy) {
      await wait(10);
      continue;
    }
    return res;
  }
  return { canceled: true };
}

function dimLabel(id) {
  const d = DIMENSIONS.find((x) => x.id === id);
  return d ? d.label : id;
}

function currentDimId(player) {
  return player.dimension.id.replace("minecraft:", "");
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function isValidDestination(d) {
  return (
    d &&
    typeof d.name === "string" &&
    Number.isFinite(d.x) &&
    Number.isFinite(d.y) &&
    Number.isFinite(d.z) &&
    DIMENSIONS.some((x) => x.id === d.dim)
  );
}

// ---------------------------------------------------------------
// STOCKAGE (propriete dynamique du monde, au format JSON)
// ---------------------------------------------------------------
function defaultDestinations() {
  let x = 0;
  let y = 64;
  let z = 0;
  try {
    const loc = world.getDefaultSpawnLocation();
    x = loc.x + 0.5;
    y = loc.y;
    z = loc.z + 0.5;
  } catch (e) {
    // on garde 0 64 0
  }
  return [{ name: "Spawn", x, y, z, dim: "overworld" }];
}

function loadDestinations() {
  const raw = world.getDynamicProperty(CONFIG.STORAGE_KEY);
  if (typeof raw !== "string") return defaultDestinations();
  try {
    const list = JSON.parse(raw);
    if (Array.isArray(list)) return list.filter(isValidDestination);
  } catch (e) {
    console.warn("[SpawnMenu] JSON invalide, retour aux valeurs par defaut");
  }
  return defaultDestinations();
}

function saveDestinations(list) {
  world.setDynamicProperty(CONFIG.STORAGE_KEY, JSON.stringify(list));
}

// ---------------------------------------------------------------
// TELEPORTATION
// ---------------------------------------------------------------
function teleportTo(player, d) {
  try {
    const dimension = world.getDimension(d.dim);
    player.teleport({ x: d.x, y: d.y, z: d.z }, { dimension });
    player.sendMessage(`Teleporte vers ${d.name}.`);
    try {
      player.playSound("mob.endermen.portal");
    } catch (e) {
      // son optionnel
    }
  } catch (e) {
    player.sendMessage(`Teleportation impossible : ${e}`);
  }
}

// ---------------------------------------------------------------
// MENU JOUEUR
// ---------------------------------------------------------------
async function openMainMenu(player) {
  const dests = loadDestinations();
  const isAdmin = player.hasTag(CONFIG.ADMIN_TAG);

  const form = new ActionFormData()
    .title("Teleportation")
    .body(dests.length ? "Choisis une destination :" : "Aucune destination disponible.");

  for (const d of dests) form.button(`${d.name}\n${dimLabel(d.dim)}`);
  if (isAdmin) form.button("Gerer les teleportations");

  const res = await showForm(form, player);
  if (res.canceled) return;

  if (res.selection < dests.length) {
    teleportTo(player, dests[res.selection]);
  } else if (isAdmin) {
    await openAdminMenu(player);
  }
}

// ---------------------------------------------------------------
// MENU ADMIN (tag gesttp)
// ---------------------------------------------------------------
function checkAdmin(player) {
  if (player.hasTag(CONFIG.ADMIN_TAG)) return true;
  player.sendMessage("Acces refuse.");
  return false;
}

async function openAdminMenu(player) {
  while (true) {
    if (!checkAdmin(player)) return;

    const dests = loadDestinations();
    const form = new ActionFormData()
      .title("Gestion des teleportations")
      .body(`${dests.length} destination(s) sur ${CONFIG.MAX_DESTINATIONS}.`)
      .button("Ajouter une destination")
      .button("Modifier une destination")
      .button("Supprimer une destination")
      .button("Retour");

    const res = await showForm(form, player);
    if (res.canceled || res.selection === 3) return;

    if (res.selection === 0) await addDestination(player);
    else if (res.selection === 1) await editDestination(player);
    else if (res.selection === 2) await deleteDestination(player);
  }
}

// Retourne l'index choisi, ou -1 si retour / annulation
async function pickDestination(player, title) {
  const dests = loadDestinations();
  if (!dests.length) {
    player.sendMessage("Aucune destination.");
    return -1;
  }
  const form = new ActionFormData().title(title);
  for (const d of dests) form.button(`${d.name}\n${dimLabel(d.dim)}`);
  form.button("Retour");

  const res = await showForm(form, player);
  if (res.canceled || res.selection >= dests.length) return -1;
  return res.selection;
}

// Formulaire commun ajout / modification. Retourne la destination validee ou null.
async function destinationForm(player, title, base) {
  let current = base;
  let error = "";

  while (true) {
    const dimIndex = Math.max(0, DIMENSIONS.findIndex((x) => x.id === current.dim));
    const form = new ModalFormData()
      .title(error ? `Erreur : ${error}` : title)
      .textField("Nom", "ex: Spawn", current.name)
      .textField("X", "0", String(current.x))
      .textField("Y", "64", String(current.y))
      .textField("Z", "0", String(current.z))
      .dropdown("Dimension", DIMENSIONS.map((x) => x.label), dimIndex);

    const res = await showForm(form, player);
    if (res.canceled) return null;

    const [rawName, rawX, rawY, rawZ, rawDim] = res.formValues;
    const name = String(rawName).replace(/[\r\n]+/g, " ").trim();
    const x = rawX.trim() === "" ? NaN : Number(rawX.replace(",", "."));
    const y = rawY.trim() === "" ? NaN : Number(rawY.replace(",", "."));
    const z = rawZ.trim() === "" ? NaN : Number(rawZ.replace(",", "."));
    const dim = DIMENSIONS[rawDim].id;

    // On garde la saisie pour la reafficher en cas d'erreur
    current = { name: String(rawName), x: rawX, y: rawY, z: rawZ, dim };

    if (!name) error = "nom vide";
    else if (name.length > CONFIG.MAX_NAME_LENGTH) error = "nom trop long";
    else if (!Number.isFinite(x)) error = "X invalide";
    else if (!Number.isFinite(y) || y < -64 || y > 320) error = "Y invalide (-64 a 320)";
    else if (!Number.isFinite(z)) error = "Z invalide";
    else if (Math.abs(x) > 30000000 || Math.abs(z) > 30000000) error = "X/Z hors limites";
    else return { name, x, y, z, dim };
  }
}

async function addDestination(player) {
  if (loadDestinations().length >= CONFIG.MAX_DESTINATIONS) {
    player.sendMessage(`Limite atteinte (${CONFIG.MAX_DESTINATIONS}).`);
    return;
  }

  const loc = player.location;
  const base = {
    name: "",
    x: round1(loc.x),
    y: round1(loc.y),
    z: round1(loc.z),
    dim: currentDimId(player),
  };

  const result = await destinationForm(player, "Ajouter une destination", base);
  if (!result) return;
  if (!checkAdmin(player)) return;

  const fresh = loadDestinations();
  if (fresh.length >= CONFIG.MAX_DESTINATIONS) {
    player.sendMessage(`Limite atteinte (${CONFIG.MAX_DESTINATIONS}).`);
    return;
  }
  fresh.push(result);
  saveDestinations(fresh);
  player.sendMessage(`Destination ajoutee : ${result.name}.`);
}

async function editDestination(player) {
  const index = await pickDestination(player, "Modifier quelle destination ?");
  if (index < 0) return;

  const original = loadDestinations()[index];
  if (!original) return;

  const result = await destinationForm(player, "Modifier la destination", original);
  if (!result) return;
  if (!checkAdmin(player)) return;

  const fresh = loadDestinations();
  if (JSON.stringify(fresh[index]) !== JSON.stringify(original)) {
    player.sendMessage("La liste a change entre-temps, recommence.");
    return;
  }
  fresh[index] = result;
  saveDestinations(fresh);
  player.sendMessage(`Destination modifiee : ${result.name}.`);
}

async function deleteDestination(player) {
  const index = await pickDestination(player, "Supprimer quelle destination ?");
  if (index < 0) return;

  const original = loadDestinations()[index];
  if (!original) return;

  const confirm = new ActionFormData()
    .title("Confirmer")
    .body(`Supprimer "${original.name}" ?`)
    .button("Supprimer")
    .button("Annuler");

  const res = await showForm(confirm, player);
  if (res.canceled || res.selection !== 0) return;
  if (!checkAdmin(player)) return;

  const fresh = loadDestinations();
  if (JSON.stringify(fresh[index]) !== JSON.stringify(original)) {
    player.sendMessage("La liste a change entre-temps, recommence.");
    return;
  }
  fresh.splice(index, 1);
  saveDestinations(fresh);
  player.sendMessage(`Destination supprimee : ${original.name}.`);
}

// ---------------------------------------------------------------
// DECLENCHEUR : utilisation de la boussole renommee
// ---------------------------------------------------------------
const lastUse = new Map();
const openMenus = new Set();

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;

  if (!player || player.typeId !== "minecraft:player" || !item) return;
  if (item.typeId !== CONFIG.ITEM_ID) return;
  if ((item.nameTag ?? "").trim().toLowerCase() !== CONFIG.ITEM_NAME) return;

  // Anti double declenchement (l'evenement peut partir deux fois)
  const now = system.currentTick;
  if (now - (lastUse.get(player.id) ?? -9999) < CONFIG.DEBOUNCE_TICKS) return;
  if (openMenus.has(player.id)) return;

  lastUse.set(player.id, now);
  openMenus.add(player.id);

  openMainMenu(player)
    .catch((e) => console.warn(`[SpawnMenu] erreur : ${e}`))
    .finally(() => openMenus.delete(player.id));
});

world.afterEvents.playerLeave.subscribe((event) => {
  lastUse.delete(event.playerId);
  openMenus.delete(event.playerId);
});
