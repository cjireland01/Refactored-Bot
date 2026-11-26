import crypto from "crypto";
import { authConfig } from "../auth/config.js";
import { sessionUser } from "../auth/session.js";
import { accessLevel, rank } from "../auth/access.js";

// Who may do what on the dashboard.
//
//  - Discord login ON  (see server/auth/config.js): everything needs a login.
//    Viewers can look, editors (Chapter Master or higher) can change things.
//    ADMIN_TOKEN, if set, still works as an editor key for scripts.
//  - Discord login OFF: the original behaviour. Anyone can look; saving needs
//    ADMIN_TOKEN when one is set (and is open to everyone when it isn't).

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest();

// True if ADMIN_TOKEN is not set (no protection), or the request carries it.
function tokenOk(req) {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return true;
  const provided = req.get("x-admin-token") || "";
  // Compare hashes so the check takes the same time however close the guess is
  return crypto.timingSafeEqual(sha256(provided), sha256(expected));
}

const tokenProvidedAndValid = (req) =>
  Boolean(process.env.ADMIN_TOKEN?.trim()) && Boolean(req.get("x-admin-token")) && tokenOk(req);

/** Work out who is asking: { level, user, authEnabled } (remembered on the request) */
export async function resolveAccess(req) {
  if (req.access) return req.access;
  const cfg = authConfig();

  let access;
  if (!cfg.enabled) {
    access = { authEnabled: false, user: null, level: tokenOk(req) ? "editor" : "viewer" };
  } else if (tokenProvidedAndValid(req)) {
    access = { authEnabled: true, user: { id: "token", name: "Admin token" }, level: "editor" };
  } else {
    const user = sessionUser(req, cfg);
    access = { authEnabled: true, user, level: user ? await accessLevel(user.id) : "none" };
  }
  req.access = access;
  return access;
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

// Changes must come from the dashboard's own address, not from another website
function sameOrigin(req, cfg) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(cfg.publicUrl).host;
  } catch {
    return false;
  }
}

function guard(needed) {
  return async (req, res, next) => {
    try {
      const cfg = authConfig();
      const access = await resolveAccess(req);

      // Legacy mode: looking is open; editing needs the token (when one is set)
      if (!access.authEnabled) {
        if (needed === "viewer" || access.level === "editor") return next();
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!SAFE.has(req.method) && !access.user?.id?.startsWith?.("token") && !sameOrigin(req, cfg)) {
        return res.status(403).json({ error: "Cross-site request refused" });
      }
      if (rank(access.level) >= rank(needed)) return next();

      if (!access.user) return res.status(401).json({ error: "Login required", login: "/auth/login" });
      res.status(403).json({
        error: needed === "editor" ? `Needs the ${cfg.editorRole} role or higher` : "No access",
      });
    } catch (err) {
      next(err);
    }
  };
}

export const requireViewer = guard("viewer");

/** Editors only, for every method (reads included). Used for the member list. */
export const requireAdmin = guard("editor");

/** Looking needs a viewer, changing things needs an editor */
export function requireAdminForWrites(req, res, next) {
  return (SAFE.has(req.method) ? requireViewer : requireAdmin)(req, res, next);
}

/** GET /api/me - who am I, and what may I do (open to everyone) */
export async function meHandler(req, res, next) {
  try {
    const access = await resolveAccess(req);
    const { authEnabled, user } = access;
    // Without Discord login the dashboard's own token prompt handles editing, so show everything
    const level = authEnabled ? access.level : "editor";
    res.json({
      authEnabled,
      user: user && user.id !== "token" ? { id: user.id, name: user.name, avatar: user.avatar } : user,
      level,
      canEdit: level === "editor",
    });
  } catch (err) {
    next(err);
  }
}
