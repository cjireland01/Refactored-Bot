import "../test-support/tempDb.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedTimeToMs } from "../utils/time.js";

const iso = (ms) => new Date(ms).toISOString();

test("05:00 New York is 10:00 UTC in winter and 09:00 UTC in summer", () => {
  assert.equal(iso(zonedTimeToMs("2026-12-05", "05:00", "America/New_York")), "2026-12-05T10:00:00.000Z");
  assert.equal(iso(zonedTimeToMs("2026-07-04", "05:00", "America/New_York")), "2026-07-04T09:00:00.000Z");
});

test("daylight saving switch days land on the right side", () => {
  // clocks go forward on 2026-03-08 and back on 2026-11-01
  assert.equal(iso(zonedTimeToMs("2026-03-08", "05:00", "America/New_York")), "2026-03-08T09:00:00.000Z");
  assert.equal(iso(zonedTimeToMs("2026-11-01", "05:00", "America/New_York")), "2026-11-01T10:00:00.000Z");
});

test("a fixed-offset zone ignores daylight saving", () => {
  assert.equal(iso(zonedTimeToMs("2026-07-04", "05:00", "Etc/GMT+5")), "2026-07-04T10:00:00.000Z");
  assert.equal(iso(zonedTimeToMs("2026-12-05", "05:00", "Etc/GMT+5")), "2026-12-05T10:00:00.000Z");
});

test("other zones work too", () => {
  assert.equal(iso(zonedTimeToMs("2026-07-04", "12:00", "Europe/London")), "2026-07-04T11:00:00.000Z");
});
