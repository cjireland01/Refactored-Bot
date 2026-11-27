import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { DATA_DIR } from "./paths.js";

// The one and only database connection. Everything else imports this.
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "botdata.db"));
db.pragma("foreign_keys = ON");

// ---- Schema ---------------------------------------------------------------
// "IF NOT EXISTS" means this is safe to run against your existing database,
// and a brand-new install sets itself up.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    member_id TEXT UNIQUE,
    is_alt INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    br REAL NOT NULL,
    vehicle_name TEXT NOT NULL,
    country TEXT,
    move_type TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS vehicle_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_name TEXT UNIQUE NOT NULL,
    is_meta INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS br_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    br REAL NOT NULL,
    start TEXT NOT NULL
  );

  -- One row per recorded squadron snapshot (powers the dashboard's stats page)
  CREATE TABLE IF NOT EXISTS meta_sheet_cells (
    country TEXT NOT NULL,
    cell TEXT NOT NULL,
    PRIMARY KEY (country, cell)
  );

  CREATE TABLE IF NOT EXISTS stats_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taken_at INTEGER NOT NULL,   -- milliseconds since 1970 (UTC)
    position INTEGER,
    score INTEGER,
    wins INTEGER,
    battles INTEGER,
    members INTEGER,
    activity INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_stats_history_time ON stats_history (taken_at);
`);

// Older databases may be missing columns that newer code expects.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] Added missing column ${table}.${column}`);
  }
}
ensureColumn("users", "is_alt", "INTEGER DEFAULT 0");
ensureColumn("vehicles", "country", "TEXT");
ensureColumn("vehicles", "move_type", "TEXT");

// Indexes. If an existing database has data that violates a unique index we
// warn instead of crashing the bot at startup.
for (const sql of [
  "CREATE INDEX IF NOT EXISTS idx_vehicles_user_br ON vehicles (user_id, br)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vehicle_unique ON vehicles (user_id, vehicle_name)",
]) {
  try {
    db.exec(sql);
  } catch (err) {
    console.warn(`[db] Could not create index (${err.message}): ${sql}`);
  }
}

export default db;
