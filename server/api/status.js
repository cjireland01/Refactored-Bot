import express from "express";
import db from "../../utils/db.js"; // adjust if your path differs
import { webState } from "../state.js";

const router = express.Router();

// keep existing route
router.get("/", (_, res) => {
  res.json(webState);
});

// --- Helper: clean vehicle names ---
function sanitizeVehicleName(name) {
  if (!name) return "";
  return name.replace(/[^\p{L}\p{N}\s\-\.\(\)\/]/gu, "").trim();
}

// --- New route: Alt Queue ---
router.get("/altqueue", async (_, res) => {
  try {
    // Get all alt users
    const altUsers = db.prepare("SELECT id, username FROM users WHERE is_alt = 1").all();

    if (!altUsers.length) {
      return res.json({ alts: [] });
    }

    // For each alt, fetch their vehicles
    const results = altUsers.map(user => {
      const vehicles = db
        .prepare(`
          SELECT vehicle_name, br
          FROM vehicles
          WHERE user_id = ?
          ORDER BY br DESC
        `)
        .all(user.id)
        .map(row => ({
          Vehicle: sanitizeVehicleName(row.vehicle_name),
          BR: row.br.toFixed(1),
        }));

      return { username: user.username, vehicles };
    });

    res.json({ alts: results });
  } catch (err) {
    console.error("[API] Failed to fetch alt queue:", err);
    res.status(500).json({ error: "Failed to fetch alt queue" });
  }
});

export default router;
