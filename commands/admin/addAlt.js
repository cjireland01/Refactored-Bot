const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addalt")
    .setDescription("Mark a user (by username) as an alt account in the DB")
    .addStringOption(opt => opt.setName("username").setDescription("Username in the users table").setRequired(true)),

  async execute(interaction) {
    // permission check (admins only)
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

    db.prepare("UPDATE users SET is_alt = 1 WHERE id = ?").run(user.id);
    await interaction.reply({ content: `✅ "${user.username}" marked as an alt.`, ephemeral: true });

    // optional: emit an event so other parts of your bot can react
    try { interaction.client.emit("altListChanged", { action: "add", username: user.username }); } catch(e) {}
  }
};
