import express from "express";
import db from "../utils/db.js";

const router = express.Router();

// GET schedule
router.get("/", (_, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, br, start 
      FROM br_schedule 
      ORDER BY start ASC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error("[BR API] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST new or update existing BR entry
router.post("/", (req, res) => {
  try {
    const { id, br, start } = req.body;
    if (!br || !start) return res.status(400).json({ error: "Missing parameters" });

    if (id) {
      // update existing
      db.prepare(`
        UPDATE br_schedule 
        SET br = ?, start = ? 
        WHERE id = ?
      `).run(br, start, id);
    } else {
      // insert new
      db.prepare(`
        INSERT INTO br_schedule (br, start) VALUES (?, ?)
      `).run(br, start);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[BR API] POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE a schedule entry
router.delete("/:id", (req, res) => {
  try {
    db.prepare(`DELETE FROM br_schedule WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[BR API] DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
