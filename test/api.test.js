import "../test-support/tempDb.js";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.ADMIN_TOKEN = "s3cret";

const { createApp } = await import("../server/app.js");
const { default: db } = await import("../utils/db.js");
const { onAltsChanged } = await import("../server/hooks.js");
const { recordStats } = await import("../utils/stats.js");

let server;
let base;
let altsChangedCalls = 0;

const get = (path, token) => fetch(base + path, { headers: token ? { "x-admin-token": token } : {} });
const send = (method, path, body, token) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

before(async () => {
  onAltsChanged(() => {
    altsChangedCalls++;
  });
  db.prepare("INSERT INTO br_schedule (br, start) VALUES (10.7, ?)").run(day(-2));
  db.prepare("INSERT INTO br_schedule (br, start) VALUES (9.7, ?)").run(day(5));
  const user = db.prepare("INSERT INTO users (username, member_id, is_alt) VALUES (?, ?, ?)");
  user.run("Alice", "a", 0);
  user.run("AltGuy", "c", 1);
  db.prepare(
    "INSERT INTO vehicles (user_id, br, vehicle_name, country, move_type) VALUES (2, 10.7, 'Alt Tank', 'country_usa', 'tank')"
  ).run();
  db.prepare("INSERT INTO vehicles (user_id, br, vehicle_name) VALUES (1, 10.7, 'Leopard 2A4')").run();

  await new Promise((resolve) => {
    server = createApp().listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

// ---------- status ----------
test("status shows the current BR and a live countdown", async () => {
  const body = await (await get("/api/status")).json();
  assert.equal(body.currentBR, "10.7");
  assert.match(body.brEndsIn, /^\d+d \d+h$/);
  assert.ok(Array.isArray(body.voiceUsers));
});

test("alt queue lists alts with all their vehicles", async () => {
  const body = await (await get("/api/status/altqueue")).json();
  assert.equal(body.alts.length, 1);
  assert.equal(body.alts[0].username, "AltGuy");
  assert.equal(body.alts[0].vehicles[0].Vehicle, "Alt Tank");
});

// ---------- meta vehicles (the doubled-route bug) ----------
test("meta vehicles are served as JSON at /api/meta-vehicles", async () => {
  const res = await get("/api/meta-vehicles");
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.ok(list.some((v) => v.vehicle_name === "Alt Tank"));
});

test("meta flag can be set and unset", async () => {
  assert.equal((await send("POST", "/api/meta-vehicles", { vehicle_name: "Alt Tank", is_meta: 1 }, "s3cret")).status, 200);
  let list = await (await get("/api/meta-vehicles")).json();
  assert.equal(list.find((v) => v.vehicle_name === "Alt Tank").is_meta, 1);
  await send("POST", "/api/meta-vehicles", { vehicle_name: "Alt Tank", is_meta: 0 }, "s3cret");
  list = await (await get("/api/meta-vehicles")).json();
  assert.equal(list.find((v) => v.vehicle_name === "Alt Tank").is_meta, 0);
});

test("meta POST rejects a missing vehicle name", async () => {
  assert.equal((await send("POST", "/api/meta-vehicles", { vehicle_name: "" }, "s3cret")).status, 400);
});

// ---------- BR schedule ----------
test("BR schedule: add, update, delete", async () => {
  assert.equal((await send("POST", "/api/br", { br: 8.7, start: "2031-01-01" }, "s3cret")).status, 200);
  let rows = await (await get("/api/br")).json();
  const row = rows.find((r) => r.start === "2031-01-01");
  assert.equal(row.br, 8.7);

  await send("POST", "/api/br", { id: row.id, br: 9.0, start: "2031-01-02" }, "s3cret");
  rows = await (await get("/api/br")).json();
  assert.equal(rows.find((r) => r.id === row.id).start, "2031-01-02");

  assert.equal((await send("DELETE", `/api/br/${row.id}`, undefined, "s3cret")).status, 200);
  rows = await (await get("/api/br")).json();
  assert.ok(!rows.some((r) => r.id === row.id));
});

test("BR schedule rejects bad input", async () => {
  assert.equal((await send("POST", "/api/br", { br: "abc", start: "2031-01-01" }, "s3cret")).status, 400);
  assert.equal((await send("POST", "/api/br", { br: 99, start: "2031-01-01" }, "s3cret")).status, 400);
  assert.equal((await send("POST", "/api/br", { br: 9.7, start: "tomorrow" }, "s3cret")).status, 400);
  assert.equal((await send("POST", "/api/br", { br: 9.7, start: "2031-13-45" }, "s3cret")).status, 400);
});

// ---------- admin token ----------
test("anyone can view, but saving needs the admin token", async () => {
  assert.equal((await get("/api/br")).status, 200);
  assert.equal((await send("POST", "/api/br", { br: 9.7, start: "2032-01-01" })).status, 401);
  assert.equal((await send("POST", "/api/br", { br: 9.7, start: "2032-01-01" }, "wrong")).status, 401);
  assert.equal((await send("POST", "/api/br", { br: 9.7, start: "2032-01-01" }, "s3cret")).status, 200);
});

// ---------- alt management ----------
test("the member list is hidden without the token, reads included", async () => {
  assert.equal((await get("/api/alts")).status, 401);
  assert.equal((await get("/api/alts", "wrong")).status, 401);
});

test("the member list shows everyone with their vehicle counts", async () => {
  const { users } = await (await get("/api/alts", "s3cret")).json();
  assert.deepEqual(users.map((u) => u.username), ["Alice", "AltGuy"]);
  const alice = users.find((u) => u.username === "Alice");
  assert.equal(alice.is_alt, 0);
  assert.equal(alice.vehicle_count, 1);
  assert.equal(users.find((u) => u.username === "AltGuy").is_alt, 1);
});

test("marking and unmarking an alt saves it and tells the bot to refresh Discord", async () => {
  const before = altsChangedCalls;
  assert.equal((await send("POST", "/api/alts", { id: 1, is_alt: true }, "s3cret")).status, 200);
  assert.equal(db.prepare("SELECT is_alt FROM users WHERE id = 1").get().is_alt, 1);
  assert.equal((await send("POST", "/api/alts", { id: 1, is_alt: 0 }, "s3cret")).status, 200);
  assert.equal(db.prepare("SELECT is_alt FROM users WHERE id = 1").get().is_alt, 0);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(altsChangedCalls, before + 2);
});

test("alt changes are validated", async () => {
  assert.equal((await send("POST", "/api/alts", { id: "x", is_alt: true }, "s3cret")).status, 400);
  assert.equal((await send("POST", "/api/alts", { id: 1, is_alt: "yes" }, "s3cret")).status, 400);
  assert.equal((await send("POST", "/api/alts", { id: 999, is_alt: true }, "s3cret")).status, 404);
  assert.equal((await send("POST", "/api/alts", { id: 1, is_alt: true })).status, 401);
});

// ---------- stats ----------
test("stats are empty until something is recorded", async () => {
  const body = await (await get("/api/stats")).json();
  assert.equal(body.current, null);
  assert.deepEqual(body.history, []);
  assert.equal(body.range, "7d");
});

test("stats show the latest numbers, a baseline and history", async () => {
  const squad = (score, wins) => ({ members_cnt: 80, astat: { dr_era5_hist: score, wins_hist: wins, battles_hist: 1000 } });
  const now = Date.now();
  recordStats(squad(100000, 500), 9, { now: now - 30 * 3600 * 1000, force: true });
  recordStats(squad(110000, 520), 7, { now, force: true });

  const body = await (await get("/api/stats?range=7d")).json();
  assert.equal(body.current.position, 7);
  assert.equal(body.current.score, 110000);
  assert.equal(body.baseline.score, 100000);
  assert.equal(body.history.length, 2);
});

test("stats ranges are respected, and an unknown one is not an error", async () => {
  const day24 = await (await get("/api/stats?range=24h")).json();
  assert.equal(day24.range, "24h");
  assert.equal(day24.history.length, 1);
  assert.equal((await get("/api/stats?range=nonsense")).status, 200);
  assert.equal((await (await get("/api/stats?range=nonsense")).json()).range, "7d");
});

// ---------- misc ----------
test("meta sheet status says it is off when no sheet is set", async () => {
  const res = await get("/api/meta-sheet");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.enabled, false);
  assert.deepEqual(body.unmatched, []);
});

test("refreshing the meta sheet needs the admin token when one is set", async () => {
  process.env.ADMIN_TOKEN = "s3cret";
  try {
    assert.equal((await send("POST", "/api/meta-sheet/refresh", {})).status, 401);
    // with the token it runs, and says plainly that no sheet is set
    const res = await send("POST", "/api/meta-sheet/refresh", {}, "s3cret");
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /META_SHEET_URL/);
  } finally {
    delete process.env.ADMIN_TOKEN;
  }
});

test("/api/me without Discord login: login is off and everything is shown", async () => {
  const me = await (await get("/api/me")).json();
  assert.deepEqual([me.authEnabled, me.user, me.canEdit], [false, null, true]);
});

test("unknown API paths are a 404, not the web page", async () => {
  assert.equal((await get("/api/nope")).status, 404);
});

test("the site explains itself when the dashboard has not been built", async () => {
  const res = await get("/schedule");
  // 200 if client/dist exists on this machine, otherwise the friendly message
  assert.ok(res.status === 200 || res.status === 503);
  if (res.status === 503) assert.match(await res.text(), /npm run build/);
});
