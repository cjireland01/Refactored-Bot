# VCoM Discord Bot

A Discord bot and web dashboard for **VCoM Squadron** management in *War Thunder*.

## Features

- **Auto Queue** - an embed of the vehicles (in the current BR window) of members who are in the tracked voice channels. Updates the moment someone joins or leaves.
- **Alt Tracker** - the same for registered alt accounts. Manage with `/alt add`, `/alt remove`, `/alt refresh` (Chapter Master role or higher).
- **Leaderboard tracking** - polls the War Thunder squadron leaderboard every 60 seconds and keeps one embed up to date.
- **Stats reports** - twice daily (18:15 and 03:15) posts squadron stats and what changed since the last report.
- **Suggestion reactions** - adds 👍 👎 to every message in the Suggestions channel.
- **Web dashboard** (port 4000) - live queue, alt queue, a **BR schedule** editor, a **meta vehicles** editor, an **Alt Accounts** page (mark or unmark members as alts; the Discord alt embed refreshes) and a **VCoM Stats** page (current numbers plus history charts).

## Project layout

```
index.js                 Entry point: starts the web server, loads commands/events/tasks, logs in
deploy-commands.js       Registers slash commands with Discord
config/constants.js      Channel IDs (from .env), leaderboard settings
commands/admin/          Slash commands
events/                  Discord event handlers (voice changes, interactions, suggestion reactions)
features/                The bot's logic: autoQueue, altQueue, intelEmbed, endingLeaderboard, metaCore, sqlscraper
tasks/                   Things that start with the bot: timers, cron jobs, startup cleanup, meta sheet refresh, web login role lookup
utils/                   Shared code: db.js (the database + schema), br.js (current BR), time.js, vehicles.js, users.js, stats.js (stats history), metaSheet.js (Google meta list)
test/, test-support/     Automated tests (npm test)
server/                  Express web server, its API routes, and Discord login (server/auth)
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

### Meta vehicle sheet (optional)

Set `META_SHEET_URL` in `.env` to a Google Sheet (shared as "anyone with the link can view"; the `gid=...` in the link picks the tab). For several tabs, such as ground and air, put the links separated by a comma and the auto queue and alt queue will only list vehicles that are on it. Players with none show as "No meta vehicles". Leave it blank and the queues show every vehicle, as before.

The sheet is read every 10 minutes (`META_SHEET_REFRESH_MINUTES`), and again from the **Meta Vehicles** page ("Read sheet now"). The last good copy is saved in the database, so a Google outage or a broken download never empties the queues. Vehicles are matched by nation and name, ignoring case, symbols and punctuation; the Meta Vehicles page lists any sheet entries that matched nothing (usually typos).

### Letting squadron members in (Discord login)

With login on, nobody can see the dashboard without signing in with Discord. People in your server can look at everything; people with the **Chapter Master** role or higher (same rule as `/alt`) can also change the BR schedule, meta list and alts. Roles are checked live, so removing someone's role (or removing them from the server) takes effect within a minute. `ADMIN_TOKEN` still works as an editor key.

1. [Developer Portal](https://discord.com/developers/applications) > your app > **OAuth2**: copy the **Client Secret**, and under **Redirects** add `PUBLIC_URL/auth/callback` (for testing: `http://localhost:4000/auth/callback`).
2. In `.env` set `DISCORD_CLIENT_SECRET`, `WEB_GUILD_ID`, `SESSION_SECRET` and `PUBLIC_URL` (see `.env.example`). All of them are needed; if one is missing the bot logs which.
3. Restart. The dashboard now shows "Log in with Discord".

Before opening it to the internet, serve it over **HTTPS** (a Cloudflare Tunnel is the simplest safe way: no router changes) and set `PUBLIC_URL` to the `https://` address. Keep `HOST=127.0.0.1` so only the tunnel can reach the bot.

### Rate limiting

Each visitor (by IP address) is limited to 300 dashboard requests a minute, 30 login attempts per 15 minutes, and 300 page loads a minute. An open dashboard tab uses about 15 requests a minute. If the bot sits behind a tunnel or proxy, set `TRUST_PROXY=1` so visitors are counted separately.

### Tests

```
npm test
```

Uses Node's built-in test runner on a temporary database, so your real data is never touched.

### Stats history

The bot saves a snapshot of the squadron's position, score, wins, battles and members at most every 5 minutes (plus at each twice-daily report) into the `stats_history` table. The VCoM Stats page charts it, so it fills up over time from when this version first runs.

### Running on the Raspberry Pi

```
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
| `ADMIN_TOKEN` | When set, saving changes on the dashboard needs this token, and the Alt Accounts page (which lists members) needs it to view |
| `TIMEZONE` | Zone the BR schedule switches in (05:00 local). Default `America/New_York` |
| `CRON_TIMEZONE` | Zone for the 18:15 / 03:15 stats report. Unset = the computer's clock |

### Bot invite

Scopes: `bot applications.commands`. Permissions: View Channels, Send Messages, Manage Messages, Embed Links, Read Message History, Add Reactions. In the Developer Portal, also turn on the **Server Members** and **Message Content** intents.

## License

Private use only. Not licensed for distribution.
