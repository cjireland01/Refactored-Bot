import db from "../utils/db.js";

import { updateAltTrackerEmbed } from "../features/altQueue.js";
import { updateVoiceVehicleEmbed } from "../features/autoQueue.js";

export function getCurrentBRColumn() {
  try {
    const nowUtc = new Date();
    const nowEst = new Date(nowUtc.getTime() - 5 * 60 * 60 * 1000); // EST

    const schedule = db.prepare(`
      SELECT br, start 
      FROM br_schedule 
      ORDER BY start ASC
    `).all();

    for (let i = schedule.length - 1; i >= 0; i--) {
      const startDate = new Date(`${schedule[i].start}T05:00:00-05:00`);
      if (nowEst >= startDate) {
        return Number(schedule[i].br).toFixed(1);
      }
    }

    return Number(14.0).toFixed(1); // default if nothing matches
  } catch (err) {
    console.error("[getCurrentBRColumn] Error:", err);
    return Number(14.0).toFixed(1);
  }
}

async function runAutoQueue(client) {
    try {
        await updateVoiceVehicleEmbed(client, getCurrentBRColumn);
    } catch (err) {
        console.error("[AutoQueue] Failed to run manually:", err);
    }
}

export function start(client) {
    client.once("clientReady", () => {
        updateAltTrackerEmbed(client, getCurrentBRColumn);

        setInterval(() => updateVoiceVehicleEmbed(client, getCurrentBRColumn), 5000); // Check for updates every 5 seconds
        setInterval(() => updateAltTrackerEmbed(client, getCurrentBRColumn), 1000 * 60 * 60 * 24); // Update every 24 hours
    });
}

export { runAutoQueue };

