import express from "express";
import { webState } from "../state.js";
import { getCurrentBR, getRemainingTime } from "../../utils/br.js";
import { getAltUsers, getVehiclesForUserId, sanitizeVehicleName } from "../../utils/vehicles.js";

const router = express.Router();

// Live queue data for the dashboard
router.get("/", (_, res) => {
  const currentBR = getCurrentBR();
  res.json({
    currentBR,
    brEndsIn: getRemainingTime(currentBR),
    voiceUsers: webState.voiceUsers,
  });
});

// Alt accounts and all of their vehicles
router.get("/altqueue", (_, res) => {
  try {
    const alts = getAltUsers().map(({ id, username }) => ({
      username,
      vehicles: getVehiclesForUserId(id).map(({ Vehicle, BR }) => ({
        Vehicle: sanitizeVehicleName(Vehicle),
        BR,
      })),
    }));
    res.json({ alts });
  } catch (err) {
    console.error("[API] Failed to fetch alt queue:", err);
    res.status(500).json({ error: "Failed to fetch alt queue" });
  }
});

export default router;
