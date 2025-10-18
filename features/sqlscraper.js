import fetch from "node-fetch";
import { fileURLToPath } from "url";
import fs from "fs";
import readline from "readline";
import * as dotenv from "dotenv";
import Database from "better-sqlite3";
import path from "path";

dotenv.config( {path: "/home/cireland/Refactored-Bot/.env"} );

// ===== CONFIGURATION =====
const SQUAD_ID = "1125864";
let TURNSTILE_TOKEN = process.env.TURNSTILE_TOKEN;
const PLAYER_LIMIT = process.env.PLAYER_LIMIT;
const API_BASE = "https://statshark.net";

const MIN_GAMES = 20;

const BR_STEPS = [
  1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0,
  4.3, 4.7, 5.0, 5.3, 5.7, 6.0, 6.3, 6.7, 7.0,
  7.3, 7.7, 8.0, 8.3, 8.7, 9.0, 9.3, 9.7, 10.0,
  10.3, 10.7, 11.0, 11.3, 11.7, 12.0, 12.3, 12.7,
  13.0, 13.3, 13.7, 14.0, 14.3
];

// ===== DATABASE SETUP =====
const __fileName = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__fileName);

const dbPath = path.join(__dirname, "..", "data", "botdata.db");
const db = new Database(dbPath);

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
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vehicle_unique ON vehicles (user_id, vehicle_name);
`);

const insertUser = db.prepare(`
  INSERT INTO users (username, member_id)
  VALUES (?, ?)
  ON CONFLICT(member_id) DO UPDATE SET username = excluded.username
  RETURNING id
`);

const insertVehicle = db.prepare(`
  INSERT INTO vehicles (user_id, br, vehicle_name)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id, vehicle_name)
  DO UPDATE SET br = excluded.br
