const { EmbedBuilder } = require("discord.js");
const { TEXT_CHANNELS } = require("../config/constants");
const db = require("../utils/db");

// === Config ===
const ALT_CHANNEL_ID = TEXT_CHANNELS.ALTQUEUE;

// === State ===
let lastAltTracker = null;

// --- Helpers ---

/**
 * Fetch all usernames marked as alt accounts from the database
 */
function getAltUsersFromDB() {
  try {
    const rows = db.prepare("SELECT username FROM users WHERE is_alt = 1").all();
    return rows.map(r => r.username);
  } catch (err) {
    console.error("[altQueue] Failed to fetch alt users:", err);
    return [];
  }
}

/**
 * Fetch vehicle list for a specific alt user within the BR range
 */
function getVehiclesForAlt(username, currentBR) {
 let brMin, brMax;

  if (parseFloat(currentBR) === 14.0) {
    brMin = 11.0;
    brMax = 14.0;
  }
  else {
    brMin = parseFloat(currentBR) - 1.0;
    brMax = parseFloat(currentBR);
  }

  const userRow = db
    .prepare(`SELECT * FROM users WHERE LOWER(username) = ?`)
    .get(username.toLowerCase());

  if (!userRow) return [];

  let rows;
  if (brMin !== null && brMax !== null) {
    rows = db
      .prepare(
        `SELECT vehicle_name, br
         FROM vehicles
         WHERE user_id = ?
           AND br BETWEEN ? AND ?
         ORDER BY br DESC`
      )
      .all(userRow.id, brMin, brMax);
  } else {
    rows = db
      .prepare(
        `SELECT vehicle_name, br
         FROM vehicles
         WHERE user_id = ?
         ORDER BY br DESC`
      )
      .all(userRow.id);
  }

  return rows.map(r => ({
    Vehicle: sanitizeVehicleName(r.vehicle_name),
    BR: r.br.toFixed(1),
  }));
}

/**
 * Remove unwanted symbols and whitespace from vehicle names
 */
function sanitizeVehicleName(name) {
  if (!name) return "";
  return name
    .replace(/[^\p{L}\p{N}\s\-\.\(\)\/]/gu, "") 
    .trim();
}

/**
 * Generate embed content showing all alt users and their vehicles
 */
function generateAltUserEmbedContent(userVehicleMap, currentBR) {
  const embed = new EmbedBuilder()
    .setTitle(`Alt Tracker - BR: ${currentBR}`)
    .setColor("#00ff7f")
    .setTimestamp()
    .setFooter({ text: "Request access & verify squadron membership" });

  for (const [username, vehicles] of userVehicleMap.entries()) {
    if (!vehicles?.length) continue;

    // Group vehicles by BR
    const grouped = {};
    vehicles.forEach(({ Vehicle, BR }) => {
      if (!grouped[BR]) grouped[BR] = [];
      grouped[BR].push(Vehicle);
    });

    const sortedBRs = Object.keys(grouped).sort((a, b) => parseFloat(b) - parseFloat(a));
    let formatted = sortedBRs.map(br => `${br} - ${grouped[br].join(", ")}`).join("\n");

    // Prevent exceeding Discord embed limits
    if (formatted.length > 1000) {
      formatted = formatted.slice(0, 997) + "...";
      formatted += "\n+ some not shown";
    }

    embed.addFields({ name: username, value: formatted, inline: false });
  }

  if (embed.data.fields?.length === 0) {
    embed.setDescription("No active alt vehicles found for this BR range.");
  }

  return embed;
}

/**
 * Update (or post) the Alt Tracker embed in Discord
 */
async function updateAltTrackerEmbed(client, getCurrentBRColumn) {
  try {
    const currentBR = getCurrentBRColumn();
    const altUsers = getAltUsersFromDB();

    if (!altUsers.length) {
      console.log("[altQueue] No alt users found in database.");
      return;
    }

    const userVehicleMap = new Map();
    altUsers.forEach(username => {
      const userVehicles = getVehiclesForAlt(username, currentBR);
      userVehicleMap.set(username, userVehicles);
    });

    const targetChannel = await client.channels.fetch(ALT_CHANNEL_ID);
    if (!targetChannel) {
      console.error(`[altQueue] Channel ${ALT_CHANNEL_ID} not found`);
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
    console.error("[altQueue] Error updating alt vehicle embed:", err);
  }
}

module.exports = { updateAltTrackerEmbed };
