import "../test-support/tempDb.js";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Login settings, as they'd be in .env (set before the modules are loaded)
process.env.CLIENT_ID = "1234";
process.env.DISCORD_CLIENT_SECRET = "shh";
process.env.WEB_GUILD_ID = "999";
process.env.SESSION_SECRET = "a-long-random-secret-for-tests";
process.env.PUBLIC_URL = "https://dash.example.com";

const { createApp } = await import("../server/app.js");
const { discordApi } = await import("../server/auth/routes.js");
const { setAccessLookup, clearAccessCache } = await import("../server/auth/access.js");
const session = await import("../server/auth/session.js");
const { authConfig } = await import("../server/auth/config.js");

let server;
let base;
const people = {}; // discord id -> level, what the "bot" would answer

before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  setAccessLookup(async (id) => people[id] ?? "none");
});
after(() => server.close());
beforeEach(() => {
  for (const k of Object.keys(people)) delete people[k];
  clearAccessCache();
});

const cookieFor = (user) => session.loginCookie(user).split(";")[0]; // "vcom_session=..."
const get = (path, cookie, headers = {}) => fetch(base + path, { headers: { ...(cookie ? { cookie } : {}), ...headers }, redirect: "manual" });
const post = (path, body, cookie, headers = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify(body),
  });

test("a signed session can't be forged, changed or used after it expires", () => {
  const secret = "s";
  const good = session.seal({ id: "1", exp: Date.now() + 1000 }, secret);
  assert.equal(session.unseal(good, secret).id, "1");
  assert.equal(session.unseal(good, "other"), null);
  const [payload, sig] = good.split(".");
  const tampered = Buffer.from(JSON.stringify({ id: "2", exp: Date.now() + 1000 })).toString("base64url");
  assert.equal(session.unseal(`${tampered}.${sig}`, secret), null);
  assert.equal(session.unseal(`${payload}.`, secret), null);
  assert.equal(session.unseal(session.seal({ id: "1", exp: Date.now() - 1 }, secret), secret), null);
  assert.equal(session.unseal("garbage", secret), null);
});

test("with login on, nothing is readable without logging in", async () => {
  for (const path of ["/api/status", "/api/br", "/api/stats", "/api/meta-vehicles", "/api/meta-sheet"]) {
    const res = await get(path);
    assert.equal(res.status, 401, path);
    assert.equal((await res.json()).login, "/auth/login");
  }
});

test("/api/me works for everyone and says whether login is on", async () => {
  const anon = await (await get("/api/me")).json();
  assert.deepEqual([anon.authEnabled, anon.user, anon.level, anon.canEdit], [true, null, "none", false]);

  people["10"] = "viewer";
  const me = await (await get("/api/me", cookieFor({ id: "10", name: "Vee" }))).json();
  assert.deepEqual([me.user.name, me.level, me.canEdit], ["Vee", "viewer", false]);
});

test("viewers can look but not change; editors can do both", async () => {
  people["10"] = "viewer";
  people["20"] = "editor";
  const viewer = cookieFor({ id: "10", name: "Vee" });
  const editor = cookieFor({ id: "20", name: "Ed" });

  assert.equal((await get("/api/status", viewer)).status, 200);
  assert.equal((await get("/api/br", viewer)).status, 200);

  const change = { br: 9.7, start: "2033-01-01" };
  const denied = await post("/api/br", change, viewer);
  assert.equal(denied.status, 403);
  assert.match((await denied.json()).error, /Chapter Master/);
  assert.equal((await post("/api/br", change, editor)).status, 200);
});

test("the member list is for editors only", async () => {
  people["10"] = "viewer";
  people["20"] = "editor";
  assert.equal((await get("/api/alts", cookieFor({ id: "10", name: "Vee" }))).status, 403);
  assert.equal((await get("/api/alts", cookieFor({ id: "20", name: "Ed" }))).status, 200);
});

test("losing a role takes effect (after the short cache)", async () => {
  people["20"] = "editor";
  const editor = cookieFor({ id: "20", name: "Ed" });
  assert.equal((await post("/api/br", { br: 9.7, start: "2034-01-01" }, editor)).status, 200);

  people["20"] = "none"; // role removed / left the server
  clearAccessCache(); // (in real life this happens within a minute)
  assert.equal((await get("/api/status", editor)).status, 403);
  assert.equal((await post("/api/br", { br: 9.7, start: "2034-02-01" }, editor)).status, 403);
});

