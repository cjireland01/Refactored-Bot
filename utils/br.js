import db from "./db.js";
import { zonedTimeToMs } from "./time.js";

// The BR changes over at 05:00 (in TIMEZONE) on each schedule entry's start date.
const SWITCH_TIME = "05:00";
const DEFAULT_BR = 14.0;

const selectSchedule = db.prepare("SELECT br, start FROM br_schedule ORDER BY start ASC");

const startMs = (row) => zonedTimeToMs(row.start, SWITCH_TIME);

/**
 * The BR that is active right now, as a string like "10.7".
 * Falls back to 14.0 if nothing in the schedule has started yet.
 */
export function getCurrentBR(now = Date.now()) {
  try {
    const rows = selectSchedule.all();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (now >= startMs(rows[i])) return Number(rows[i].br).toFixed(1);
    }
  } catch (err) {
    console.error("[getCurrentBR] Error:", err);
  }
  return DEFAULT_BR.toFixed(1);
}

/**
 * Time until the next BR in the schedule starts, e.g. "3d 14h".
 * "Unknown" when nothing is scheduled after the current BR.
 */
export function getRemainingTime(currentBR, now = Date.now()) {
  try {
    if (currentBR === undefined) currentBR = getCurrentBR(now);
    const rows = selectSchedule.all();

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
