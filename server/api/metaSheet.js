import express from "express";
import { getMetaSheetStatus, refreshMetaSheet } from "../../utils/metaSheet.js";
import { emitMetaSheetChanged } from "../hooks.js";

const router = express.Router();

// How the meta sheet is doing, and which entries matched no vehicle
router.get("/", (_, res) => {
  try {
    res.json(getMetaSheetStatus());
  } catch (err) {
    console.error("[MetaSheet API] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Re-download the sheet now (needs ADMIN_TOKEN when it is set)
router.post("/refresh", async (_, res) => {
  const result = await refreshMetaSheet();
  if (result.changed) emitMetaSheetChanged();
  res.status(result.ok ? 200 : 502).json({ ...result, status: getMetaSheetStatus() });
});

export default router;
