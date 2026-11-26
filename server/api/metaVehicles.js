import express from "express";
import { listVehiclesWithMeta, setMetaFlag } from "../../features/metaCore.js";

const router = express.Router();

// GET all vehicles with meta info
router.get("/", (_, res) => {
  try {
    res.json(listVehiclesWithMeta());
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
