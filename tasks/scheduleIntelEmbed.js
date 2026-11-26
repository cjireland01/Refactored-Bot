import { Events } from "discord.js";
import { trackVcomLeaderboard } from "../features/intelEmbed.js";
import { LEADERBOARD } from "../config/constants.js";

export function start(client) {
    client.once(Events.ClientReady, () => {
        setInterval(() => trackVcomLeaderboard(client), LEADERBOARD.POLL_INTERVAL);
    });
}
