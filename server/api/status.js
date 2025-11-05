import express from "express";
import { webState } from "../state.js";

const router = express.Router();

router.get("/", (_, res) => {
  res.json(webState);
});

export default router;
