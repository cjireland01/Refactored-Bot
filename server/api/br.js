import express from "express";
import db from "../../utils/db.js";

const router = express.Router();

const selectAll = db.prepare("SELECT id, br, start FROM br_schedule ORDER BY br DESC");
const update = db.prepare("UPDATE br_schedule SET br = ?, start = ? WHERE id = ?");
const insert = db.prepare("INSERT INTO br_schedule (br, start) VALUES (?, ?)");
const remove = db.prepare("DELETE FROM br_schedule WHERE id = ?");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET schedule
router.get("/", (_, res) => {
  try {
    res.json(selectAll.all());
  } catch (err) {
    console.error("[BR API] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST new or update existing BR entry
router.post("/", (req, res) => {
  try {
    const { id } = req.body;
    const br = Number(req.body.br);
    const start = req.body.start;

    if (!Number.isFinite(br) || br < 1 || br > 20) {
      return res.status(400).json({ error: "BR must be a number between 1 and 20" });
    }
    if (typeof start !== "string" || !DATE_RE.test(start) || Number.isNaN(Date.parse(start))) {
      return res.status(400).json({ error: "Start must be a date like 2026-12-05" });
    }

    if (id) update.run(br, start, id);
    else insert.run(br, start);

    res.json({ success: true });
  } catch (err) {
    console.error("[BR API] POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE a schedule entry
router.delete("/:id", (req, res) => {
  try {
    remove.run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[BR API] DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
