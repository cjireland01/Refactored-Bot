import { Events } from "discord.js";
import { TEXT_CHANNELS } from "../config/constants.js";
import { updateAltTrackerEmbed } from "../features/altQueue.js";
import { refreshVoiceQueue } from "../features/autoQueue.js";

// On every start, clear the bot's old messages (except the saved stats
// reports) so the embeds don't pile up, then post fresh ones.
const PRESERVE_TITLE = "VCoM Auto SRE Stats";

export function start(client) {
  client.once(Events.ClientReady, async () => {
    console.log("🧹 [RestartDelete] Starting selective cleanup...");

    const channelIds = [TEXT_CHANNELS.AUTOQUEUE, TEXT_CHANNELS.ALTQUEUE, TEXT_CHANNELS.INTEL];

    for (const id of channelIds) {
      try {
        const channel = await client.channels.fetch(id);
        if (!channel?.isTextBased()) continue;

        console.log(`[RestartDelete] Checking ${channel.name}...`);
        const messages = await channel.messages.fetch({ limit: 50 });
        const botMessages = messages.filter((m) => m.author.id === client.user.id);

        for (const [, msg] of botMessages) {
          const title = msg.embeds?.[0]?.title?.trim();
          if (title && title.includes(PRESERVE_TITLE)) {
            console.log(`[RestartDelete] Preserving Intel message: "${title}"`);
            continue;
          }
          await msg.delete().catch(() => {});
        }

        console.log(`[RestartDelete] Processed ${botMessages.size} bot messages in ${channel.name}`);
      } catch (err) {
        console.error(`[RestartDelete] Failed to clean channel ${id}:`, err.message);
      }
    }

    console.log("✅ [RestartDelete] Cleanup complete.");

    // Alt tracker first, then the auto queue
    try {
      await updateAltTrackerEmbed(client);
      console.log("✅ [RestartDelete] AltQueue embed regenerated.");
    } catch (err) {
      console.error("❌ [RestartDelete] Failed to regenerate AltQueue embed:", err);
    }

    try {
      await refreshVoiceQueue(client);
      console.log("✅ [RestartDelete] AutoQueue embed regenerated.");
    } catch (err) {
      console.error("❌ [RestartDelete] Failed to regenerate AutoQueue embed:", err);
    }
  });
}
