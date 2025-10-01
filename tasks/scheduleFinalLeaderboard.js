const cron = require("node-cron");
const { finalPosition } = require("../features/endingLeaderboard");

module.exports = {
    start(client) {
        client.once("clientReady", () => {
        // Run at 3:15 AM EST (08:15 UTC)
        cron.schedule("15 8 * * *", () => {
            finalPosition(client);
        });

        // Run at 6:15 PM EST (23:15 UTC)
        cron.schedule("0 15 23 * * *", () => {
            finalPosition(client);
        });
    });
    }
};
