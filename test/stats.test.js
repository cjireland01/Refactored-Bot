import "../test-support/tempDb.js";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import db from "../utils/db.js";
import { toSnapshot, recordStats, getStatsOverview, MIN_GAP_MS } from "../utils/stats.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);

// a leaderboard entry shaped like the War Thunder API's
const squad = (over = {}) => ({
  members_cnt: 80,
  astat: { dr_era5_hist: 150000, wins_hist: 600, battles_hist: 1000, activity: 4200, ...over },
});

beforeEach(() => db.prepare("DELETE FROM stats_history").run());

test("a leaderboard entry becomes a snapshot", () => {
  assert.deepEqual(toSnapshot(squad(), 7, NOW), {
    taken_at: NOW,
    position: 7,
    score: 150000,
    wins: 600,
    battles: 1000,
    members: 80,
    activity: 4200,
  });
});

test("missing or non-numeric values become null, not NaN", () => {
  const snap = toSnapshot({ astat: { dr_era5_hist: "n/a" } }, null, NOW);
  assert.equal(snap.position, null);
  assert.equal(snap.score, null);
  assert.equal(snap.members, null);
});

test("snapshots closer together than the minimum gap are skipped", () => {
  assert.equal(recordStats(squad(), 7, { now: NOW }), true);
  assert.equal(recordStats(squad(), 7, { now: NOW + MIN_GAP_MS - 1 }), false);
  assert.equal(recordStats(squad(), 7, { now: NOW + MIN_GAP_MS }), true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM stats_history").get().n, 2);
});

test("force always records (used for the twice-daily report)", () => {
  recordStats(squad(), 7, { now: NOW });
  assert.equal(recordStats(squad(), 7, { now: NOW + 1000, force: true }), true);
});

test("a snapshot with no position and no score is not worth saving", () => {
  assert.equal(recordStats({}, null, { now: NOW }), false);
});

test("an empty history gives no current stats", () => {
  const o = getStatsOverview("7d", NOW);
  assert.equal(o.current, null);
  assert.equal(o.baseline, null);
  assert.deepEqual(o.history, []);
});

test("current is the newest snapshot and baseline is about a day older", () => {
  recordStats(squad({ dr_era5_hist: 100 }), 9, { now: NOW - 2 * DAY, force: true });
  recordStats(squad({ dr_era5_hist: 120 }), 8, { now: NOW - DAY - HOUR, force: true });
  recordStats(squad({ dr_era5_hist: 130 }), 8, { now: NOW - 10 * HOUR, force: true });
  recordStats(squad({ dr_era5_hist: 150 }), 6, { now: NOW, force: true });

  const o = getStatsOverview("7d", NOW);
  assert.equal(o.current.score, 150);
  assert.equal(o.current.position, 6);
  // the newest row at least 24h before "current"
  assert.equal(o.baseline.score, 120);
});

test("with under a day of history the baseline is the oldest snapshot", () => {
  recordStats(squad({ dr_era5_hist: 100 }), 9, { now: NOW - 3 * HOUR, force: true });
  recordStats(squad({ dr_era5_hist: 110 }), 8, { now: NOW, force: true });
  assert.equal(getStatsOverview("7d", NOW).baseline.score, 100);
});

test("a single snapshot has nothing to compare with", () => {
  recordStats(squad(), 7, { now: NOW, force: true });
  const o = getStatsOverview("7d", NOW);
  assert.ok(o.current);
  assert.equal(o.baseline, null);
});

test("ranges only include their window", () => {
  recordStats(squad({ dr_era5_hist: 1 }), 9, { now: NOW - 40 * DAY, force: true });
  recordStats(squad({ dr_era5_hist: 2 }), 9, { now: NOW - 10 * DAY, force: true });
  recordStats(squad({ dr_era5_hist: 3 }), 9, { now: NOW - 2 * DAY, force: true });
  recordStats(squad({ dr_era5_hist: 4 }), 9, { now: NOW - HOUR, force: true });

  const scores = (range) => getStatsOverview(range, NOW).history.map((r) => r.score);
  assert.deepEqual(scores("24h"), [4]);
  assert.deepEqual(scores("7d"), [3, 4]);
  assert.deepEqual(scores("30d"), [2, 3, 4]);
  assert.deepEqual(scores("all"), [1, 2, 3, 4]);
});

test("long ranges are thinned to one point per bucket (the latest in it)", () => {
  // three snapshots inside the same hour, one in the next
  const hourStart = Math.floor((NOW - 3 * HOUR) / HOUR) * HOUR;
  recordStats(squad({ dr_era5_hist: 1 }), 9, { now: hourStart + 1 * 60000, force: true });
  recordStats(squad({ dr_era5_hist: 2 }), 9, { now: hourStart + 20 * 60000, force: true });
  recordStats(squad({ dr_era5_hist: 3 }), 9, { now: hourStart + 40 * 60000, force: true });
  recordStats(squad({ dr_era5_hist: 4 }), 9, { now: hourStart + HOUR + 5 * 60000, force: true });

  assert.deepEqual(getStatsOverview("7d", NOW).history.map((r) => r.score), [3, 4]);
});

test("an unknown range falls back to 7 days", () => {
  assert.equal(getStatsOverview("bogus", NOW).range, "7d");
});
