const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("alt")
    .setDescription("Manage or view alternate accounts")
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("View all users marked as alts in the database")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      try {
        const rows = db
          .prepare("SELECT username FROM users WHERE is_alt = 1 ORDER BY username COLLATE NOCASE ASC")
          .all();

        if (!rows.length) {
          return interaction.reply({
            content: "⚠️ There are no users currently marked as alts.",
            ephemeral: true,
          });
        }

        const altList = rows.map(r => `• ${r.username}`).join("\n");
        const embed = new EmbedBuilder()
          .setTitle("🧩 Alt Account List")
          .setDescription(altList)
          .setColor("#00ff7f")
          .setTimestamp()
          .setFooter({ text: `Total alts: ${rows.length}` });

        await interaction.reply({ embeds: [embed], ephemeral: false });
      } catch (err) {
        console.error("[/alt list] Database error:", err);
        await interaction.reply({
          content: "❌ Failed to retrieve alt accounts from the database.",
          ephemeral: true,
        });
      }
    }
  },
};
