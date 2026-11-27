import "../test-support/tempDb.js";
import { test, after } from "node:test";
import assert from "node:assert/strict";

const { createApp } = await import("../server/app.js");

const servers = [];
async function start(limits) {
  const server = createApp({ limits }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
after(() => servers.forEach((s) => s.close()));

const codes = async (base, path, n, options) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push((await fetch(base + path, options)).status);
  return out;
};

test("the API stops answering after too many requests, then says why", async () => {
  const base = await start({ api: { limit: 3 } });
  assert.deepEqual(await codes(base, "/api/br", 4), [200, 200, 200, 429]);
  const res = await fetch(base + "/api/br");
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /slow down/i);
  assert.ok(res.headers.get("ratelimit") || res.headers.get("ratelimit-policy"));
});

test("guessing the admin token is limited too (the limit comes before the check)", async () => {
  process.env.ADMIN_TOKEN = "s3cret";
  try {
    const base = await start({ api: { limit: 3 } });
    const post = { method: "POST", headers: { "x-admin-token": "wrong", "Content-Type": "application/json" }, body: "{}" };
    assert.deepEqual(await codes(base, "/api/br", 5, post), [401, 401, 401, 429, 429]);
  } finally {
    delete process.env.ADMIN_TOKEN;
  }
});

test("the login pages have their own, stricter limit", async () => {
  const base = await start({ auth: { limit: 2 } });
  const status = async () => (await fetch(base + "/auth/login", { redirect: "manual" })).status;
  assert.equal(await status(), 404); // login isn't set up here, but it still counts
  assert.equal(await status(), 404);
  assert.equal(await status(), 429);
  // the dashboard's data is unaffected
  assert.equal((await fetch(base + "/api/br")).status, 200);
});

test("the web page itself is limited", async () => {
  const base = await start({ pages: { limit: 2 } });
  const got = await codes(base, "/", 3);
  assert.equal(got[2], 429);
});

test("one visitor hitting the limit doesn't affect an ordinary page load", async () => {
  const base = await start();
  assert.deepEqual(await codes(base, "/api/br", 5), [200, 200, 200, 200, 200]);
});
