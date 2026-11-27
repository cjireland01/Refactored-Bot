// Import this FIRST in a test file. It points the bot at a throwaway data folder
// (so tests never touch data/botdata.db) and cleans it up when the test ends.
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vcom-test-"));
process.env.DATA_DIR = dir;

// Tests must not depend on the developer's own .env (test-server channel IDs,
// a meta sheet link, ...). Point dotenv at a file that doesn't exist, and clear
// anything of ours that is already set in the shell.
process.env.DOTENV_CONFIG_PATH = path.join(dir, "no-such.env");
for (const name of Object.keys(process.env)) {
  if (/^(CHANNEL_|VOICE_|META_SHEET_|DISCORD_|WEB_)|^(SESSION_SECRET|PUBLIC_URL)$/.test(name)) delete process.env[name];
}
process.env.TIMEZONE = "America/New_York";
delete process.env.ADMIN_TOKEN;

process.on("exit", () => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

export const TEST_DATA_DIR = dir;
