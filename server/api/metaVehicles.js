import express from "express";
import db from "../../utils/db.js";
import { listVehiclesWithMeta, setMetaFlag } from "../../features/metaCore.js";
import { isSheetMetaActive, isOnMetaSheet } from "../../utils/metaSheet.js";

const namesAndNations = db.prepare("SELECT DISTINCT vehicle_name, country FROM vehicles");

// With a meta sheet, "meta" means "is on the sheet" (in any nation it exists in)
function withSheetFlags(rows) {
  const onSheet = new Set();
  for (const { vehicle_name, country } of namesAndNations.all()) {
    if (isOnMetaSheet(country, vehicle_name)) onSheet.add(vehicle_name);
  }
  return rows.map((r) => ({ ...r, is_meta: onSheet.has(r.vehicle_name) ? 1 : 0, from_sheet: true }));
}

const router = express.Router();

// GET all vehicles with meta info
router.get("/", (_, res) => {
  try {
    const rows = listVehiclesWithMeta();
    res.json(isSheetMetaActive() ? withSheetFlags(rows) : rows);
  } catch (err) {
    console.error("Failed to fetch meta vehicles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST to set/unset meta
router.post("/", (req, res) => {
  const { vehicle_name, is_meta } = req.body;
  if (typeof vehicle_name !== "string" || !vehicle_name.trim() || vehicle_name.length > 200) {
    return res.status(400).json({ error: "Missing or invalid vehicle_name" });
  }

  try {
    setMetaFlag(vehicle_name, is_meta);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to update meta vehicle:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
