const { EmbedBuilder } = require("discord.js");
const { TEXT_CHANNELS, ALT_USERS } = require("../config/constants");
const db = require("../utils/db");

// === Config ===
const ALT_CHANNEL_ID = TEXT_CHANNELS.ALTQUEUE;

// === State ===
let lastAltTracker = null;

// --- Helpers ---
function getVehiclesForAlt(username, currentBR) {
  const brFloat = parseFloat(currentBR);
  const brMin = isNaN(brFloat) ? null : brFloat - 1.0;
  const brMax = isNaN(brFloat) ? null : brFloat;

  const userRow = db
    .prepare(`SELECT * FROM users WHERE LOWER(username) = ?`)
    .get(username.toLowerCase());

  if (!userRow) {
    return [];
  }

  let rows;
  if (brMin !== null && brMax !== null) {
    rows = db
      .prepare(
        `SELECT vehicle_name, br 
         FROM vehicles 
         WHERE user_id = ? 
           AND br BETWEEN ? AND ?`
      )
      .all(userRow.id, brMin, brMax);
  } else {
    rows = db
      .prepare(
        `SELECT vehicle_name, br 
         FROM vehicles 
         WHERE user_id = ?`
      )
      .all(userRow.id);
  }

  return rows.map(r => ({
    Vehicle: r.vehicle_name,
    BR: r.br.toFixed(1),
  }));
}

function generateAltUserEmbedContent(userVehicleMap, currentBR) {
  const embed = new EmbedBuilder()
    .setTitle(`Alt Tracker - BR: ${currentBR}`)
    .setColor("#00ff7f")
    .setTimestamp()
    .setFooter({ text: "Request access & verify squadron membership" });

  for (const [username, vehicles] of userVehicleMap.entries()) {
    if (!vehicles?.length) continue;

    const grouped = {};
    vehicles.forEach(({ Vehicle, BR }) => {
      if (!grouped[BR]) grouped[BR] = [];
      grouped[BR].push(Vehicle);
    });

    const sortedBRs = Object.keys(grouped).sort((a, b) => parseFloat(b) - parseFloat(a));
    let formatted = sortedBRs.map(br => `${br} - ${grouped[br].join(", ")}`).join("\n");

    if (formatted.length > 1000) {
      formatted = formatted.slice(0, 997) + "...";
      formatted += "\n+ some not shown";
    }

    embed.addFields({ name: username, value: formatted, inline: false });
  }

  return embed;
}

async function updateAltTrackerEmbed(client, getCurrentBRColumn) {
  try {
    const currentBR = getCurrentBRColumn();
    const userVehicleMap = new Map();

    ALT_USERS.forEach(username => {
      const userVehicles = getVehiclesForAlt(username, currentBR);
      userVehicleMap.set(username, userVehicles);
    });

    const targetChannel = await client.channels.fetch(ALT_CHANNEL_ID);
    if (!targetChannel) {
      console.error(`[altVehicles] Channel ${ALT_CHANNEL_ID} not found`);
      return;
    }

    const embed = generateAltUserEmbedContent(userVehicleMap, currentBR);

    if (lastAltTracker) {
      try {
        await lastAltTracker.edit({ embeds: [embed] });
      } catch {
        lastAltTracker = await targetChannel.send({ embeds: [embed] });
      }
    } else {
      lastAltTracker = await targetChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("[altVehicles] Error updating alt vehicle embed:", err.message);
  }
}

module.exports = { updateAltTrackerEmbed };
