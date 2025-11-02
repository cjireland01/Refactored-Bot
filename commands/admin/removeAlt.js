const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removealt")
    .setDescription("Remove a user (by username) from the alt list")
    .addStringOption(opt => opt.setName("username").setDescription("Username in the users table").setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.permissions.has("Administrator")) {
      await interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      return;
    }

    const username = interaction.options.getString("username").trim();
    const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = ?").get(username.toLowerCase());
    if (!user) {
      await interaction.reply({ content: `❌ User "${username}" not found in database.`, ephemeral: true });
      return;
    }

    db.prepare("UPDATE users SET is_alt = 0 WHERE id = ?").run(user.id);
    await interaction.reply({ content: `✅ "${user.username}" removed from the alt list.`, ephemeral: true });

    try { interaction.client.emit("altListChanged", { action: "remove", username: user.username }); } catch(e) {}
  }
};
