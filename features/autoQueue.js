const { EmbedBuilder } = require("discord.js");
const { webState } = require("../server/state.js");
const { getRemainingTime } = require("../server/utils/schedule.js")
const { TEXT_CHANNELS, VOICE_CHANNELS } = require("../config/constants");
const db = require("../utils/db");

// === Config values ===
const VEHICLE_POST_CHANNEL_ID = TEXT_CHANNELS.AUTOQUEUE;
const VOICE_CHANNEL_IDS = Object.values(VOICE_CHANNELS || {});

// === State ===
let lastVehicleEmbed = null;
let lastUserVehiclesMap = new Map();

// -- Helpers --
function normalizeDiscordName(name) {
    if (!name) return "";
    return name.split("|")[0].split("-")[0].split("@")[0].trim().toLowerCase();
}

function sanitizeNameBackend(s) {
  if (!s) return "";
  let out = String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  out = out.replace(/\p{C}/gu, "");
  out = out.replace(/[^\p{L}\p{N}\s,\.\-'\(\)\/:\+&]/gu, "");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}


// --- Query vehicles from DB ---
function getVehiclesForUser(userOrMember, currentBR) {
  let queryName = "";
  let queryId = null;

  if (typeof userOrMember === "object" && userOrMember !== null) {
    queryId = userOrMember.id ? userOrMember.id.toString() : null;
    queryName = normalizeDiscordName(userOrMember.username || userOrMember.displayName || "");
  } else {
    queryName = normalizeDiscordName(userOrMember || "");
  }
  let brMin, brMax;

  if (parseFloat(currentBR) === 14.0) {
    brMin = 11.0;
    brMax = 14.0;
  }
  else {
    brMin = parseFloat(currentBR) - 1.0;
    brMax = parseFloat(currentBR);
  }

  // User query
  let userRow = null;
  if (queryId) {
    userRow = db.prepare(`SELECT * FROM users WHERE member_id = ?`).get(queryId);
  }
  if (!userRow && queryName) {
    userRow = db.prepare(`SELECT * FROM users WHERE LOWER(username) = ?`).get(queryName);
  }
  if (!userRow) return [];

  // Vehicle query & join
  let rows;
  if (brMin !== null && brMax !== null) {
    rows = db.prepare(
      `SELECT vehicle_name, br 
       FROM vehicles 
       WHERE user_id = ? 
         AND br BETWEEN ? AND ?`
    ).all(userRow.id, brMin, brMax);
  } else {
    rows = db.prepare(
      `SELECT vehicle_name, br 
       FROM vehicles 
       WHERE user_id = ?`
    ).all(userRow.id);
  }

  return rows.map(r => ({
    Vehicle: r.vehicle_name,
    BR: r.br.toFixed(1),
  }));
}

// Builds embed
function generateEmbedContent(userVehicleMap, currentBR) {
  const embed = new EmbedBuilder()
    .setTitle(`Auto Queue System - Current BR ${currentBR}`)
    .setColor("#00bfff")
    .setTimestamp()
    .setFooter({ text: "Tracked every 5 seconds" });

  for (const [username, vehicles] of userVehicleMap.entries()) {
    if (!vehicles?.length) continue;

    const grouped = {};
    vehicles.forEach(({ Vehicle, BR }) => {
      const cleanName = sanitizeNameBackend(Vehicle);
      if (!grouped[BR]) grouped[BR] = [];
      grouped[BR].push(cleanName);
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


// Sends/edits embed
async function updateVoiceVehicleEmbed(client, getCurrentBRColumn) {
  try {
    const userVehicleMap = new Map();
    const currentBR = getCurrentBRColumn();

    // Build map of users and their vehicles
    for (const channelId of VOICE_CHANNEL_IDS) {
      let channel;
      try {
        channel = await client.channels.fetch(channelId);
      } catch {
        continue;
      }
      if (!channel?.members) continue;

      for (const [, member] of channel.members) {
        if (member.user.bot) continue;

        const displayName = member.displayName ?? member.user.username;
        const normalizedName = normalizeDiscordName(displayName);
        const vehicles = getVehiclesForUser(normalizedName, currentBR);

        userVehicleMap.set(displayName, vehicles);
      }
    }

    // Compare state to avoid unnecessary updates
    const currentState = JSON.stringify([...userVehicleMap.entries()]);
    const lastState = JSON.stringify([...lastUserVehiclesMap.entries()]);

    if (currentState !== lastState) {
      const targetChannel = await client.channels.fetch(VEHICLE_POST_CHANNEL_ID).catch(() => null);
      if (!targetChannel) {
        console.error("[autoQueue] Target channel not found");
        return;
      }

      const sortedEntries = [...userVehicleMap.entries()].sort(
        (a, b) => a[1].length - b[1].length
      );
      const sortedMap = new Map(sortedEntries);
      const embed = generateEmbedContent(sortedMap, currentBR);

      // Send or update embed
      if (lastVehicleEmbed) {
        try {
          await lastVehicleEmbed.edit({ embeds: [embed] });
        } catch {
          lastVehicleEmbed = await targetChannel.send({ embeds: [embed] });
        }
      } else {
        lastVehicleEmbed = await targetChannel.send({ embeds: [embed] });
      }

      // Update webState with proper serialization (simple strings)
      webState.currentBR = currentBR;
      webState.brEndsIn = getRemainingTime(currentBR);
      // previous:
// webState.voiceUsers = [...userVehicleMap.entries()].map(([name, vehicles]) => ({ name, vehicles }));

// replace with:
      webState.voiceUsers = [...userVehicleMap.entries()].map(([name, vehicles]) => ({
        username: name,
        vehicles: vehicles.map(v => {
          if (!v) return null;
          if (typeof v === "object") {
           // format like "Name (BR)"
            const rawName = v.Vehicle ?? v.vehicle_name ?? v.name ?? "";
            const rawBR = v.BR ?? v.br ?? v.brRaw ?? "";
            return `${sanitizeNameBackend(rawName)}${rawBR ? ` (${Number(rawBR).toFixed(1)})` : ""}`;
          }
          // if it's already a string
         // parse out and sanitize the name portion (we can reuse client parsing too but simpler: sanitize whole string)
          return sanitizeNameBackend(String(v));
       }).filter(Boolean)
      }));


      lastUserVehiclesMap = userVehicleMap;
    }
  } catch (err) {
    console.error("[autoQueue] Error updating vehicle embed:", err);
  }
}

module.exports = {
  getVehiclesForUser,
  updateVoiceVehicleEmbed,
};
