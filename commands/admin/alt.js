const { SlashCommandBuilder } = require("discord.js");
const db = require("../../utils/db");
const { updateAltTrackerEmbed } = require("../../features/altQueue");
const { getCurrentBRColumn } = require("../../tasks/scheduleAutoQueue");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("alt")
    .setDescription("Manage alt accounts and refresh the alt tracker embed.")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Mark a user as an alt account.")
        .addStringOption(opt =>
          opt
            .setName("username")
            .setDescription("The exact username to mark as an alt.")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Unmark a user as an alt account.")
        .addStringOption(opt =>
          opt
            .setName("username")
            .setDescription("The exact username to unmark as an alt.")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("refresh")
        .setDescription("Manually refresh the alt tracker embed.")
    ),

  async execute(interaction) {
    const chapterMasterRole = interaction.guild.roles.cache.find(
      r => r.name.toLowerCase() === "chapter master"
    );

    if (!chapterMasterRole) {
      return await interaction.reply({
        content: "⚠️ The 'Chapter Master' role could not be found.",
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const hasPermission =
      member.roles.highest.position >= chapterMasterRole.position;

    if (!hasPermission) {
      return await interaction.reply({
        content: "❌ You must have the Chapter Master role or higher to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // === /alt add ===
    if (subcommand === "add") {
      const username = interaction.options.getString("username");
      const user = db
        .prepare("SELECT * FROM users WHERE LOWER(username) = ?")
        .get(username.toLowerCase());

      if (!user) {
        return await interaction.reply({
          content: `❌ No user found with username **${username}**.`,
          ephemeral: true,
        });
      }

      db.prepare("UPDATE users SET is_alt = 1 WHERE id = ?").run(user.id);
      await updateAltTrackerEmbed(interaction.client, getCurrentBRColumn);

      return await interaction.reply({
        content: `✅ **${username}** has been marked as an alt account.`,
        ephemeral: true,
      });
    }

    // === /alt remove ===
    if (subcommand === "remove") {
      const username = interaction.options.getString("username");
      const user = db
        .prepare("SELECT * FROM users WHERE LOWER(username) = ?")
        .get(username.toLowerCase());

      if (!user) {
        return await interaction.reply({
          content: `❌ No user found with username **${username}**.`,
          ephemeral: true,
        });
      }

      db.prepare("UPDATE users SET is_alt = 0 WHERE id = ?").run(user.id);
      await updateAltTrackerEmbed(interaction.client, getCurrentBRColumn);

      return await interaction.reply({
        content: `✅ **${username}** is no longer marked as an alt.`,
        ephemeral: true,
      });
    }

    // === /alt refresh ===
    if (subcommand === "refresh") {
      try {
        await updateAltTrackerEmbed(interaction.client, getCurrentBRColumn);
        return await interaction.reply({
          content: "✅ Alt tracker embed has been refreshed.",
          ephemeral: true,
        });
      } catch (err) {
        console.error("[alt] Refresh error:", err);
        return await interaction.reply({
          content: "❌ Failed to refresh alt tracker embed.",
          ephemeral: true,
        });
      }
    }
  },
};
