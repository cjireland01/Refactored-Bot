import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { findUserByName, setUserAlt } from "../../utils/users.js";
import { updateAltTrackerEmbed } from "../../features/altQueue.js";

const reply = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

export default {
  data: new SlashCommandBuilder()
    .setName("alt")
    .setDescription("Manage alt accounts and refresh the alt tracker embed.")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Mark a user as an alt account.")
        .addStringOption((opt) =>
          opt.setName("username").setDescription("The exact username to mark as an alt.").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Unmark a user as an alt account.")
        .addStringOption((opt) =>
          opt.setName("username").setDescription("The exact username to unmark as an alt.").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("refresh").setDescription("Manually refresh the alt tracker embed.")
    ),

  async execute(interaction) {
    const chapterMasterRole = interaction.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === "chapter master"
    );
    if (!chapterMasterRole) {
      return reply(interaction, "⚠️ The 'Chapter Master' role could not be found.");
    }
    if (interaction.member.roles.highest.position < chapterMasterRole.position) {
      return reply(interaction, "❌ You must have the Chapter Master role or higher to use this command.");
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add" || subcommand === "remove") {
      const username = interaction.options.getString("username");
      const user = findUserByName(username);
      if (!user) return reply(interaction, `❌ No user found with username **${username}**.`);

      const adding = subcommand === "add";
      setUserAlt(user.id, adding);
      await updateAltTrackerEmbed(interaction.client);
      return reply(
        interaction,
        adding
          ? `✅ **${username}** has been marked as an alt account.`
          : `✅ **${username}** is no longer marked as an alt.`
      );
    }

    if (subcommand === "refresh") {
      try {
        await updateAltTrackerEmbed(interaction.client);
        return reply(interaction, "✅ Alt tracker embed has been refreshed.");
      } catch (err) {
        console.error("[alt] Refresh error:", err);
        return reply(interaction, "❌ Failed to refresh alt tracker embed.");
      }
    }
  },
};