test("a forged or expired cookie is not a login", async () => {
  people["20"] = "editor";
  const forged = `${session.SESSION_COOKIE}=${session.seal({ id: "20", name: "x", exp: Date.now() + 99999 }, "wrong-secret")}`;
  assert.equal((await get("/api/status", forged)).status, 401);
  const cfg = authConfig();
  const expired = session.loginCookie({ id: "20", name: "x" }, cfg, Date.now() - 30 * 86400000).split(";")[0];
  assert.equal((await get("/api/status", expired)).status, 401);
});

test("changes from another website are refused, even with a valid login", async () => {
  people["20"] = "editor";
  const editor = cookieFor({ id: "20", name: "Ed" });
  const evil = await post("/api/br", { br: 9.7, start: "2035-01-01" }, editor, { Origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  const ours = await post("/api/br", { br: 9.7, start: "2035-01-01" }, editor, { Origin: "https://dash.example.com" });
  assert.equal(ours.status, 200);
});

test("ADMIN_TOKEN still works as an editor key", async () => {
  process.env.ADMIN_TOKEN = "s3cret";
  try {
    assert.equal((await get("/api/status", null, { "x-admin-token": "wrong" })).status, 401);
    assert.equal((await post("/api/br", { br: 9.7, start: "2036-01-01" }, null, { "x-admin-token": "s3cret" })).status, 200);
  } finally {
    delete process.env.ADMIN_TOKEN;
  }
});

test("/auth/login sends people to Discord with a one-time state", async () => {
  const res = await get("/auth/login");
  assert.equal(res.status, 302);
  const url = new URL(res.headers.get("location"));
  assert.equal(url.origin + url.pathname, "https://discord.com/api/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "1234");
  assert.equal(url.searchParams.get("redirect_uri"), "https://dash.example.com/auth/callback");
  assert.equal(url.searchParams.get("scope"), "identify");
  assert.ok(url.searchParams.get("state").length >= 16);
  assert.match(res.headers.getSetCookie().join(";"), /vcom_oauth=.*HttpOnly.*Secure/s);
});

async function startLogin() {
  const res = await get("/auth/login");
  const state = new URL(res.headers.get("location")).searchParams.get("state");
  const stateCookie = res.headers.getSetCookie()[0].split(";")[0];
  return { state, stateCookie };
}

test("callback: a server member gets a login cookie", async () => {
  discordApi.exchangeCode = async () => "tok";
  discordApi.getUser = async () => ({ id: "10", name: "Vee", avatar: null });
  people["10"] = "viewer";

  const { state, stateCookie } = await startLogin();
  const res = await get(`/auth/callback?code=abc&state=${state}`, stateCookie);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/");
  const cookies = res.headers.getSetCookie();
  const login = cookies.find((c) => c.startsWith("vcom_session="));
  assert.match(login, /HttpOnly/);
  assert.match(login, /SameSite=Lax/);
  assert.match(login, /Secure/);
  assert.equal((await get("/api/status", login.split(";")[0])).status, 200);
});

test("callback: someone outside the server is turned away", async () => {
  discordApi.exchangeCode = async () => "tok";
  discordApi.getUser = async () => ({ id: "77", name: "Stranger", avatar: null });
  const { state, stateCookie } = await startLogin();
  const res = await get(`/auth/callback?code=abc&state=${state}`, stateCookie);
  assert.equal(res.status, 403);
  assert.ok(!res.headers.getSetCookie().some((c) => /^vcom_session=[^;]+/.test(c) && !/Max-Age=0/.test(c)));
});

test("callback: wrong or missing state is refused", async () => {
  discordApi.exchangeCode = async () => assert.fail("must not reach Discord");
  const { stateCookie } = await startLogin();
  assert.equal((await get("/auth/callback?code=abc&state=nope", stateCookie)).status, 400);
  assert.equal((await get("/auth/callback?code=abc&state=nope")).status, 400);
});

test("callback: a Discord failure is a clean error, not a crash", async () => {
  discordApi.exchangeCode = async () => {
    throw new Error("discord down");
  };
  const { state, stateCookie } = await startLogin();
  assert.equal((await get(`/auth/callback?code=abc&state=${state}`, stateCookie)).status, 502);
});

test("logout clears the cookie", async () => {
  const res = await fetch(base + "/auth/logout", { method: "POST" });
  assert.match(res.headers.getSetCookie().join(";"), /vcom_session=;.*Max-Age=0/s);
});

test("pages carry basic security headers", async () => {
  const res = await get("/api/me");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
});
