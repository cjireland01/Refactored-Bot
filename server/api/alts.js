import express from "express";
import { requireAdmin } from "../middleware/auth.js";
import { listUsers, findUserById, setUserAlt } from "../../utils/users.js";
import { emitAltsChanged } from "../hooks.js";

const router = express.Router();

// The full member list isn't public: viewing it needs the admin token too
router.use(requireAdmin);

// All members, with whether each is marked as an alt
router.get("/", (_, res) => {
  try {
    res.json({ users: listUsers() });
  } catch (err) {
    console.error("[Alts API] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Mark or unmark one member as an alt
router.post("/", (req, res) => {
  const id = Number(req.body.id);
  const flag = req.body.is_alt;

  if (!Number.isInteger(id)) return res.status(400).json({ error: "Missing or invalid id" });
  if (typeof flag !== "boolean" && flag !== 0 && flag !== 1) {
    return res.status(400).json({ error: "is_alt must be true/false or 1/0" });
  }

  try {
    if (!findUserById(id)) return res.status(404).json({ error: "No such member" });
    setUserAlt(id, flag === true || flag === 1);
    emitAltsChanged(); // refresh the alt embed in Discord
    res.json({ success: true });
  } catch (err) {
    console.error("[Alts API] POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