`);

// ===== HELPERS =====
function makeHeaders() {
  return { "accept": "*/*", "x-turnstile-token": TURNSTILE_TOKEN };
}

async function promptForToken() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question("Enter new TURNSTILE_TOKEN: ", token => {
      rl.close();
      resolve(token.trim());
    });
  });
}

async function promptContinue(message = "Rate limit hit. Press ENTER to retry or 'skip' to skip: ") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, ans => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function normalizeUsername(name) {
  if (!name) return "";
  return name.replace(/@psn|@live/gi, "").trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(minMs, maxMs) { return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs; }

// ===== API CALLS =====
async function fetchMasterVehicles() {
  const url = `${API_BASE}/api/misc/getVehicleinfo`;
  const res = await fetch(url, {
    method: "POST",
    headers: makeHeaders(),
    body: "{}"
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`getVehicleinfo failed: ${res.status} ${txt.slice(0,200)}`);
  }

  const data = await res.json();

  if (data.Vehicles) {
    const flat = {};
    for (const v of data.Vehicles) {
      if (v.key) flat[v.key] = v;
    }
    return flat;
  }

  return data;
}

async function fetchSquadMembers(squadId) {
  const res = await fetch(`${API_BASE}/api/stat/MakeSquadRequest/${squadId}`, {
    method: "GET", headers: makeHeaders()
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

    // Try normal parse first
    try {
      return JSON.parse(text);
    } catch {
      // Fallback: malformed JSON — multiple arrays at root level
      const matches = [...text.matchAll(/\[(?:\s*\[.*?\]\s*,?)*\]/gs)];
      if (matches.length >= 2) {
        // index 1 = realistic
        try {
          const realistic = JSON.parse(matches[1][0]);
          return { Vehicles: realistic };
        } catch (e) {
          console.warn("Failed to parse realistic section:", e);
          return { Vehicles: [] };
        }
      }
      console.warn(`Failed to parse player ${playerId} data, skipping.`);
      return { Vehicles: [] };
    }
  }
}


// ===== VEHICLE PROCESSING =====
function extractVehicleRowsFromMakeStat(data) {
  const outRows = [];

  const realisticArray = Array.isArray(data?.Vehicles) ? data.Vehicles[1] : null;
  if (!Array.isArray(realisticArray)) return outRows;

  function flattenVehicles(arr) {
    for (const item of arr) {
      if (Array.isArray(item[0])) {
        flattenVehicles(item);
      } else {
        const key = item[item.length - 1];
        const gamesPlayed = item[4]; // index 3 is games played
        if (key && typeof gamesPlayed === "number" && gamesPlayed >= MIN_GAMES) {
          outRows.push(item);
          console.log(`Row kept: games=${gamesPlayed} vehicle=${item[2]} key=${key}`);
        } else {
          console.log(`Row skipped: games=${gamesPlayed} vehicle=${item[2]} key=${key}`);
        }
      }
    }
  }

  flattenVehicles(realisticArray);
  console.log(`Kept ${outRows.length} vehicles with >= ${MIN_GAMES} games`);

  return outRows;
}






function buildOwnedListFromRows(rows, masterVehicles) {
  return rows.map(r => {
    const key = r[r.length - 1];
    const master = masterVehicles[key];
    return { key, name: master?.name || r[2] || key };
  });
}

function bucketByBR(masterVehicles, ownedList) {
  const buckets = {};
  BR_STEPS.forEach(b => buckets[b.toFixed(1)] = []);
  buckets.UNKNOWN = [];

  for (const item of ownedList) {
    const master = masterVehicles[item.key];
    let br = master?.battleRatingHistorical;
    if (typeof br === "number") {
      const closest = BR_STEPS.reduce((a, b) => Math.abs(b - br) < Math.abs(a - br) ? b : a);
      if (Math.abs(closest - br) <= 0.4) {
        buckets[closest.toFixed(1)].push(item.name);
        continue;
      }
    }
    buckets.UNKNOWN.push(item.name);
  }

  const out = {};
  Object.keys(buckets).forEach(k => {
    const seen = new Set();
    out[k] = buckets[k].filter(v => !seen.has(v) && seen.add(v)).join(", ");
  });
  return out;
}

// ===== DATABASE SAVE =====
function saveToDatabase(playersData) {
  const tx = db.transaction(players => {
    for (const p of players) {
      const user = insertUser.get(normalizeUsername(p.name), p.id);

      for (const [br, vehicles] of Object.entries(p.brBuckets)) {
        if (br === "UNKNOWN" || !vehicles) continue;

        vehicles.split(",")
          .map(v => v.trim())
          .filter(Boolean)
          .forEach(v => {
            insertVehicle.run(user.id, parseFloat(br), v);
          });
      }
    }
  });

  tx(playersData);
  console.log(`✅ Saved/updated ${playersData.length} players to database at ${dbPath}`);
}


// ===== MAIN =====
async function main() {
  try {
    console.log("Fetching squad members...");
    let players = await fetchSquadMembers(SQUAD_ID);
    if (PLAYER_LIMIT) players = players.slice(0, PLAYER_LIMIT);
    console.log(`Found ${players.length} players`);

    console.log("Fetching master vehicle info...");
    const masterVehicles = await fetchMasterVehicles();
    console.log(`Loaded ${Object.keys(masterVehicles).length} master vehicles`);

    const results = [];
    for (const p of players) {
      const normalizedName = normalizeUsername(p.name);
      console.log(`Processing ${normalizeUsername(p.name)} (${p.id})...`);
      const makeStat = await fetchMakeStatById(p.id);
      const rows = extractVehicleRowsFromMakeStat(makeStat);
      const ownedList = buildOwnedListFromRows(rows, masterVehicles);
      const brBuckets = bucketByBR(masterVehicles, ownedList);

      results.push({ id: p.id, name: normalizedName, brBuckets });

      await sleep(randomDelay(1000, 2000));
    }

    saveToDatabase(results);
    console.log("✅ Scraper finished successfully.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    db.close();
  }
}

main();
