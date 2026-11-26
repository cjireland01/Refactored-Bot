import "../test-support/tempDb.js";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import db from "../utils/db.js";
import { getCurrentBR, getRemainingTime } from "../utils/br.js";
import { zonedTimeToMs } from "../utils/time.js";

const at = (date, time) => zonedTimeToMs(date, time, "America/New_York");
const add = db.prepare("INSERT INTO br_schedule (br, start) VALUES (?, ?)");

beforeEach(() => {
  db.prepare("DELETE FROM br_schedule").run();
});

test("with no schedule the BR defaults to 14.0 and the countdown is unknown", () => {
  assert.equal(getCurrentBR(), "14.0");
  assert.equal(getRemainingTime(undefined, Date.now()), "Unknown");
});

test("the BR switches at 05:00 on the start date, not before", () => {
  add.run(12.0, "2026-11-01");
  add.run(10.7, "2026-11-14");
  assert.equal(getCurrentBR(at("2026-11-14", "04:59")), "12.0");
  assert.equal(getCurrentBR(at("2026-11-14", "05:00")), "10.7");
});

test("before the first entry starts, it falls back to 14.0", () => {
  add.run(12.0, "2026-11-01");
  assert.equal(getCurrentBR(at("2026-10-31", "12:00")), "14.0");
});

test("the countdown counts to the next entry", () => {
  add.run(10.7, "2026-11-14");
  add.run(9.7, "2026-11-21");
  assert.equal(getRemainingTime("10.7", at("2026-11-20", "05:00")), "1d 0h");
  assert.equal(getRemainingTime("10.7", at("2026-11-17", "14:30")), "3d 14h");
});

test("no countdown after the last scheduled BR", () => {
  add.run(10.7, "2026-11-14");
  assert.equal(getRemainingTime("10.7", at("2026-11-15", "05:00")), "Unknown");
});

test("a BR that repeats later in the schedule is matched by the one that has started", () => {
  add.run(14.0, "2026-11-01");
  add.run(12.0, "2026-11-08");
  add.run(14.0, "2026-11-15");
  add.run(12.0, "2026-11-22");
  // between the two 14.0 entries the current BR is 12.0 and the next change is 5 days away
  assert.equal(getCurrentBR(at("2026-11-10", "12:00")), "12.0");
  assert.equal(getRemainingTime("12.0", at("2026-11-10", "12:00")), "4d 17h");
});

test("the countdown follows daylight saving", () => {
  // 05:00 on Mar 9 is 09:00 UTC (summer time); from Mar 7 05:00 EST (10:00 UTC) that is 47h away
  add.run(10.7, "2026-03-01");
  add.run(9.7, "2026-03-09");
  assert.equal(getRemainingTime("10.7", at("2026-03-07", "05:00")), "1d 23h");
});
