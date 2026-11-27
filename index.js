import "dotenv/config";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { ROOT_DIR } from "./utils/paths.js";
import "./server/index.js"; // web dashboard

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at: ", promise, " reason: ", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown: ", err);
});

if (!process.env.BOT_TOKEN) {
    console.error("BOT_TOKEN is missing. Copy .env.example to .env and fill it in.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Import every .js file in a folder (optionally one level of subfolders)
async function importAll(folder, { recursive = false } = {}) {
    const dir = path.join(ROOT_DIR, folder);
    if (!fs.existsSync(dir)) return [];

    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && recursive) {
            for (const f of fs.readdirSync(full).filter((n) => n.endsWith(".js"))) files.push(path.join(full, f));
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
            files.push(full);
        }
    }
    return Promise.all(files.map((f) => import(pathToFileURL(f).href)));
}

// ---- slash commands ----
client.commands = new Collection();
for (const mod of await importAll("commands", { recursive: true })) {
    const command = mod.default;
    if (command?.data?.name) client.commands.set(command.data.name, command);
}

// ---- events ----
for (const mod of await importAll("events")) {
    const event = mod.default;
    if (!event?.name) continue;
    const handler = (...args) => event.execute(...args, client);
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
}

// ---- scheduled / startup tasks ----
for (const mod of await importAll("tasks")) {
    if (typeof mod.start === "function") mod.start(client);
}

client.login(process.env.BOT_TOKEN.trim());
