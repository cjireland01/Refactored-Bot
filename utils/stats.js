import db from "./db.js";

// Squadron stats over time. A snapshot is saved as the bot fetches the
// leaderboard (at most one every few minutes, plus the twice-daily reports),
// and the dashboard's stats page reads them back.

export const MIN_GAP_MS = 5 * 60 * 1000;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// How far back each range reaches, and how coarse its points are
export const RANGES = {
  "24h": { windowMs: DAY, bucketMs: MIN_GAP_MS },
  "7d": { windowMs: 7 * DAY, bucketMs: HOUR },
  "30d": { windowMs: 30 * DAY, bucketMs: 6 * HOUR },
  all: { windowMs: null, bucketMs: DAY },
};

const COLUMNS = "taken_at, position, score, wins, battles, members, activity";

const stmts = {
  insert: db.prepare(
    `INSERT INTO stats_history (${COLUMNS}) VALUES (@taken_at, @position, @score, @wins, @battles, @members, @activity)`
  ),
  lastTime: db.prepare("SELECT taken_at FROM stats_history ORDER BY taken_at DESC LIMIT 1"),
  latest: db.prepare(`SELECT ${COLUMNS} FROM stats_history ORDER BY taken_at DESC LIMIT 1`),
  atOrBefore: db.prepare(
    `SELECT ${COLUMNS} FROM stats_history WHERE taken_at <= ? ORDER BY taken_at DESC LIMIT 1`
  ),
  earliest: db.prepare(`SELECT ${COLUMNS} FROM stats_history ORDER BY taken_at ASC LIMIT 1`),
  // The last snapshot in each time bucket
  history: db.prepare(`
    SELECT ${COLUMNS} FROM stats_history
    WHERE id IN (
      SELECT MAX(id) FROM stats_history
      WHERE taken_at >= ?
      GROUP BY CAST(taken_at / ? AS INTEGER)
    )
    ORDER BY taken_at
  `),
};

// A real number, or null for anything missing / not numeric
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Turn a leaderboard entry for the squadron into one snapshot row */
export function toSnapshot(squad, position, now = Date.now()) {
  const astat = squad?.astat ?? {};
  return {
    taken_at: now,
    position: num(position),
    score: num(astat.dr_era5_hist),
    wins: num(astat.wins_hist),
    battles: num(astat.battles_hist),
    members: num(squad?.members_cnt),
    activity: num(astat.activity),
  };
}

/**
 * Save a snapshot. Skipped when the last one is less than MIN_GAP_MS old,
 * unless force is set. Returns true if a row was written.
 */
export function recordStats(squad, position, { force = false, now = Date.now() } = {}) {
  const snap = toSnapshot(squad, position, now);
  if (snap.position === null && snap.score === null) return false; // nothing useful

  if (!force) {
    const last = stmts.lastTime.get();
    if (last && now - last.taken_at < MIN_GAP_MS) return false;
  }
  stmts.insert.run(snap);
  return true;
}

/**
 * Everything the stats page needs:
 *   current  - the newest snapshot (null until the first one is recorded)
 *   baseline - what to compare against: the snapshot from ~24h before `current`,
 *              or the oldest one if there is less than a day of history
 *   history  - points for the charts, thinned out to suit the range
 */
export function getStatsOverview(range = "7d", now = Date.now()) {
  const key = RANGES[range] ? range : "7d";
  const { windowMs, bucketMs } = RANGES[key];

  const current = stmts.latest.get() ?? null;

  let baseline = null;
  if (current) {
    baseline = stmts.atOrBefore.get(current.taken_at - DAY) ?? stmts.earliest.get() ?? null;
    if (baseline && baseline.taken_at === current.taken_at) baseline = null;
  }

  const since = windowMs ? now - windowMs : 0;
  const history = stmts.history.all(since, bucketMs);

  return { range: key, current, baseline, history };
}
