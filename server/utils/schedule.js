import db from "../../utils/db.js";

// BR changes over at 05:00 EST on each entry's start date.
// This mirrors getCurrentBRColumn() in tasks/scheduleAutoQueue.js so the
// website countdown and the bot always agree on when the BR switches.
const SWITCH_TIME = "T05:00:00-05:00";

/**
 * Time left until the next BR in the schedule starts, e.g. "3d 14h".
 * Reads the br_schedule table (the one the BR Schedule page edits).
 * Returns "Unknown" if nothing is scheduled after the current BR.
 */
export function getRemainingTime(currentBR) {
  try {
    const rows = db
      .prepare("SELECT br, start FROM br_schedule ORDER BY start ASC")
      .all();

    const now = Date.now();
    const startMs = (row) => new Date(`${row.start}${SWITCH_TIME}`).getTime();

    // Latest entry that has already started and matches the current BR
    let currentIdx = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (startMs(rows[i]) <= now && Number(rows[i].br).toFixed(1) === currentBR) {
        currentIdx = i;
        break;
      }
    }

    const next = currentIdx >= 0 ? rows[currentIdx + 1] : null;
    if (!next) return "Unknown";

    const diffMs = startMs(next) - now;
    if (diffMs <= 0) return "0d 0h";

    const totalHours = Math.floor(diffMs / 1000 / 60 / 60);
    return `${Math.floor(totalHours / 24)}d ${totalHours % 24}h`;
  } catch (err) {
    console.error("[getRemainingTime] Error:", err);
    return "Unknown";
  }
}
