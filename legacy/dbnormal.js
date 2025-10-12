import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "botdata.db");
const db = new Database(dbPath);

// Add UNIQUE index on member_id if it doesn't already exist
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);
`);

console.log("✅ Unique index on member_id ensured.");
db.close();
