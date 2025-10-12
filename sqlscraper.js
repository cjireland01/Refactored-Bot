// sqlscraper-autqueue.js
import fetch from "node-fetch";
import readline from "readline";
import * as dotenv from "dotenv";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

dotenv.config();

// ===== CONFIGURATION =====
const SQUAD_ID = "1125864";
let TURNSTILE_TOKEN = process.env.TURNSTILE_TOKEN;
const PLAYER_LIMIT = process.env.PLAYER_LIMIT;
const API_BASE = "https://statshark.net";

const BR_STEPS = [
  1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0,
  4.3, 4.7, 5.0, 5.3, 5.7, 6.0, 6.3, 6.7, 7.0,
  7.3, 7.7, 8.0, 8.3, 8.7, 9.0, 9.3, 9.7, 10.0, 10.3,
  10.7, 11.0, 11.3, 11.7, 12.0, 12.3, 12.7, 13.0, 13.3, 13.7, 14.0, 14.3,
];

// ===== DATABASE SETUP =====
const dbPath = path.join(process.cwd(), "data", "botdata.db");
const db = new Database(dbPath);

// Create tables if they don’t exist (autoQueue expects this schema)
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    member_id TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    br REAL NOT NULL,
    vehicle_name TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_user_br ON vehicles (user_id, br);
`);

// Prepare insert statements
const insertUser = db.prepare(`
  INSERT INTO users (username, member_id)
  VALUES (?, ?)
  ON CONFLICT(member_id) DO UPDATE SET username = excluded.username
  RETURNING id;
`);

const insertVehicle = db.prepare(`
  INSERT INTO vehicles (user_id, br, vehicle_name)
  VALUES (?, ?, ?)
`);

// ===== HELPERS =====
function normalizeUsernameForDB(name) {
  return name.replace(/@psn|@live/gi, "").trim().toLowerCase();
}

function makeHeaders() {
  return {
    "accept": "*/*",
    "x-turnstile-token": TURNSTILE_TOKEN,
  };
}

async function promptForToken() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question("Enter new TURNSTILE_TOKEN: ", token => {
    rl.close();
    resolve(token.trim());
  }));
}

async function promptContinue(message = "Rate limit hit. Press ENTER to retry or 'skip' to skip: ") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(message, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ===== API CALLS =====
async function fetchMasterVehicles() {
  const res = await fetch(`${API_BASE}/api/misc/getVehicleinfo`, {
    method: "POST",
    headers: makeHeaders(),
    body: "{}",
  });
  if (!res.ok) throw new Error(`getVehicleinfo failed: ${res.status}`);
  const data = await res.json();
  const flat = {};
  for (const v of data.Vehicles || []) if (v.key) flat[v.key] = v;
  return flat;
}

async function fetchSquadMembers(squadId) {
  const res = await fetch(`${API_BASE}/api/stat/MakeSquadRequest/${squadId}`, {
    method: "GET",
    headers: makeHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch members: ${res.status}`);
  const data = await res.json();
  if (!data.players) throw new Error("No players found in squad response.");
  return data.players;
}

async function fetchMakeStatById(playerId) {
  const url = `${API_BASE}/api/stat/MakeStatRequestById/${playerId}`;
  while (true) {
    const res = await fetch(url, { method: "POST", headers: makeHeaders(), body: "{}" });

    if (res.status === 406) {
      console.warn(`Received 406 for player ${playerId} — token likely expired.`);
      TURNSTILE_TOKEN = await promptForToken();
      continue;
    }

    if (res.status === 429) {
      const ans = await promptContinue();
      if (ans.toLowerCase() === "skip") return { Vehicles: [] };
      continue;
    }

    const text = await res.text();
    if (!text.trim()) return { Vehicles: [] };

    try { return JSON.parse(text); } catch {
      console.warn(`Failed to parse player ${playerId} data, skipping.`);
      return { Vehicles: [] };
    }
  }
}

// ===== VEHICLE PROCESSING =====
function extractVehicleRowsFromMakeStat(data) {
  const outRows = [];
  function walk(x) {
    if (Array.isArray(x)) {
      if (x.length && Array.isArray(x[0])) for (const child of x) walk(child);
      else {
        const last = x[x.length - 1];
        if (typeof last === "string" && last.includes("_") && x.length >= 3) outRows.push(x);
      }
    } else if (x && typeof x === "object") for (const v of Object.values(x)) walk(v);
  }
  if (data && data.Vehicles) walk(data.Vehicles);
  return outRows;
}

function buildOwnedListFromRows(rows, masterVehicles) {
  const owned = [];
  for (const r of rows) {
    const key = r[r.length - 1];
    const master = masterVehicles[key];
    owned.push({ key, name: master?.name || r[2] || key });
  }
  return owned;
}

function bucketByBR(masterVehicles, ownedList) {
  const buckets = {};
  BR_STEPS.forEach(b => (buckets[b.toFixed(1)] = []));
  buckets.UNKNOWN = [];

  for (const item of ownedList) {
    const master = masterVehicles[item.key];
    let br = master?.battleRatingArcade ?? master?.battleRatingHistorical ?? master?.battleRatingSimulation;
    if (typeof br === "number") {
      const closest = BR_STEPS.reduce((a, b) => Math.abs(b - br) < Math.abs(a - br) ? b : a);
      if (Math.abs(closest - br) <= 0.4) {
        buckets[closest.toFixed(1)].push(item.name);
        continue;
      }
    }
    buckets.UNKNOWN.push(item.name);
  }

  return buckets;
}

// ===== SAVE TO SQLITE =====
function saveToDatabase(playersData) {
  const insertTx = db.transaction(players => {
    // Clear old vehicles to avoid duplicates
    db.exec("DELETE FROM vehicles;");

    for (const p of players) {
      const user = insertUser.get(normalizeUsernameForDB(p.name), p.id);
      for (const [br, vehicles] of Object.entries(p.brBuckets)) {
        if (br === "UNKNOWN" || !vehicles?.length) continue;
        const brNum = parseFloat(br);
        for (const v of vehicles) {
          insertVehicle.run(user.id, brNum, v);
        }
      }
    }
  });

  insertTx(playersData);
  console.log(`✅ Saved ${playersData.length} players to ${dbPath}`);
}

// ===== MAIN =====
async function main() {
  try {
    console.log("Fetching squad members...");
    let players = await fetchSquadMembers(SQUAD_ID);
    if (PLAYER_LIMIT) players = players.slice(0, PLAYER_LIMIT);
    console.log(`Found ${players.length} players.`);

    console.log("Loading master vehicles...");
    const masterVehicles = await fetchMasterVehicles();

    const results = [];
    for (const p of players) {
      console.log(`Processing ${p.name} (${p.id})...`);
      const makeStat = await fetchMakeStatById(p.id);
      const rows = extractVehicleRowsFromMakeStat(makeStat);
      const owned = buildOwnedListFromRows(rows, masterVehicles);
      const brBuckets = bucketByBR(masterVehicles, owned);
      results.push({ id: p.id, name: p.name, brBuckets });
      await sleep(1000 + Math.random() * 1000);
    }

    saveToDatabase(results);
    console.log("✅ All done!");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    db.close();
  }
}

main();
