import { EmbedBuilder } from "discord.js";
import { TEXT_CHANNELS, VOICE_CHANNELS, QUEUE } from "../config/constants.js";
import { getCurrentBR } from "../utils/br.js";
import {
  getVehiclesForUsername,
  sanitizeVehicleName,
  addVehicleFields,
} from "../utils/vehicles.js";
import { setVoiceUsers } from "../server/state.js";
import { isSheetMetaActive } from "../utils/metaSheet.js";

const VOICE_CHANNEL_IDS = Object.values(VOICE_CHANNELS);

// === State ===
let lastVehicleEmbed = null;
let lastStateKey = "[]";

// "Name | tag" / "Name-tag" / "Name@psn" -> "name"
function normalizeDiscordName(name) {
  if (!name) return "";
  return name.split("|")[0].split("-")[0].split("@")[0].trim().toLowerCase();
}

function buildEmbed(userVehicleMap, currentBR) {
  const embed = new EmbedBuilder()
    .setTitle(`Auto Queue System - Current BR ${currentBR}`)
    .setColor("#00bfff")
    .setTimestamp()
    .setFooter({
      text: isSheetMetaActive()
        ? "Meta vehicles only - updates when someone joins or leaves voice"
        : "Updates when someone joins or leaves voice",
    });

  const skipped = addVehicleFields(embed, userVehicleMap, {
    emptyText: isSheetMetaActive() ? "No meta vehicles" : undefined,
  });
  if (skipped > 0) embed.setDescription(`+${skipped} more not shown`);
  return embed;
}

// What the website shows: "Vehicle Name (10.7)" strings per user
function toWebUsers(userVehicleMap) {
  return [...userVehicleMap.entries()].map(([name, vehicles]) => ({
    username: name,
    vehicles: vehicles.map(
      ({ Vehicle, BR }) => `${sanitizeVehicleName(Vehicle)}${BR ? ` (${Number(BR).toFixed(1)})` : ""}`
    ),
  }));
}

async function collectVoiceUsers(client, currentBR) {
  const userVehicleMap = new Map();

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
      userVehicleMap.set(displayName, getVehiclesForUsername(normalizeDiscordName(displayName), currentBR));
    }
  }
  return userVehicleMap;
}

async function postOrEditEmbed(targetChannel, embed) {
  if (lastVehicleEmbed) {
    try {
      await lastVehicleEmbed.edit({ embeds: [embed] });
      return;
    } catch {
      // message was deleted - fall through and post a new one
    }
  }
  lastVehicleEmbed = await targetChannel.send({ embeds: [embed] });
}

async function updateOnce(client) {
  const currentBR = getCurrentBR();
  const userVehicleMap = await collectVoiceUsers(client, currentBR);

  // Skip Discord and website updates when nothing changed
  const stateKey = JSON.stringify([...userVehicleMap.entries()]);
  if (stateKey === lastStateKey) return;

  const targetChannel = await client.channels.fetch(TEXT_CHANNELS.AUTOQUEUE).catch(() => null);
  if (!targetChannel) {
    console.error("[autoQueue] Target channel not found");
    return;
  }

  // Users with the fewest vehicles first (unchanged behaviour)
  const sorted = new Map([...userVehicleMap.entries()].sort((a, b) => a[1].length - b[1].length));
  await postOrEditEmbed(targetChannel, buildEmbed(sorted, currentBR));

  setVoiceUsers(toWebUsers(userVehicleMap));
  lastStateKey = stateKey;
}

// --- Public API ---

let running = false;
let rerun = false;
let timer = null;

/**
 * Refresh the queue now. If a refresh is already running, one more run is
 * queued behind it, so two updates can never overlap and double-post.
 */
export async function refreshVoiceQueue(client) {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    do {
      rerun = false;
      try {
        await updateOnce(client);
      } catch (err) {
        console.error("[autoQueue] Error updating vehicle embed:", err);
      }
    } while (rerun);
  } finally {
    running = false;
  }
}

/** Refresh shortly from now; several calls in quick succession become one. */
export function requestQueueRefresh(client, delayMs = QUEUE.DEBOUNCE_MS) {
  clearTimeout(timer);
  timer = setTimeout(() => refreshVoiceQueue(client), delayMs);
}
