const { TEXT_CHANNELS, USERS } = require("../config/constants");
const { finalPosition } = require("../features/endingLeaderboard");

module.exports = {
    name: "messageCreate",
    async execute(message, client) {
        if (message.channelId === TEXT_CHANNELS.SUGGESTIONS) {
            try {
                await message.react("👍");
                await message.react("👎");
            } catch (error) {
                console.error("Failed to add reactions:", error);
            }
        }
    }
};
