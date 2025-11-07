import db from "../utils/db.js";

const { updateVoiceVehicleEmbed } = require("../features/autoQueue");
const { updateAltTrackerEmbed } = require("../features/altQueue");

function getCurrentBRColumn() {
    const schedule = [
        { br: 14.0, start: "2025-11-01" },
        { br: 12.0, start: "2025-11-07" },
        { br: 10.7, start: "2025-11-14" },
        { br: 9.7, start: "2025-11-21" },
        { br: 8.7,  start: "2025-11-28" },
        { br: 7.3,  start: "2025-12-05" },
        { br: 6.3,  start: "2025-12-12" },
        { br: 5.7,  start: "2025-12-19" },
        { br: 4.7,  start: "2025-12-26" }
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

async function runAutoQueue(client) {
    try {
        await updateVoiceVehicleEmbed(client, getCurrentBRColumn);
    } catch (err) {
        console.error("[AutoQueue] Failed to run manually:", err);
    }
}

module.exports = {
    start(client) {
        client.once("clientReady", () => {
            updateAltTrackerEmbed(client, getCurrentBRColumn);

            setInterval(() => updateVoiceVehicleEmbed(client, getCurrentBRColumn), 5000); // Check for updates every 5 seconds
            setInterval(() => updateAltTrackerEmbed(client, getCurrentBRColumn), (1000*60*60*24)) // Update every 24 hours
        });
        
    },
    getCurrentBRColumn,
    runAutoQueue
};
