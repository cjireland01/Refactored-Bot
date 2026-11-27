import { authConfig } from "./config.js";

// What someone may do, decided from their Discord roles in the squadron server:
//   none    - not in the server (or lacks the viewer role, if one is set)
//   viewer  - can look at everything
//   editor  - the editor role (default "Chapter Master") or any role above it:
//             can change the BR schedule, meta list, alts
//
// The bot side registers how to look roles up (so this file never needs Discord).

export const LEVELS = ["none", "viewer", "editor"];
export const rank = (level) => LEVELS.indexOf(level);

let lookup = async () => "none";
const cache = new Map(); // userId -> { level, at }
const CACHE_MS = 30 * 1000;
const CACHE_NONE_MS = 10 * 1000; // refusals are remembered briefly, so fixing a role works almost at once

/** Bot side: `fn(userId, cfg)` returns "none" | "viewer" | "editor" */
export function setAccessLookup(fn) {
  lookup = fn;
  cache.clear();
}

export function clearAccessCache() {
  cache.clear();
}

/** The person's level, remembered for a minute so we don't ask Discord on every click */
export async function accessLevel(userId, now = Date.now()) {
  const hit = cache.get(userId);
  if (hit && now - hit.at < (hit.level === "none" ? CACHE_NONE_MS : CACHE_MS)) return hit.level;
  let level = "none";
  try {
    level = await lookup(userId, authConfig());
  } catch (err) {
    console.warn("[auth] Could not check roles:", err.message);
    return hit?.level ?? "none"; // keep the last answer if Discord is briefly unreachable
  }
  if (!LEVELS.includes(level)) level = "none";
  cache.set(userId, { level, at: now });
  return level;
}
