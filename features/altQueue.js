import { EmbedBuilder } from "discord.js";
import { TEXT_CHANNELS } from "../config/constants.js";
import { getCurrentBR } from "../utils/br.js";
import { getAltUsers, getVehiclesForUsername, addVehicleFields } from "../utils/vehicles.js";

// === State ===
let lastAltTracker = null;

function buildEmbed(userVehicleMap, currentBR) {
  const embed = new EmbedBuilder()
    .setTitle(`Alt Tracker - BR: ${currentBR}`)
    .setColor("#00ff7f")
    .setTimestamp()
    .setFooter({ text: "Request access & verify squadron membership" });

  const skipped = addVehicleFields(embed, userVehicleMap);

  if (!embed.data.fields?.length) {
    embed.setDescription("No active alt vehicles found for this BR range.");
  } else if (skipped > 0) {
    embed.setDescription(`+${skipped} more not shown`);
  }
  return embed;
}

/** Update (or post) the Alt Tracker embed in Discord */
export async function updateAltTrackerEmbed(client) {
  try {
    const currentBR = getCurrentBR();
    const altUsers = getAltUsers();

    if (!altUsers.length) {
      console.log("[altQueue] No alt users found in database.");
      return;
    }

    const userVehicleMap = new Map(
      altUsers.map(({ username }) => [username, getVehiclesForUsername(username, currentBR)])
    );

    const targetChannel = await client.channels.fetch(TEXT_CHANNELS.ALTQUEUE);
    if (!targetChannel) {
      console.error(`[altQueue] Channel ${TEXT_CHANNELS.ALTQUEUE} not found`);
      return;
    }

    const embed = buildEmbed(userVehicleMap, currentBR);

    if (lastAltTracker) {
      try {
        await lastAltTracker.edit({ embeds: [embed] });
        return;
      } catch {
        // message was deleted - post a new one
      }
    }
    lastAltTracker = await targetChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[altQueue] Error updating alt vehicle embed:", err);
  }
}
