const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const Database = require("better-sqlite3");

const excelPath = path.join(__dirname, "data", "userVehicles.xlsx");
const dbPath = path.join(__dirname, "data", "botdata.db");

// Load Excel
if (!fs.existsSync(excelPath)) {
  console.error("Excel file not found:", excelPath);
  process.exit(1);
}

const workbook = XLSX.readFile(excelPath);
const worksheet = workbook.Sheets["matched_vehicles"];
const rows = XLSX.utils.sheet_to_json(worksheet);

// Open DB (creates if not exists)
const db = new Database(dbPath);

// Drop old tables if rerunning migration
db.exec(`
  DROP TABLE IF EXISTS vehicles;
  DROP TABLE IF EXISTS users;
`);

// Create schema
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    member_id TEXT
  );

  CREATE TABLE vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    br REAL NOT NULL,
    vehicle_name TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Prepare insert statements
const insertUser = db.prepare(`
  INSERT INTO users (username, member_id) VALUES (?, ?)
`);
const insertVehicle = db.prepare(`
  INSERT INTO vehicles (user_id, br, vehicle_name) VALUES (?, ?, ?)
`);

// Insert rows
db.transaction(() => {
  rows.forEach(row => {
    const username = row.Username || row.username || "";
    const memberId = row.MemberID || row.memberid || null;

    if (!username.trim()) return;

    const userResult = insertUser.run(username.trim(), memberId ? String(memberId).trim() : null);
    const userId = userResult.lastInsertRowid;

    Object.entries(row).forEach(([col, value]) => {
      if (["Username", "username", "MemberID", "memberid"].includes(col)) return;
      if (!value) return;

      const br = parseFloat(col);
      if (isNaN(br)) return;

      const vehicles = String(value)
        .split(/[,;/\|\n\r]+/)
        .map(v => v.trim())
        .filter(Boolean);

      vehicles.forEach(vehicle => {
        insertVehicle.run(userId, br, vehicle);
      });
    });
  });
})();

console.log(`✅ Migration complete. Database created at: ${dbPath}`);
