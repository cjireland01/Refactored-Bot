const { trackVcomLeaderboard } = require("../features/intelEmbed");
const { LEADERBOARD } = require("../config/constants");

module.exports = {
    start(client) {
        client.once("clientReady", () => {
            setInterval(() => trackVcomLeaderboard(client), LEADERBOARD.POLL_INTERVAL);
        });
    }
};
