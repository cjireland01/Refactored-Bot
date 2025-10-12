const cron = require("node-cron");
const { finalPosition } = require("../features/endingLeaderboard");

// Keep job refs alive
const jobs = [];

module.exports = {
  start(client) {
    const morningJob = cron.schedule("15 18 * * *", () => {
      setImmediate(async () => {
        try {
          console.log("[CRON] Running finalPosition at 18:15 UTC (EU job)");
          await finalPosition(client);
        } catch (err) {
          console.error("[CRON] Error in EU job:", err);
        }
      });
    });
    jobs.push(morningJob);

    const eveningJob = cron.schedule("15 3 * * *", () => {
      setImmediate(async () => {
        try {
          console.log("[CRON] Running finalPosition at 03:15 UTC (NA job)");
          await finalPosition(client);
        } catch (err) {
          console.error("[CRON] Error in NA job:", err);
        }
      });
    });
    jobs.push(eveningJob);

    console.log("[CRON] Scheduled jobs:", jobs.length);
  }
};
