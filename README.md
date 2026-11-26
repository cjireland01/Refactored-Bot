# VCoM Discord Bot

A Discord bot and web dashboard for **VCoM Squadron** management in *War Thunder*.

## Features

- **Auto Queue** - an embed of the vehicles (in the current BR window) of members who are in the tracked voice channels. Updates the moment someone joins or leaves.
- **Alt Tracker** - the same for registered alt accounts. Manage with `/alt add`, `/alt remove`, `/alt refresh` (Chapter Master role or higher).
- **Leaderboard tracking** - polls the War Thunder squadron leaderboard every 60 seconds and keeps one embed up to date.
- **Stats reports** - twice daily (18:15 and 03:15) posts squadron stats and what changed since the last report.
- **Suggestion reactions** - adds 👍 👎 to every message in the Suggestions channel.
- **Web dashboard** (port 4000) - live queue, alt queue, a **BR schedule** editor and a **meta vehicles** editor.

## Project layout

```
index.js                 Entry point: starts the web server, loads commands/events/tasks, logs in
deploy-commands.js       Registers slash commands with Discord
config/constants.js      Channel IDs (from .env), leaderboard settings
commands/admin/          Slash commands
events/                  Discord event handlers (voice changes, interactions, suggestion reactions)
features/                The bot's logic: autoQueue, altQueue, intelEmbed, endingLeaderboard, metaCore, sqlscraper
tasks/                   Things that start with the bot: timers, cron jobs, startup cleanup
utils/                   Shared code: db.js (the database + schema), br.js (current BR), time.js, vehicles.js
server/                  Express web server and its API routes
client/                  React dashboard (built into client/dist)
legacy/                  Old one-off scripts, not used by the bot
data/                    botdata.db and the stats cache (not in git)
```

How the pieces connect: `utils/db.js` is the only database connection. `utils/br.js` works out the current BR from the schedule table; both queues and the website use it. `utils/vehicles.js` holds the vehicle lookups and formatting both queues share.

## Setup

Requires **Node.js 20 or newer**.

```
npm install
npm run build        # builds the web dashboard (client/dist)
```

Create a `.env` file (see `.env.example` for every option):

```
BOT_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_application_id_here
```

Register the slash commands once (and again whenever commands change):

```
npm run deploy-commands
```

Run it:

```
npm start
```

then open http://localhost:4000.

### Running on the Raspberry Pi

pm2 keeps the bot running and restarts it if it crashes. Install it once, globally (it is a tool, not part of the bot's own packages):

```
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

### Database

`data/botdata.db` (SQLite) is created automatically with all its tables on first start. Fill it with your squad's vehicles by running `npm run scrape`. It is not stored in git, so copy it yourself when moving the bot to another machine.

### Settings in `.env`

| Setting | What it does |
| --- | --- |
| `BOT_TOKEN`, `CLIENT_ID` | Discord login and slash command registration |
| `CHANNEL_*`, `VOICE_*` | Channel IDs. Unset = the live server's IDs. Set all of them on a test server |
| `PORT`, `HOST` | Where the dashboard listens. `HOST=127.0.0.1` makes it local-only |
| `ADMIN_TOKEN` | When set, saving changes on the dashboard needs this token |
| `TIMEZONE` | Zone the BR schedule switches in (05:00 local). Default `America/New_York` |
| `CRON_TIMEZONE` | Zone for the 18:15 / 03:15 stats report. Unset = the computer's clock |

### Bot invite

Scopes: `bot applications.commands`. Permissions: View Channels, Send Messages, Manage Messages, Embed Links, Read Message History, Add Reactions. In the Developer Portal, also turn on the **Server Members** and **Message Content** intents.

## License

Private use only. Not licensed for distribution.
