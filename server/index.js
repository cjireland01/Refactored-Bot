import { createApp } from "./app.js";
import { authConfig } from "./auth/config.js";

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST?.trim() || undefined; // e.g. 127.0.0.1 = this computer only

const server = createApp().listen(PORT, HOST, () => {
  console.log(`🌐 Web server running at http://${HOST ?? "localhost"}:${PORT}`);
  if (authConfig().enabled) {
    console.log(`🔐 Discord login is on (${authConfig().publicUrl}).`);
  } else if (!process.env.ADMIN_TOKEN?.trim()) {
    console.warn("⚠️  ADMIN_TOKEN is not set: anyone who can reach the dashboard can edit it.");
  }
});

server.on("error", (err) => {
  console.error(`🌐 Web server failed to start on port ${PORT}:`, err.message);
});
