import { Events } from "discord.js";
import { QUEUE } from "../config/constants.js";
import { updateAltTrackerEmbed } from "../features/altQueue.js";
import { refreshVoiceQueue } from "../features/autoQueue.js";

const ONE_DAY = 1000 * 60 * 60 * 24;

export function start(client) {
  client.once(Events.ClientReady, () => {
    // The queue itself updates from voice events (events/voiceStateUpdate.js).
    // This sweep only catches things events can't, like a BR change at its start time.
    setInterval(() => refreshVoiceQueue(client), QUEUE.SAFETY_SWEEP_MS);

    // Keep the alt tracker's BR window current
    setInterval(() => updateAltTrackerEmbed(client), ONE_DAY);
  });
}
