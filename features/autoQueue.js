const { EmbedBuilder } = require("discord.js");
const path = require("path");
const XLSX = require("xlsx");
const { webState, getRemainingTime } = require("../server");
const { TEXT_CHANNELS, VOICE_CHANNELS, ALT_USERS } = require("../config/constants");

// === Load Excel ===
const workbook = XLSX.readFile(path.join(__dirname, "../data/userVehicles.xlsx"));
const worksheet = workbook.Sheets["matched_vehicles"];
const data = XLSX.utils.sheet_to_json(worksheet);

// === Config values ===
const VEHICLE_POST_CHANNEL_ID = TEXT_CHANNELS.AUTOQUEUE;
const ALT_CHANNEL_ID = TEXT_CHANNELS.ALTQUEUE;
const VOICE_CHANNELS_IDS = Object.values(VOICE_CHANNELS);

// === State ===
let lastVehicleEmbed = null;
let lastUserVehiclesMap = new Map();
let lastAltTracker = null;

// --- Helpers ---
function extractNameBeforePipe(name) {
    if (!name) return "";
    return name.split("|")[0].split("-")[0].trim().toLowerCase();
}

function normalizeNameRaw(s) {
    if (!s && s !== 0) return "";
    let str = s.toString();
    str = str.replace(/\u00A0/g, " ");
    str = str.split("|")[0].split("-")[0].trim();
    str = str.replace(/@.*$/, "");
    return str.toLowerCase().trim();
}

function cleanBRKey(key) {
    if (key === undefined || key === null) return "";
    let s = key.toString();
    return s.replace(/[^\d.]/g, "").trim();
}

// --- Main Functions ---

function getVehiclesForUser(userOrMember, currentBR) {
    const results = [];
    let queryId = null;
    let queryName = "";
    let queryDisplay = "";

    if (typeof userOrMember === "object" && userOrMember !== null) {
        queryId = userOrMember.id ? userOrMember.id.toString() : null;
        queryName = normalizeNameRaw(userOrMember.username || "");
        queryDisplay = normalizeNameRaw(userOrMember.displayName || userOrMember.nickname || "");
    } else {
        queryName = normalizeNameRaw(userOrMember || "");
    }

    const brFloat = parseFloat(currentBR);
    const brMin = isNaN(brFloat) ? null : (brFloat - 1.0);
    const brMax = isNaN(brFloat) ? null : brFloat;

    data.forEach(row => {
        const rawRowName = row.Username ?? row.username ?? "";
        const rowName = normalizeNameRaw(rawRowName);
        const rowMemberID = row.MemberID ? String(row.MemberID).trim() : null;

        let matched = false;
        if (queryId && rowMemberID && queryId === rowMemberID) matched = true;
        else if (rowName && queryName && rowName === queryName) matched = true;
        else if (rowName && queryDisplay && rowName === queryDisplay) matched = true;

        if (!matched) return;

        Object.entries(row).forEach(([colKey, value]) => {
            if (["Username", "username", "MemberID", "memberid"].includes(colKey)) return;

            const cleanKey = cleanBRKey(colKey);
            if (!cleanKey) return;
            const br = parseFloat(cleanKey);
            if (isNaN(br)) return;
            if (!value) return;

            const cellStr = String(value).trim();
            if (!cellStr.length) return;

            if (brMin !== null && brMax !== null) {
                if (!(br >= brMin && br <= brMax)) return;
            }

            const vehicles = cellStr.split(/[,;/\|\n\r]+/).map(v => v.trim()).filter(Boolean);
            vehicles.forEach(v => results.push({ Vehicle: v, BR: br.toFixed(1), sourceCol: colKey }));
        });
    });

    return results;
}

function getVehiclesForAlt(username, currentBR) {
    const brMin = parseFloat(currentBR) - 1.0;
    const brMax = parseFloat(currentBR);
    const result = [];

    console.log(`\x1b[36m[DEBUG] Looking for user in Excel: ${username}\x1b[0m`);

    data.forEach(row => {
      const rowName = row.Username?.toString().trim().toLowerCase();

      if (rowName === username.toLowerCase()) {
          Object.entries(row).forEach(([key, value]) => {
              const br = parseFloat(key);
              if (!isNaN(br) && br >= brMin && br <= brMax && typeof value === "string") {
                  const vehicles = value.split(',').map(v => v.trim());
                  vehicles.forEach(vehicle => {
                      result.push({ Vehicle: vehicle, BR: br.toFixed(1) });
                  });
              }
          });
      }
  });

  if (result.length === 0) {
      console.warn(`\x1b[33m[WARNING] No vehicles found in Excel for user: ${username}\x1b[0m`);
  }

  return result;
}

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

