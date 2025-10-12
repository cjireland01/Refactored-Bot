import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join("/home/cireland/Refactored-Bot/data", "botdata.db");
const db = new Database(dbPath);

// Helper function to normalize username
function normalizeUsername(name) {
  if (!name) return "";
  return name.replace(/@psn|@live/gi, "").trim();
}

// Prepare update statement
const updateStmt = db.prepare(`
  UPDATE users
  SET username = ?
  WHERE id = ?
`);

// Fetch all users
const users = db.prepare("SELECT id, username FROM users").all();

// Run transaction to update
const tx = db.transaction(() => {
  for (const u of users) {
    const normalized = normalizeUsername(u.username);
    if (normalized !== u.username) {
      updateStmt.run(normalized, u.id);
      console.log(`Updated: ${u.username} -> ${normalized}`);
    }
  }
});

tx();

console.log("✅ All usernames normalized.");
db.close();
