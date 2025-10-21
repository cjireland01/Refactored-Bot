const { SlashCommandBuilder } = require("discord.js");
const db = require("../data/botdata.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addalt")
    .setDescription("Marks a user as an alt account")
    .addStringOption(option =>
      option.setName("username")
        .setDescription("The exact username of the alt")
        .setRequired(true)
    ),

  async execute(interaction) {
    const username = interaction.options.getString("username").trim();

    const user = db.prepare(`SELECT * FROM users WHERE LOWER(username) = ?`).get(username.toLowerCase());
    if (!user) {
      await interaction.reply({ content: `❌ User **${username}** not found in database.`, ephemeral: true });
      return;
    }

    db.prepare(`UPDATE users SET is_alt = 1 WHERE id = ?`).run(user.id);
    await interaction.reply({ content: `✅ **${username}** marked as an alt.`, ephemeral: true });
  }
};
