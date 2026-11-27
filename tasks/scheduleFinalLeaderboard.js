import cron from "node-cron";
import { finalPosition } from "../features/endingLeaderboard.js";

// Twice-daily stats report. Times are in the Pi's / computer's own clock unless
// CRON_TIMEZONE is set in .env (e.g. CRON_TIMEZONE=America/New_York), which makes
// them follow that zone, daylight saving included.
const timezone = process.env.CRON_TIMEZONE?.trim() || undefined;

// Keep job refs alive
const jobs = [];

export function start(client) {
  const schedule = (expression, label) => {
    const job = cron.schedule(
      expression,
      () => {
        setImmediate(async () => {
          try {
            console.log(`[CRON] Running finalPosition (${label})`);
            await finalPosition(client);
          } catch (err) {
            console.error(`[CRON] Error in ${label} job:`, err);
          }
        });
      },
      timezone ? { timezone } : undefined
    );
    jobs.push(job);
  };

  schedule("15 18 * * *", "18:15");
  schedule("15 3 * * *", "03:15");

  const zone = timezone ?? `system clock (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
  console.log(`[CRON] Scheduled ${jobs.length} jobs at 18:15 and 03:15, ${zone}`);
}
