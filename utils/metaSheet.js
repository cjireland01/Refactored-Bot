import axios from "axios";
import crypto from "crypto";
import db from "./db.js";
import { META_SHEET } from "../config/constants.js";
import { sanitizeVehicleName } from "./vehicleNames.js";

// The "meta sheet": a Google Sheet that lists the vehicles the squadron
// considers meta. Layout: nations across a header row (the row starting with
// "Battle Rating"), vehicle names in the cells underneath. A cell can hold
// several vehicles ("M42 / M19") and "♥" marks premiums.
//
// The bot downloads the sheet as CSV, keeps the cells in the database (so a
// restart or a Google outage never empties the queues) and matches them to
// players' vehicles by nation + name.

// Header text in the sheet -> the country value the scraper stores
const NATIONS = {
  usa: "country_usa",
  germany: "country_germany",
  ussr: "country_ussr",
  "united kingdom": "country_britain",
  britain: "country_britain",
  japan: "country_japan",
  china: "country_china",
  italy: "country_italy",
  france: "country_france",
  sweden: "country_sweden",
  israel: "country_israel",
};

// Minimum cells a download must have to be trusted (guards against Google
// returning a login page or an empty tab)
const MIN_CELLS = 20;

// ---------- CSV + parsing (pure, easy to test) ----------

/** Minimal CSV reader: quotes, escaped quotes, commas and newlines inside quotes */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = String(text ?? "").replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "Italy/Hungary" -> "country_italy" (first nation we know), else null */
function nationToCountry(label) {
  for (const part of String(label ?? "").split("/")) {
    const key = part.trim().toLowerCase();
    if (NATIONS[key]) return NATIONS[key];
  }
  return null;
}

/**
 * Pull [{ country, cell }] out of the sheet's CSV text.
 * Returns null when it doesn't look like the meta sheet (no header row).
 */
export function parseMetaSheet(csvText) {
  const rows = parseCsv(csvText);
  const headerIdx = rows.findIndex((r) => String(r[0] ?? "").trim().toLowerCase() === "battle rating");
  if (headerIdx === -1) return null;

  const countries = rows[headerIdx].map(nationToCountry);
  const seen = new Set();
  const cells = [];

  for (const row of rows.slice(headerIdx + 1)) {
    // The key at the bottom ("Meta", "Specialist", ...) is not a vehicle list
    if (row.some((c) => /^\s*absolute meta\s*$/i.test(c ?? ""))) break;

    for (let col = 1; col < row.length; col++) {
      const country = countries[col];
      const cell = String(row[col] ?? "").replace(/\s+/g, " ").trim();
      if (!country || !cell) continue;
      const id = `${country}|${cell}`;
      if (seen.has(id)) continue;
      seen.add(id);
      cells.push({ country, cell });
    }
  }
  return cells;
}

