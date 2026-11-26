import crypto from "crypto";
import { authConfig } from "./config.js";

// A login is a signed cookie: { id, name, avatar, exp } + a signature made with
// SESSION_SECRET. Nothing is stored on the server, and nobody can forge or
// change one without the secret. What the person may DO is looked up from
// their Discord roles on every request, so removing a role takes effect at once.

export const SESSION_COOKIE = "vcom_session";
export const STATE_COOKIE = "vcom_oauth";

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const sign = (payload, secret) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Make a signed value from an object */
export function seal(data, secret = authConfig().sessionSecret) {
  const payload = b64(JSON.stringify(data));
  return `${payload}.${sign(payload, secret)}`;
}

/** Read a signed value back; null if it's forged, damaged or expired */
export function unseal(value, secret = authConfig().sessionSecret, now = Date.now()) {
  if (!value || !secret || typeof value !== "string") return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // ignore a cookie we can't decode
    }
  }
  return out;
}

export function cookieHeader(name, value, { maxAgeSeconds, secure }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** The cookie header that logs a person in */
export function loginCookie(user, cfg = authConfig(), now = Date.now()) {
  const exp = now + cfg.sessionDays * 86400000;
  const value = seal({ id: user.id, name: user.name, avatar: user.avatar ?? null, exp }, cfg.sessionSecret);
  return cookieHeader(SESSION_COOKIE, value, { maxAgeSeconds: cfg.sessionDays * 86400, secure: cfg.secureCookies });
}

export const logoutCookie = (cfg = authConfig()) =>
  cookieHeader(SESSION_COOKIE, "", { maxAgeSeconds: 0, secure: cfg.secureCookies });

/** Who is logged in on this request (or null) */
export function sessionUser(req, cfg = authConfig()) {
  if (!cfg.enabled) return null;
  const data = unseal(parseCookies(req.headers.cookie)[SESSION_COOKIE], cfg.sessionSecret);
  return data ? { id: data.id, name: data.name, avatar: data.avatar } : null;
}
