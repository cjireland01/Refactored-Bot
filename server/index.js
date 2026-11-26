import express from "express";
import fs from "fs";
import path from "path";
import { ROOT_DIR } from "../utils/paths.js";
import { requireAdminForWrites } from "./middleware/auth.js";
import statusRouter from "./api/status.js";
import brRouter from "./api/br.js";
import metaVehiclesRouter from "./api/metaVehicles.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST?.trim() || undefined; // e.g. 127.0.0.1 = this computer only

const distDir = path.join(ROOT_DIR, "client", "dist");

app.disable("x-powered-by");
app.use(express.json());

// Serve the React build
app.use(express.static(distDir));

// API routes (anything that changes data needs ADMIN_TOKEN when it is set)
app.use("/api", requireAdminForWrites);
app.use("/api/status", statusRouter);
app.use("/api/br", brRouter);
app.use("/api/meta-vehicles", metaVehiclesRouter);

// Unknown /api paths are a 404, not the web page
app.use("/api", (_, res) => res.status(404).json({ error: "Not found" }));

// Fallback for SPA routing
app.get("*", (_, res) => {
  const indexFile = path.join(distDir, "index.html");
  if (!fs.existsSync(indexFile)) {
    return res
      .status(503)
      .send("Dashboard not built yet. Run: npm run build");
  }
  res.sendFile(indexFile);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`🌐 Web server running at http://${HOST ?? "localhost"}:${PORT}`);
  if (!process.env.ADMIN_TOKEN?.trim()) {
    console.warn("⚠️  ADMIN_TOKEN is not set: anyone who can reach the dashboard can edit it.");
  }
});

server.on("error", (err) => {
  console.error(`🌐 Web server failed to start on port ${PORT}:`, err.message);
});
