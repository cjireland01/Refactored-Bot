import express from "express";
import fs from "fs";
import path from "path";
import { ROOT_DIR } from "../utils/paths.js";
import { requireAdminForWrites, meHandler } from "./middleware/auth.js";
import authRoutes from "./auth/routes.js";
import { createLimiters } from "./rateLimit.js";
import statusRouter from "./api/status.js";
import brRouter from "./api/br.js";
import metaVehiclesRouter from "./api/metaVehicles.js";
import altsRouter from "./api/alts.js";
import statsRouter from "./api/stats.js";
import metaSheetRouter from "./api/metaSheet.js";

const distDir = path.join(ROOT_DIR, "client", "dist");

/** Build the web app (without starting it, so tests can run it on any port) */
export function createApp({ limits } = {}) {
  const app = express();
  const limit = createLimiters(limits);

  // Behind a tunnel or proxy, set TRUST_PROXY=1 so each visitor is counted by their
  // own address (not the proxy's) for rate limiting
  const hops = Number(process.env.TRUST_PROXY);
  if (Number.isInteger(hops) && hops > 0) app.set("trust proxy", hops);

  app.disable("x-powered-by");
  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  app.use(express.json());

  // Discord login pages, and "who am I" (open to everyone)
  app.use("/auth", limit.auth, authRoutes);
  app.get("/api/me", limit.api, meHandler);

  // API routes. Rate limit first (so guessing the admin token is slowed down too),
  // then: needs a login when Discord login is on; otherwise changing data needs
  // ADMIN_TOKEN when one is set
  app.use("/api", limit.api, requireAdminForWrites);
  app.use("/api/status", limit.apiRoutes, statusRouter);
  app.use("/api/br", limit.apiRoutes, brRouter);
  app.use("/api/meta-vehicles", limit.apiRoutes, metaVehiclesRouter);
  app.use("/api/alts", limit.apiRoutes, altsRouter);
  app.use("/api/stats", limit.apiRoutes, statsRouter);
  app.use("/api/meta-sheet", limit.apiRoutes, metaSheetRouter);

  // Unknown /api paths are a 404, not the web page
  app.use("/api", (_, res) => res.status(404).json({ error: "Not found" }));

  // The React build, then the fallback for its page routes
  app.use(limit.pages, express.static(distDir));
  app.get("*", limit.pages, (_, res) => {
    const indexFile = path.join(distDir, "index.html");
    if (!fs.existsSync(indexFile)) {
      return res.status(503).send("Dashboard not built yet. Run: npm run build");
    }
    res.sendFile(indexFile);
  });

  return app;
}
