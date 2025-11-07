import express from "express";
import { webState } from "../state.js";

const router = express.Router();

// Update current BR manually
router.post("/", (req, res) => {
  const { newBR } = req.body;
  if (!newBR || isNaN(parseFloat(newBR))) {
    return res.status(400).json({ error: "Invalid BR value" });
  }

  // Update webState and recalc timer
  webState.currentBR = parseFloat(newBR).toFixed(1);
  webState.brEndsIn = "Manual override"; // or calculate next rotation time

  console.log(`[BR Schedule] BR manually set to ${webState.currentBR}`);
  res.json({ success: true, newBR: webState.currentBR });
});

export default router;
