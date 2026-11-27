import express from "express";
import { getStatsOverview, RANGES } from "../../utils/stats.js";

const router = express.Router();

// Squadron stats: the latest numbers, a baseline to compare with, and chart points.
//   GET /api/stats?range=24h|7d|30d|all   (default 7d)
router.get("/", (req, res) => {
  try {
    const range = Object.hasOwn(RANGES, req.query.range) ? req.query.range : "7d";
    res.json(getStatsOverview(range));
  } catch (err) {
    console.error("[Stats API] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
