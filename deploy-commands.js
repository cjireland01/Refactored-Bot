// Registers the slash commands with Discord.   Usage: node deploy-commands.js
// Set GUILD_ID in .env to register to one server only (updates instantly,
// good for a test server). Leave it out to register globally.
import "dotenv/config";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { REST, Routes } from "discord.js";
import { ROOT_DIR } from "./utils/paths.js";

if (!process.env.BOT_TOKEN || !process.env.CLIENT_ID) {
  console.error("BOT_TOKEN and CLIENT_ID must be set in .env");
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(ROOT_DIR, "commands");

for (const folder of fs.readdirSync(commandsPath).filter((f) => fs.statSync(path.join(commandsPath, f)).isDirectory())) {
  const folderPath = path.join(commandsPath, folder);
  for (const file of fs.readdirSync(folderPath).filter((f) => f.endsWith(".js"))) {
    const { default: command } = await import(pathToFileURL(path.join(folderPath, file)).href);
    if (command?.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
const guildId = process.env.GUILD_ID?.trim();

try {
  if (guildId) {
    console.log(`Registering ${commands.length} commands to server ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
    console.log("✅ Commands registered to the server!");
  } else {
    console.log(`Registering ${commands.length} global commands...`);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered globally!");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
