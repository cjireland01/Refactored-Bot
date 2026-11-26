import express from "express";
import fs from "fs";
import path from "path";
import { ROOT_DIR } from "../utils/paths.js";
import { requireAdminForWrites, meHandler } from "./middleware/auth.js";
import authRoutes from "./auth/routes.js";
import statusRouter from "./api/status.js";
import brRouter from "./api/br.js";
import metaVehiclesRouter from "./api/metaVehicles.js";
import altsRouter from "./api/alts.js";
import statsRouter from "./api/stats.js";
import metaSheetRouter from "./api/metaSheet.js";

const distDir = path.join(ROOT_DIR, "client", "dist");

/** Build the web app (without starting it, so tests can run it on any port) */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  app.use(express.json());

  // Serve the React build
  app.use(express.static(distDir));

  // Discord login pages, and "who am I" (open to everyone)
  app.use("/auth", authRoutes);
  app.get("/api/me", meHandler);

  // API routes: needs a login when Discord login is on; otherwise changing
  // data needs ADMIN_TOKEN when one is set
  app.use("/api", requireAdminForWrites);
  app.use("/api/status", statusRouter);
  app.use("/api/br", brRouter);
  app.use("/api/meta-vehicles", metaVehiclesRouter);
  app.use("/api/alts", altsRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/meta-sheet", metaSheetRouter);

  // Unknown /api paths are a 404, not the web page
  app.use("/api", (_, res) => res.status(404).json({ error: "Not found" }));

  // Fallback for SPA routing
  app.get("*", (_, res) => {
    const indexFile = path.join(distDir, "index.html");
    if (!fs.existsSync(indexFile)) {
      return res.status(503).send("Dashboard not built yet. Run: npm run build");
    }
    res.sendFile(indexFile);
  });

  return app;
}
