# VCoM Discord Bot

A custom Discord bot for **VCoM Squadron management** in *War Thunder*.\
It automates vehicle tracking, leaderboard monitoring, and server
interaction.

------------------------------------------------------------------------

## ✨ Features

-   **Vehicle Tracker**
    -   Reads a spreadsheet of registered vehicles.\
    -   Posts/updates a Discord embed with vehicles of members currently
        in tracked voice channels.
-   **Alt Vehicle Tracker**
    -   Separate embed for alt accounts, handled the same as main
        vehicles.
-   **Leaderboard Tracking**
    -   Polls the War Thunder leaderboard every 60 seconds.\
    -   Updates a persistent embed with VCoM's position, score, and
        progress to/from nearby squadrons.
-   **Stats Reporting**
    -   Twice daily (3:15 AM EST, 6:15 PM EST), posts detailed squadron
        stats (wins, battles, score, etc.).\
    -   Calculates and displays differences from the previous report.
-   **Suggestion Reactions**
    -   Automatically reacts 👍 👎 to all messages in the
        **Suggestions** channel.

------------------------------------------------------------------------

## 📂 Project Structure

    project-root/
    │
    ├─ index.js                 # Entry point
    ├─ config/
    │   └─ constants.js         # Channel IDs, squad tags, leaderboard config
    ├─ data/
    │   ├─ userVehicles.xlsx    # Vehicle registration data
    │   └─ statsCache.json      # Cached stats for diff reporting
    ├─ events/
    │   └─ suggestionReact.js   # Auto-reactions + debug triggers
    ├─ features/
    │   ├─ vehicles.js          # Vehicle embed logic
    │   ├─ altVehicles.js       # Alt vehicle embed logic
    │   ├─ leaderboards.js      # Track VCoM leaderboard
    │   ├─ stats.js             # Twice-daily stats reporting
    │   └─ endingLeaderboard.js # Final position reporting (session end)
    ├─ tasks/
    │   ├─ updateVehicles.js    # Runs vehicles embed every 5s
    │   ├─ trackVcomLeaderboard.js # Runs leaderboard tracking every 60s
    │   └─ stats.js             # Cron tasks for daily stats
    └─ .env                     # Bot token and environment config

------------------------------------------------------------------------

## ⚙️ Setup

### 1. Requirements

-   [Node.js](https://nodejs.org/) (v18+)\
-   [npm](https://www.npmjs.com/)

### 2. Install Dependencies

``` bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the project root:

``` env
BOT_TOKEN=your_discord_bot_token_here
```

### 4. Configure Constants

Edit `config/constants.js` with your server's channel IDs:

``` js
TEXT_CHANNELS: {
    VEHICLE_POST: "1234567890",
    ALT_TRACKER: "2345678901",
    VCOM_POST: "3456789012",
    SUGGESTIONS: "4567890123"
},
VOICE_CHANNELS: {
    SQUAD_A: "5678901234",
    SQUAD_B: "6789012345",
}
```

### 5. Run the Bot

``` bash
node index.js
```

------------------------------------------------------------------------

## 🔗 Bot Invite

Use the following scopes:

-   **Scopes**:

        bot applications.commands

-   **Recommended Permissions**:

    -   View Channels\
    -   Send Messages\
    -   Manage Messages\
    -   Embed Links\
    -   Read Message History\
    -   Add Reactions

Example:

    https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=274877975552

------------------------------------------------------------------------

## 🛠 Development Notes

-   Vehicles are updated every **5 seconds**.\
-   Leaderboard is updated every **60 seconds**.\
-   Stats are posted at **03:15** and **18:15 EST**.\
-   All timing is managed with `setInterval` or `node-cron`.\
-   IDs and constants are centralized in `config/constants.js`.

------------------------------------------------------------------------

## 📌 Roadmap

-   [ ] Add role-based permissions for manual debug commands.\
-   [ ] Expand ending leaderboard reporting for session recaps.\
-   [ ] Web dashboard integration (future).

------------------------------------------------------------------------

## 📜 License

Private use only. Not licensed for distribution.
