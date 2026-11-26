import crypto from "crypto";
import axios from "axios";
import express from "express";
import { authConfig } from "./config.js";
import {
  SESSION_COOKIE, STATE_COOKIE, seal, unseal, parseCookies, cookieHeader, loginCookie, logoutCookie,
} from "./session.js";
import { accessLevel } from "./access.js";

const DISCORD = "https://discord.com/api";

// Talking to Discord lives in one object so tests can swap it out
export const discordApi = {
  async exchangeCode(code, cfg) {
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${cfg.publicUrl}/auth/callback`,
    });
    const { data } = await axios.post(`${DISCORD}/oauth2/token`, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });
    return data.access_token;
  },
  async getUser(accessToken) {
    const { data } = await axios.get(`${DISCORD}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    return { id: data.id, name: data.global_name || data.username, avatar: data.avatar };
  },
};

const router = express.Router();

const page = (res, status, title, message) =>
  res
    .status(status)
    .type("html")
    .send(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>${title}</title><body style="font-family:system-ui;background:#111827;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0">` +
        `<div style="max-width:28rem;padding:1.5rem"><h1 style="font-size:1.25rem">${title}</h1><p style="color:#d1d5db">${message}</p>` +
        `<p><a style="color:#93c5fd" href="/">Back to the dashboard</a></p></div></body>`
    );

// Step 1: send the person to Discord to approve
router.get("/login", (req, res) => {
  const cfg = authConfig();
  if (!cfg.enabled) return page(res, 404, "Login is not set up", "Discord login is not turned on for this dashboard.");

  const state = crypto.randomBytes(16).toString("base64url");
  res.setHeader(
    "Set-Cookie",
    cookieHeader(STATE_COOKIE, seal({ state, exp: Date.now() + 10 * 60 * 1000 }, cfg.sessionSecret), {
      maxAgeSeconds: 600,
      secure: cfg.secureCookies,
    })
  );
  const url = new URL(`${DISCORD}/oauth2/authorize`);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: `${cfg.publicUrl}/auth/callback`,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "none",
  }).toString();
  res.redirect(url.toString());
});

// Step 2: Discord sends them back with a code
router.get("/callback", async (req, res) => {
  const cfg = authConfig();
  if (!cfg.enabled) return page(res, 404, "Login is not set up", "Discord login is not turned on for this dashboard.");

  const saved = unseal(parseCookies(req.headers.cookie)[STATE_COOKIE], cfg.sessionSecret);
  const { code, state, error } = req.query;
  if (error) return page(res, 400, "Login cancelled", "You didn't approve the login.");
  if (!saved || typeof state !== "string" || state !== saved.state || typeof code !== "string") {
    return page(res, 400, "Login expired", "That login attempt wasn't valid or took too long. Please try again.");
  }

  try {
    const user = await discordApi.getUser(await discordApi.exchangeCode(code, cfg));
    const level = await accessLevel(user.id);
    if (level === "none") {
      res.setHeader("Set-Cookie", [logoutCookie(cfg)]);
      return page(res, 403, "No access", authConfig().viewerRole
          ? `You need to be in the squadron's Discord server with the ${authConfig().viewerRole} role (or higher) to use this dashboard.`
          : "You need to be a member of the squadron's Discord server to use this dashboard."
      );
    }
    res.setHeader("Set-Cookie", [
      loginCookie(user, cfg),
      cookieHeader(STATE_COOKIE, "", { maxAgeSeconds: 0, secure: cfg.secureCookies }),
    ]);
    res.redirect("/");
  } catch (err) {
    console.warn("[auth] Login failed:", err.response?.status ?? err.message);
    page(res, 502, "Login failed", "Could not finish signing in with Discord. Please try again.");
  }
});

router.post("/logout", (req, res) => {
  res.setHeader("Set-Cookie", logoutCookie());
  res.json({ success: true });
});

export default router;
export { SESSION_COOKIE };
