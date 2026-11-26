import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { webState } from "./state.js";
import statusRouter from "./api/status.js";
import brRouter from "./api/br.js";
import metaVehiclesRouter from "./api/metaVehicles.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve React build
app.use(express.static(path.join(__dirname, "../client/dist")));
app.use(express.json());

// API routes
app.use("/api/status", statusRouter);
app.use("/api/br", brRouter);
app.use("/api/meta-vehicles", metaVehiclesRouter);

// Fallback for SPA routing
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running at http://localhost:${PORT}`);
});
