module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) {
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
      return;
    }

    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error("[interactionCreate] command error:", err);
      if (!interaction.replied) {
        try {
          await interaction.reply({ content: "There was an error while executing this command.", ephemeral: true });
        } catch {}
      }
    }
  }
};
