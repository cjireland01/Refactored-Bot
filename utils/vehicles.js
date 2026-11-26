import db from "./db.js";

// Everything the queues need to know about vehicles lives here, so the auto
// queue, alt queue and web API all behave the same way.

const stmts = {
  userByName: db.prepare("SELECT id, username FROM users WHERE LOWER(username) = ?"),
  altUsers: db.prepare("SELECT id, username FROM users WHERE is_alt = 1"),
  vehiclesInRange: db.prepare(
    "SELECT vehicle_name, br FROM vehicles WHERE user_id = ? AND br BETWEEN ? AND ? ORDER BY br DESC"
  ),
  vehiclesAll: db.prepare(
    "SELECT vehicle_name, br FROM vehicles WHERE user_id = ? ORDER BY br DESC"
  ),
};

/**
 * Clean a vehicle name for display: strip accents, control characters and odd
 * symbols, then collapse whitespace.
 */
export function sanitizeVehicleName(name) {
  if (!name) return "";
  return String(name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\p{C}/gu, "")
    .replace(/[^\p{L}\p{N}\s,.\-'()/:+&]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The BR window a squad plays in for a given BR: one full BR below it, except
 * at the top (14.0) where the window is 11.0 - 14.0.
 */
export function getBRRange(currentBR) {
  const br = parseFloat(currentBR);
  if (br === 14.0) return { min: 11.0, max: 14.0 };
  // toFixed avoids float noise like 9.700000000000001 missing a 9.7 row
  return { min: Number((br - 1.0).toFixed(1)), max: br };
}

const toRows = (rows) =>
  rows.map((r) => ({ Vehicle: r.vehicle_name, BR: r.br.toFixed(1) }));

/**
 * Vehicles for a user (matched by username, case-insensitive).
 * With a currentBR, only vehicles in that BR window; without, all of them.
 */
export function getVehiclesForUsername(username, currentBR) {
  if (!username) return [];
  const user = stmts.userByName.get(String(username).toLowerCase());
  if (!user) return [];
  return getVehiclesForUserId(user.id, currentBR);
}

export function getVehiclesForUserId(userId, currentBR) {
  if (currentBR === undefined) return toRows(stmts.vehiclesAll.all(userId));
  const { min, max } = getBRRange(currentBR);
  return toRows(stmts.vehiclesInRange.all(userId, min, max));
}

/** Every user marked as an alt account: [{ id, username }] */
export function getAltUsers() {
  return stmts.altUsers.all();
}

/**
 * One embed field's text for a user's vehicles, grouped by BR (highest first):
 *   "10.7 - Vehicle A, Vehicle B\n9.7 - Vehicle C"
 */
export function formatVehicleField(vehicles) {
  const grouped = new Map();
  for (const { Vehicle, BR } of vehicles) {
    if (!grouped.has(BR)) grouped.set(BR, []);
    grouped.get(BR).push(sanitizeVehicleName(Vehicle));
  }

  let text = [...grouped.keys()]
    .sort((a, b) => parseFloat(b) - parseFloat(a))
    .map((br) => `${br} - ${grouped.get(br).join(", ")}`)
    .join("\n");

  // Discord limits a field to 1024 characters
  if (text.length > 1000) text = text.slice(0, 997) + "...\n+ some not shown";
  return text;
}

/**
 * Add one field per user to an embed. Discord allows 25 fields and about 6000
 * characters per embed, so extra users are skipped (and counted) instead of
 * making the whole update fail.
 * Returns how many users did not fit.
 */
export function addVehicleFields(embed, userVehicleMap) {
  let total = 0;
  let skipped = 0;
  for (const [username, vehicles] of userVehicleMap.entries()) {
    if (!vehicles?.length) continue;
    const value = formatVehicleField(vehicles);
    if ((embed.data.fields?.length ?? 0) >= 25 || total + value.length + username.length > 5500) {
      skipped++;
      continue;
    }
    total += value.length + username.length;
    embed.addFields({ name: username, value, inline: false });
  }
  return skipped;
}
