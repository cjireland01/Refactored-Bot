// Timezone helpers. Uses the built-in Intl API, so daylight saving is handled
// correctly and no extra packages are needed.

function isValidZone(zone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const requested = (process.env.TIMEZONE || "America/New_York").trim();
if (!isValidZone(requested)) {
  console.warn(`[time] Invalid TIMEZONE "${requested}", using America/New_York`);
}

// The zone BR changes are scheduled in. Set TIMEZONE in .env to change it.
export const TIMEZONE = isValidZone(requested) ? requested : "America/New_York";

// How far ahead of UTC a zone is at a given instant, in milliseconds.
function zoneOffsetMs(utcMs, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value])
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Convert a wall-clock date + time in a zone to a UTC timestamp (ms).
 * zonedTimeToMs("2026-07-04", "05:00") -> the instant it is 05:00 on July 4th
 * in TIMEZONE, accounting for daylight saving.
 */
export function zonedTimeToMs(dateStr, timeStr = "00:00", zone = TIMEZONE) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle the hour around a daylight-saving switch.
  let ms = guess - zoneOffsetMs(guess, zone);
  ms = guess - zoneOffsetMs(ms, zone);
  return ms;
}
