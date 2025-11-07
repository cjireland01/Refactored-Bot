import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { webState } from "./state.js";
import statusRouter from "./api/status.js";
import brScheduleRouter from "./api/brSchedule.js";

const app = express();
const PORT = 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve React build
app.use(express.static(path.join(__dirname, "../client/dist")));
app.use(express.json());

// API routes
app.use("/api/status", statusRouter);
app.use("/api/br-schedule", brScheduleRouter);

// Fallback for SPA routing
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running at http://localhost:${PORT}`);
});
