import { Events } from "discord.js";
import { VOICE_CHANNELS } from "../config/constants.js";
import { requestQueueRefresh } from "../features/autoQueue.js";

const tracked = new Set(Object.values(VOICE_CHANNELS));

// Someone joined, left or moved between voice channels -> refresh the queue.
// (Mute/deafen/stream changes also fire this event, but they only trigger a
// cheap check that finds nothing changed.)
export default {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState, client) {
    if (tracked.has(oldState.channelId) || tracked.has(newState.channelId)) {
      requestQueueRefresh(client);
    }
  },
};
