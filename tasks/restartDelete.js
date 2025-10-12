// tasks/restartDelete.js
const { TEXT_CHANNELS } = require("../config/constants");

module.exports = {
  async start(client) {
    client.once("ready", async () => {
      console.log("🧹 [RestartDelete] Starting selective cleanup...");

      const CHANNEL_IDS = [
        TEXT_CHANNELS.AUTOQUEUE,
        //TEXT_CHANNELS.ALTQUEUE,
        TEXT_CHANNELS.INTEL, 
      ];

      for (const id of CHANNEL_IDS) {
        try {
          const channel = await client.channels.fetch(id);
          if (!channel?.isTextBased()) continue;

          console.log(`[RestartDelete] Checking ${channel.name}...`);
          const messages = await channel.messages.fetch({ limit: 20 });
          const botMessages = messages.filter(m => m.author.id === client.user.id);

          for (const [, msg] of botMessages) {
            // Skip Intel messages with the "VCoM Auto SRE Stats" title
            const embed = msg.embeds?.[0];
            const title = embed?.title?.trim();

            if (
              title &&
              title.includes("VCoM Auto SRE Stats")
            ) {
              console.log(`[RestartDelete] Preserving Intel message: "${title}"`);
              continue; // skip deleting this one
            }

            // Delete anything else (AutoQueue, AltQueue, old Intel embeds)
            await msg.delete().catch(() => {});
          }

          console.log(`[RestartDelete] Processed ${botMessages.size} bot messages in ${channel.name}`);
        } catch (err) {
          console.error(`[RestartDelete] Failed to clean channel ${id}:`, err.message);
        }
      }

      console.log("✅ [RestartDelete] Cleanup complete.");
    });
  }
};
