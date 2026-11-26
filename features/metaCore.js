import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __fileName = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__fileName);
const dbPath = path.join(__dirname, "..", "data", "botdata.db");
const db = new Database(dbPath);

// ===== MARK A VEHICLE AS META =====
export function setMeta(vehicleName) {
  const stmt = db.prepare(`
    INSERT INTO vehicle_meta (vehicle_name, is_meta)
    VALUES (?, 1)
    ON CONFLICT(vehicle_name) DO UPDATE SET is_meta = 1
  `);
  stmt.run(vehicleName);
}

// ===== UNMARK A VEHICLE AS META =====
export function unsetMeta(vehicleName) {
  const stmt = db.prepare(`
    INSERT INTO vehicle_meta (vehicle_name, is_meta)
    VALUES (?, 0)
    ON CONFLICT(vehicle_name) DO UPDATE SET is_meta = 0
  `);
  stmt.run(vehicleName);
}

// ===== TOGGLE META =====
export function toggleMeta(vehicleName) {
  const current = db.prepare(`SELECT is_meta FROM vehicle_meta WHERE vehicle_name = ?`)
                    .get(vehicleName);

  if (current) {
    const newValue = current.is_meta ? 0 : 1;
    db.prepare(`UPDATE vehicle_meta SET is_meta = ? WHERE vehicle_name = ?`)
      .run(newValue, vehicleName);
  } else {
    // If vehicle doesn't exist yet, mark as meta by default
    setMeta(vehicleName);
  }
}

// ===== FETCH ALL META VEHICLES =====
export function getAllMetaVehicles() {
  return db.prepare(`SELECT vehicle_name FROM vehicle_meta WHERE is_meta = 1`)
           .all()
           .map(r => r.vehicle_name);
}

// ===== FETCH META STATUS OF A VEHICLE =====
export function isMeta(vehicleName) {
  const row = db.prepare(`SELECT is_meta FROM vehicle_meta WHERE vehicle_name = ?`)
                .get(vehicleName);
  return row ? Boolean(row.is_meta) : false;
}
