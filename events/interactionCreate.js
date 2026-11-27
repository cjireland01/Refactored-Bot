import { Events, MessageFlags } from "discord.js";

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) {
      await interaction.reply({ content: "Unknown command.", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error("[interactionCreate] command error:", err);
      if (!interaction.replied) {
        try {
          await interaction.reply({
            content: "There was an error while executing this command.",
            flags: MessageFlags.Ephemeral,
          });
        } catch {}
      }
    }
  },
};
