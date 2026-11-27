import rateLimit from "express-rate-limit";

// Limits how often one visitor (by IP address) can hit the server, to slow down
// password-guessing style attacks and runaway scripts.
//
//   api    the dashboard's data. Generous: the dashboard refreshes itself every
//          few seconds, so a single open tab makes about 15 requests a minute.
//   auth   Discord login pages. Much stricter.
//   pages  the web page and its files
//
// Counts are kept in memory and reset when the bot restarts.

export const DEFAULT_LIMITS = {
  api: { windowMs: 60 * 1000, limit: 300 },
  auth: { windowMs: 15 * 60 * 1000, limit: 30 },
  pages: { windowMs: 60 * 1000, limit: 300 },
};

const make = ({ windowMs, limit }, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: message },
  });

/** Build the three limiters. Pass `overrides` (e.g. { auth: { limit: 3 } }) in tests. */
export function createLimiters(overrides = {}) {
  const cfg = {};
  for (const key of Object.keys(DEFAULT_LIMITS)) cfg[key] = { ...DEFAULT_LIMITS[key], ...(overrides[key] ?? {}) };
  return {
    api: make(cfg.api, "Too many requests. Please slow down."),
    // A second counter with the same limit, used on each route group. Both count every
    // API request, so the effective limit is unchanged; this just keeps every
    // route visibly behind a limiter as well as the gate in front of them.
    apiRoutes: make(cfg.api, "Too many requests. Please slow down."),
    auth: make(cfg.auth, "Too many login attempts. Please wait a few minutes."),
    pages: make(cfg.pages, "Too many requests. Please slow down."),
  };
}
