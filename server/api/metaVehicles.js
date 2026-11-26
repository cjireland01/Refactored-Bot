import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __fileName = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__fileName);
const db = new Database(path.join(__dirname, "..", "..", "data", "botdata.db"));

const router = express.Router();

// GET all vehicles with meta info
router.get("/", (req, res) => {
  try {
    const vehicles = db.prepare(`
      SELECT v.vehicle_name, MAX(v.br) AS br, MAX(v.country) AS country, MAX(v.move_type) AS move_type,
             COALESCE(vm.is_meta, 0) AS is_meta
      FROM vehicles v
      LEFT JOIN vehicle_meta vm ON vm.vehicle_name = v.vehicle_name
      GROUP BY v.vehicle_name
      ORDER BY v.vehicle_name
    `).all();

    console.log("Fetched vehicles:", vehicles.length); // debug log
    res.json(vehicles);
  } catch (err) {
    console.error("Failed to fetch meta vehicles:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



// POST to set/unset meta
router.post("/", (req, res) => {
  const { vehicle_name, is_meta } = req.body;
  if (!vehicle_name) return res.status(400).json({ error: "Missing vehicle_name" });
  
  db.prepare(`
    INSERT INTO vehicle_meta (vehicle_name, is_meta)
    VALUES (?, ?)
    ON CONFLICT(vehicle_name) DO UPDATE SET is_meta = excluded.is_meta
  `).run(vehicle_name, is_meta ? 1 : 0);

  res.json({ success: true });
});

export default router;
