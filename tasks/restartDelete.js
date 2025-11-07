const { TEXT_CHANNELS } = require("../config/constants");
const { updateAltTrackerEmbed } = require("../features/altQueue");
const { runAutoQueue } = require("../tasks/scheduleAutoQueue");
const { getCurrentBRColumn } = require("../tasks/scheduleAutoQueue");

module.exports = {
  async start(client) {
    client.once("ready", async () => {
      console.log("🧹 [RestartDelete] Starting selective cleanup...");

      const CHANNEL_IDS = [
        TEXT_CHANNELS.AUTOQUEUE,
        TEXT_CHANNELS.ALTQUEUE,
        TEXT_CHANNELS.INTEL,
      ];

      for (const id of CHANNEL_IDS) {
        try {
          const channel = await client.channels.fetch(id);
          if (!channel?.isTextBased()) continue;

          console.log(`[RestartDelete] Checking ${channel.name}...`);
          const messages = await channel.messages.fetch({ limit: 50 });
          const botMessages = messages.filter(m => m.author.id === client.user.id);

          for (const [, msg] of botMessages) {
            const embed = msg.embeds?.[0];
            const title = embed?.title?.trim();

            if (title && title.includes("VCoM Auto SRE Stats")) {
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

      // Post altQueue first
      try {
        console.log("📋 [RestartDelete] Regenerating AltQueue embed...");
        await updateAltTrackerEmbed(client, getCurrentBRColumn);
        console.log("✅ [RestartDelete] AltQueue embed regenerated.");
      } catch (err) {
        console.error("❌ [RestartDelete] Failed to regenerate AltQueue embed:", err);
      }

      // Post autoQueue second
      try {
        console.log("📋 [RestartDelete] Regenerating AutoQueue embed...");
        await runAutoQueue(client);
        console.log("✅ [RestartDelete] AutoQueue embed regenerated.");
      } catch (err) {
        console.error("❌ [RestartDelete] Failed to regenerate AutoQueue embed:", err);
      }
    });
  },
};
