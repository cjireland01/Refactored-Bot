const { updateVoiceVehicleEmbed } = require("../features/autoQueue");
const { updateAltTrackerEmbed } = require("../features/altQueue");

function getCurrentBRColumn() {
    const schedule = [
        { br: 14.0, start: "2025-09-01" },
        { br: 12.0, start: "2025-09-08" },
        { br: 11.0, start: "2025-09-15" },
        { br: 10.0, start: "2025-09-22" },
        { br: 9.0,  start: "2025-09-29" },
        { br: 8.0,  start: "2025-10-06" },
        { br: 7.0,  start: "2025-10-13" },
        { br: 6.0,  start: "2025-10-20" },
        { br: 5.0,  start: "2025-10-27" }
    ];

    const nowUtc = new Date();
    const nowEst = new Date(nowUtc.getTime() - (5 * 60 * 60 * 1000)); // Convert UTC to EST

    for (let i = schedule.length - 1; i >= 0; i--) {
        const startDate = new Date(`${schedule[i].start}T03:00:00-05:00`);
        if (nowEst >= startDate) {
            return Number(schedule[i].br).toFixed(1);
        }
    }

    return Number(14.0).toFixed(1);
}

module.exports = {
    start(client) {
        client.once("clientReady", () => {
            updateAltTrackerEmbed(client, getCurrentBRColumn);

            setInterval(() => updateVoiceVehicleEmbed(client, getCurrentBRColumn), 5000); // Check for updates every 5 seconds
            setInterval(() => updateAltTrackerEmbed(client, getCurrentBRColumn), (1000*60*60*24)) // Update every 24 hours
        });
        
    }
};
