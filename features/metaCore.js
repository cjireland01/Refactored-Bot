import db from "../utils/db.js";

const upsertMeta = db.prepare(`
  INSERT INTO vehicle_meta (vehicle_name, is_meta)
  VALUES (?, ?)
  ON CONFLICT(vehicle_name) DO UPDATE SET is_meta = excluded.is_meta
`);
const selectMeta = db.prepare("SELECT is_meta FROM vehicle_meta WHERE vehicle_name = ?");
const selectAllMeta = db.prepare("SELECT vehicle_name FROM vehicle_meta WHERE is_meta = 1");
const selectVehicles = db.prepare(`
  SELECT v.vehicle_name, MAX(v.br) AS br, MAX(v.country) AS country, MAX(v.move_type) AS move_type,
         COALESCE(vm.is_meta, 0) AS is_meta
  FROM vehicles v
  LEFT JOIN vehicle_meta vm ON vm.vehicle_name = v.vehicle_name
  GROUP BY v.vehicle_name
  ORDER BY v.vehicle_name
`);

/** Mark (true) or unmark (false) a vehicle as meta */
export function setMetaFlag(vehicleName, isMeta) {
  upsertMeta.run(vehicleName, isMeta ? 1 : 0);
}

export const setMeta = (vehicleName) => setMetaFlag(vehicleName, true);
export const unsetMeta = (vehicleName) => setMetaFlag(vehicleName, false);

/** Flip a vehicle's meta flag (unknown vehicles become meta) */
export function toggleMeta(vehicleName) {
  const current = selectMeta.get(vehicleName);
  setMetaFlag(vehicleName, current ? !current.is_meta : true);
}

/** Names of all vehicles currently marked as meta */
export function getAllMetaVehicles() {
  return selectAllMeta.all().map((r) => r.vehicle_name);
}

export function isMeta(vehicleName) {
  const row = selectMeta.get(vehicleName);
  return row ? Boolean(row.is_meta) : false;
}

/** Every known vehicle with its BR, country, type and meta flag */
export function listVehiclesWithMeta() {
  return selectVehicles.all();
}
