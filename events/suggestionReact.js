import { Events } from "discord.js";
import { TEXT_CHANNELS } from "../config/constants.js";

// Add 👍 👎 to every message in the Suggestions channel
export default {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.channelId !== TEXT_CHANNELS.SUGGESTIONS) return;
        try {
            await message.react("👍");
            await message.react("👎");
        } catch (error) {
            console.error("Failed to add reactions:", error);
        }
    },
};
