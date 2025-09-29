const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at: ", promise, " reason: ", reason);
})

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown: ", err);
})

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// Load events dynamically
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Load tasks
const tasksPath = path.join(__dirname, "tasks");
const taskFiles = fs.readdirSync(tasksPath).filter(file => file.endsWith(".js"));

for (const file of taskFiles) {
    const task = require(path.join(tasksPath, file));
    if (typeof task.start === "function") {
        task.start(client);
    }
}

client.login(process.env.BOT_TOKEN.trim());