/** Lowercase letters and digits only, after the same cleanup the queues use */
export function nameKey(name) {
  return sanitizeVehicleName(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * The vehicle names a single cell may mean. "M42 / M19" is two vehicles; a
 * name that itself contains a slash ("Leopard 40/70") is tried whole too; and
 * "Type 74 (E) / (F)" means "Type 74 (E)" and "Type 74 (F)".
 */
export function cellCandidates(cell) {
  const clean = String(cell).replace(/\*+/g, " ").replace(/♥/g, " ").replace(/\s+/g, " ").trim();
  const out = new Set([clean]);

  let previousBase = "";
  for (let part of clean.split("/")) {
    part = part.trim();
    if (!part) continue;
    if (part.startsWith("(") && previousBase) part = `${previousBase} ${part}`;
    out.add(part);
    previousBase = part.replace(/\s*\([^)]*\)\s*$/, "").trim() || previousBase;
  }
  return [...out].filter(Boolean);
}

// ---------- the live list ----------

let byCountry = new Map(); // country -> Set of name keys
let anyCountry = new Set(); // every key (used when a vehicle has no country)
let cells = []; // [{ country, cell }]
let status = { enabled: false, lastFetched: null, lastChanged: null, error: null };

const stmts = {
  all: db.prepare("SELECT country, cell FROM meta_sheet_cells"),
  clear: db.prepare("DELETE FROM meta_sheet_cells"),
  add: db.prepare("INSERT OR IGNORE INTO meta_sheet_cells (country, cell) VALUES (?, ?)"),
  dbNames: db.prepare("SELECT DISTINCT country, vehicle_name FROM vehicles"),
};

// META_SHEET_URL can hold several links (one per tab), separated by commas or spaces
const sheetUrls = () => String(META_SHEET.URL ?? "").split(/[\s,]+/).filter(Boolean);
const hasSheetConfigured = () => sheetUrls().length > 0;

function index(list) {
  cells = list;
  byCountry = new Map();
  anyCountry = new Set();
  for (const { country, cell } of list) {
    if (!byCountry.has(country)) byCountry.set(country, new Set());
    for (const cand of cellCandidates(cell)) {
      const key = nameKey(cand);
      if (!key) continue;
      byCountry.get(country).add(key);
      anyCountry.add(key);
    }
  }
}

/** Load the last saved copy of the sheet from the database */
export function loadSavedMetaSheet() {
  index(stmts.all.all());
}

/** True when a sheet is configured, so the queues should filter by it */
export function isSheetMetaActive() {
  return hasSheetConfigured();
}

/** Is this vehicle on the sheet? `country` is the scraper's value (e.g. country_usa) */
export function isOnMetaSheet(country, vehicleName) {
  const key = nameKey(vehicleName);
  if (!key) return false;
  if (!country) return anyCountry.has(key);
  return byCountry.get(country)?.has(key) ?? false;
}

/** Google link (or direct CSV link) -> the address that returns the CSV */
export function toCsvUrl(link) {
  const url = String(link ?? "").trim();
  if (!url) return "";
  if (/output=csv|format=csv/.test(url)) return url;
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return url;
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

async function downloadCsv(link) {
  const res = await axios.get(toCsvUrl(link), {
    responseType: "text",
    timeout: 20000,
    transformResponse: (d) => d,
    headers: { "User-Agent": "Mozilla/5.0 (VCoM bot)" },
  });
  return res.data;
}

const fingerprint = (list) =>
  crypto
    .createHash("sha256")
    .update(list.map((c) => `${c.country}|${c.cell}`).sort().join("\n"))
    .digest("hex");

/**
 * Download the sheet and, if it looks right, replace the saved copy.
 * Never throws. Returns { ok, changed, error? }. A bad download keeps the old list.
 * `fetchText(link)` can be passed in for tests.
 */
export async function refreshMetaSheet({ fetchText = downloadCsv } = {}) {
  if (!hasSheetConfigured()) return { ok: false, changed: false, error: "No META_SHEET_URL set" };

  try {
    // Every tab must download fine; otherwise keep the old list rather than lose a tab's vehicles
    const parsed = [];
    const seen = new Set();
    for (const [i, link] of sheetUrls().entries()) {
      const tab = parseMetaSheet(await fetchText(link));
      if (!tab) {
        throw new Error(
          `Link ${i + 1} doesn't look like the meta sheet (no 'Battle Rating' header row). Is it shared with 'anyone with the link'?`
        );
      }
      for (const c of tab) {
        const id = `${c.country}|${c.cell}`;
        if (!seen.has(id)) {
          seen.add(id);
          parsed.push(c);
        }
      }
    }
    if (parsed.length < MIN_CELLS) throw new Error(`Only ${parsed.length} entries found - not replacing the saved list`);

    const changed = fingerprint(parsed) !== fingerprint(cells);
    if (changed) {
      db.transaction(() => {
        stmts.clear.run();
        for (const { country, cell } of parsed) stmts.add.run(country, cell);
      })();
      index(parsed);
      status.lastChanged = Date.now();
    }
    status = { ...status, enabled: true, lastFetched: Date.now(), error: null };
    return { ok: true, changed };
  } catch (err) {
    const message = err?.response ? `Google answered ${err.response.status}` : err.message;
    status = { ...status, enabled: true, error: message };
    console.warn("[metaSheet] Could not refresh:", message);
    return { ok: false, changed: false, error: message };
  }
}

/**
 * For the dashboard: how the sheet is doing, and which entries matched
 * nothing in the vehicle database (usually a typo or a different spelling).
 */
export function getMetaSheetStatus() {
  const known = new Map(); // country -> Set of keys in the database
  for (const { country, vehicle_name } of stmts.dbNames.all()) {
    const k = country ?? "";
    if (!known.has(k)) known.set(k, new Set());
    known.get(k).add(nameKey(vehicle_name));
  }
  const allKnown = new Set([...known.values()].flatMap((s) => [...s]));

  const unmatched = [];
  for (const { country, cell } of cells) {
    const inDb = known.get(country) ?? new Set();
    const found = cellCandidates(cell).some((c) => inDb.has(nameKey(c)) || (!known.has(country) && allKnown.has(nameKey(c))));
    if (!found) unmatched.push({ country, cell });
  }

  return {
    enabled: hasSheetConfigured(),
    entries: cells.length,
    unmatched,
    lastFetched: status.lastFetched,
    lastChanged: status.lastChanged,
    error: status.error,
  };
}

// Use what was saved last time as soon as the bot starts
try {
  loadSavedMetaSheet();
} catch (err) {
  console.warn("[metaSheet] Could not load saved list:", err.message);
}
