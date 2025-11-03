const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("alt")
    .setDescription("Manage alt accounts in the database")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Mark a user as an alt account")
        .addStringOption(opt =>
          opt.setName("username")
            .setDescription("The username to mark as alt")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Unmark a user as an alt account")
        .addStringOption(opt =>
          opt.setName("username")
            .setDescription("The username to unmark as alt")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const username = interaction.options.getString("username").trim();

    try {
      const userRow = db.prepare("SELECT * FROM users WHERE LOWER(username) = ?").get(username.toLowerCase());
      if (!userRow) {
        await interaction.reply({ content: `❌ User \`${username}\` not found in database.`, ephemeral: true });
        return;
      }

      if (sub === "add") {
        db.prepare("UPDATE users SET is_alt = 1 WHERE LOWER(username) = ?").run(username.toLowerCase());
        await interaction.reply({ content: `✅ \`${username}\` marked as alt.`, ephemeral: true });
      } else if (sub === "remove") {
        db.prepare("UPDATE users SET is_alt = 0 WHERE LOWER(username) = ?").run(username.toLowerCase());
        await interaction.reply({ content: `✅ \`${username}\` unmarked as alt.`, ephemeral: true });
      }
    } catch (err) {
      console.error("Error in /alt command:", err);
      await interaction.reply({ content: "⚠️ Something went wrong while updating the alt list.", ephemeral: true });
    }
  },
};