async function updateVoiceVehicleEmbed(client, getCurrentBRColumn) {
    try {
        let userVehicleMap = new Map();
        const currentBR = getCurrentBRColumn();

        for (const [, guild] of client.guilds.cache) {
            for (const channelId of VOICE_CHANNELS_IDS) {
                const channel = guild.channels.cache.get(channelId);
                if (!channel?.members) continue;

                for (const [, member] of channel.members) {
                    if (member.user.bot) continue;

                    const rawDisplayName = member.displayName;
                    const simplifiedName = extractNameBeforePipe(rawDisplayName);
                    const userVehicles = getVehiclesForUser(simplifiedName, currentBR);
                    userVehicleMap.set(rawDisplayName, userVehicles);
                }
            }
        }

        const currentState = JSON.stringify([...userVehicleMap.entries()]);
        const lastState = JSON.stringify([...lastUserVehiclesMap.entries()]);

        if (currentState !== lastState) {
            const targetChannel = await client.channels.fetch(VEHICLE_POST_CHANNEL_ID);
            const embed = generateEmbedContent(userVehicleMap, currentBR);

            if (lastVehicleEmbed) {
                await lastVehicleEmbed.edit({ embeds: [embed] });
            } else {
                lastVehicleEmbed = await targetChannel.send({ embeds: [embed] });
            }

            webState.currentBR = currentBR;
            webState.brEndsIn = getRemainingTime(currentBR);
            webState.voiceUsers = [...userVehicleMap.entries()].map(([name, vehicles]) => ({ name, vehicles }));

            lastUserVehiclesMap = userVehicleMap;
        }
    } catch (err) {
        console.error("Error updating vehicle embed:", err);
    }
}

function generateAltUserEmbedContent(userVehicleMap, currentBR) {
    const embed = new EmbedBuilder()
        .setTitle(`Alt Tracker - BR: ${currentBR}`)
        .setColor("#00ff7f")
        .setTimestamp()
        .setFooter({ text: "Request access & verify squadron membership" });

    for (const [username, vehicles] of userVehicleMap.entries()) {
        if (!vehicles || vehicles.length === 0) continue;

        const groupedVehicles = {};
        vehicles.forEach(({ Vehicle, BR }) => {
            if (!groupedVehicles[BR]) groupedVehicles[BR] = [];
            groupedVehicles[BR].push(Vehicle);
        });

        const sortedBRs = Object.keys(groupedVehicles).sort((a, b) => parseFloat(b) - parseFloat(a));
        let formatted = sortedBRs.map(br => `${br} - ${groupedVehicles[br].join(", ")}`).join("\n");

        if (formatted.length > 1000) {
            formatted = formatted.slice(0, 997) + "...";
            formatted += "\n+ some not shown";
        }

        embed.addFields({
            name: username,
            value: formatted,
            inline: false
        });
    }

    return embed;
}


async function updateAltTrackerEmbed(client, getCurrentBRColumn) {
  try {
      const currentBR = getCurrentBRColumn();
      console.log(`\x1b[36m[DEBUG] Current BR for ALT Tracker: ${currentBR}\x1b[0m`);
      
      const userVehicleMap = new Map();

      ALT_USERS.forEach(username => {
          const userVehicles = getVehiclesForAlt(username, currentBR);
          
          if (userVehicles.length > 0) {
              console.log(`\x1b[32m[DEBUG] User: ${username} - Vehicles Found: ${JSON.stringify(userVehicles)}\x1b[0m`);
          } else {
              console.warn(`\x1b[33m[WARNING] No vehicles found for user: ${username}\x1b[0m`);
          }
          
          userVehicleMap.set(username, userVehicles);
      });

      if (userVehicleMap.size === 0) {
          console.warn("\x1b[33m[WARNING] No vehicles found for any of the ALT users.\x1b[0m");
      }

      const targetChannel = await client.channels.fetch(ALT_CHANNEL_ID);
      const embed = generateAltUserEmbedContent(userVehicleMap, currentBR);

      if (lastAltTracker) {
          await lastAltTracker.edit({ embeds: [embed] });
      } else {
          lastAltTracker = await targetChannel.send({ embeds: [embed] });
      }

  } catch (err) {
      console.error("[ERROR] Error updating username vehicle embed:", err.message);
  }
}


module.exports = { updateVoiceVehicleEmbed, updateAltTrackerEmbed };
