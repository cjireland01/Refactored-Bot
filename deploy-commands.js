// deploy-commands.js
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
require("dotenv").config();

const token = process.env.BOT_TOKEN.trim();
const clientId = process.env.CLIENT_ID;   // your bot's application id
const guildId = process.env.TEST_GUILD_ID || null; // optional: register to a guild for fast updates

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(commandsPath).filter(f => fs.statSync(path.join(commandsPath, f)).isDirectory());

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    if (command?.data?.toJSON) commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`Refreshing ${commands.length} application (/) commands.`);
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log("Registered commands to guild:", guildId);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("Registered global commands. Note: global propagation may take up to an hour.");
    }
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
})();
