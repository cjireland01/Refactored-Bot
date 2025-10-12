const path = require("path");
const Database = require("better-sqlite3");

// open connection (sync, persistent)
const dbPath = path.join(__dirname, "..", "data", "botdata.db");
const db = new Database(dbPath);

module.exports = db;
