import "general/index"
import "moderation/index"
import "customization/index"
import "misc/index"
import "player/index"


/*

Copyright and Terms of Use
© 2025 Kaden Collier / Petstorebuffet. All Rights Reserved.

By downloading and using this Minecraft Bedrock Addon, you agree to the following terms and conditions.

Permitted Use:
Personal Use: You may use this addon in your single-player worlds.
Server Use: You may use and install this addon on private or public multiplayer servers.
Modification: You may remix, modify, or tweak the addon's code and assets strictly for personal use or for use on your specific server.
Content Creation: You may record videos or stream gameplay using this addon, provided you give clear credit and link back to the official sources below.

Strictly Prohibited:
No Redistribution: You may not upload, re-upload, or distribute the original addon files on any website, forum, app, or platform.
No Sharing Modified Versions: You may not publish or distribute your remixed or modified versions of this addon anywhere. Modifications must remain private to you or your server.
No Direct Linking: You may not share direct download links (e.g., MediaFire, Drive) to the addon files with others.
No Commercialization: You may not monetize the addon files or place them behind paywalls or link shorteners.

Sharing the Addon
If you wish to share this addon with friends, your community, or in a video, you must direct them to my official channels.
Official Links:
Discord Server: https://discord.gg/y7kVYwj56J
Official Profile: https://www.curseforge.com/members/petstorebuffet/projects

Attribution
If you use this addon on a server, in a video, or in any public-facing way, credit must be clearly provided to Petstorebuffet.

*/

import { world, system } from "@minecraft/server";
import { commandRegistry } from "./commands/index.js";

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const inventory = player.getComponent("minecraft:inventory")?.container;
        const cursor = player.getComponent("minecraft:cursor_inventory");
        if (!inventory) continue;
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item?.getLore()?.[0]?.includes("ui_item")) {
                inventory.setItem(i, undefined);
            }
        }
        if (cursor?.item?.getLore()?.[0]?.includes("ui_item")) {
            cursor.clear();
        }
    }
}, 40);

const COMMAND_PREFIX = "sh:";

system.beforeEvents.startup.subscribe((init) => {
  for (const cmd of commandRegistry) {
    try {
      const cmdName = `${COMMAND_PREFIX}${cmd.data.name}`;

      const options = [
        ...(cmd.data.mandatoryParameters ?? []),
        ...(cmd.data.optionalParameters ?? [])
      ];

      const enums = cmd.data.enums ?? new Map();

      for (const [enumName, values] of enums) {
        init.customCommandRegistry.registerEnum(enumName, values);
      }

      init.customCommandRegistry.registerCommand(
        {
          name: cmdName,
          description: cmd.data.description,
          permissionLevel: cmd.data.permissionLevel,
          cheatsRequired: cmd.data.cheatsRequired,
          options: options
        },
        (origin, ...rawArgs) => {
          let base = null;
          switch (origin.sourceType) {
            case "Entity":
              base = origin.sourceEntity;
              break;
            case "Block":
              base = origin.sourceBlock;
              break;
            case "NPCDialogue":
              base = origin.sourceInitiator;
              break;
            case "Server":
              base = origin.sourceEntity;
              break;
          }

          const finalArgs = options.map((opt, idx) => rawArgs[idx]);

          return cmd.run(system, { source: base, sourceType: origin.sourceType }, finalArgs);
        }
      );
    }
    catch (err) {
    }
  }
});
