import { useEffect, useState } from "react";
import { apiJson } from "../api.js";
import LineChart from "./LineChart.jsx";

const RANGES = [
  ["24h", "24 hours"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["all", "All time"],
];

const nf = new Intl.NumberFormat("en-US");
const winRate = (row) => (row?.wins != null && row?.battles ? (row.wins / row.battles) * 100 : null);

function timeAgo(ms) {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// "▲ 3" (green = better) / "▼ 12" (red = worse) next to a number.
// For leaderboard position a LOWER number is better, so pass lowerIsBetter.
function Delta({ value, lowerIsBetter = false, digits = 0 }) {
  if (value == null || Math.abs(value) < Math.pow(10, -digits) / 2) return null;
  const good = lowerIsBetter ? value < 0 : value > 0;
  return (
    <span className={`ml-2 text-xs font-medium whitespace-nowrap ${good ? "text-green-400" : "text-red-400"}`}>
      {good ? "▲" : "▼"} {nf.format(Math.abs(Number(value.toFixed(digits))))}
    </span>
  );
}

function Stat({ label, value, delta }) {
  return (
    <div className="bg-gray-900/50 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
        {delta}
      </div>
    </div>
  );
}

export default function VcomStats() {
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const json = await apiJson(`/api/stats?range=${range}`);
        if (alive) {
          setData(json);
          setError("");
        }
      } catch (e) {
        if (alive) setError("Could not load squadron stats.");
        console.error("[VcomStats]", e);
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [range]);

  const cur = data?.current;
  const base = data?.baseline;
  const diff = (key) => (cur && base && cur[key] != null && base[key] != null ? cur[key] - base[key] : null);
  const rateNow = winRate(cur);
  const rateDiff = rateNow != null && winRate(base) != null ? rateNow - winRate(base) : null;

  const series = (pick) =>
    (data?.history ?? []).map((r) => ({ t: r.taken_at, v: pick(r) })).filter((p) => p.v != null);

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-2xl font-semibold">VCoM Stats</h2>
        <div className="flex gap-1">
          {RANGES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`px-3 py-1 rounded text-sm ${
                range === key ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

      {!data && !error && <p className="text-gray-400 text-sm">Loading...</p>}

      {data && !cur && (
        <p className="text-gray-400 text-sm">
          No stats recorded yet. The bot saves a snapshot from the leaderboard every few minutes, so
          they will start appearing shortly after it is running.
        </p>
      )}

      {cur && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="Position"
              value={cur.position != null ? `#${cur.position}` : "-"}
              delta={<Delta value={diff("position")} lowerIsBetter />}
            />
            <Stat
              label="Score (Era 5)"
              value={cur.score != null ? nf.format(cur.score) : "-"}
              delta={<Delta value={diff("score")} />}
            />
            <Stat
              label="Win rate"
              value={rateNow != null ? `${rateNow.toFixed(2)}%` : "-"}
              delta={<Delta value={rateDiff} digits={2} />}
            />
            <Stat
              label="Members"
              value={cur.members != null ? cur.members : "-"}
              delta={<Delta value={diff("members")} />}
            />
            <Stat
              label="Wins"
              value={cur.wins != null ? nf.format(cur.wins) : "-"}
              delta={<Delta value={diff("wins")} />}
            />
            <Stat
              label="Battles"
              value={cur.battles != null ? nf.format(cur.battles) : "-"}
              delta={<Delta value={diff("battles")} />}
            />
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Updated {timeAgo(cur.taken_at)}
            {base ? ` · changes compared with ${timeAgo(base.taken_at)}` : " · no earlier data to compare with yet"}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
            <LineChart
              title="Leaderboard position"
              points={series((r) => r.position)}
              invert
              minSpan={4}
              floor={1}
              format={(v) => `#${Math.round(v)}`}
              color="#60a5fa"
            />
            <LineChart
              title="Score (Era 5)"
              points={series((r) => r.score)}
              minSpan={500}
              floor={0}
              format={(v) => nf.format(Math.round(v))}
              color="#34d399"
            />
            <LineChart
              title="Win rate"
              points={series((r) => winRate(r))}
              minSpan={1}
              floor={0}
              format={(v) => `${v.toFixed(2)}%`}
              color="#fbbf24"
            />
            <LineChart
              title="Members"
              points={series((r) => r.members)}
              minSpan={4}
              floor={0}
              format={(v) => String(Math.round(v))}
              color="#f472b6"
            />
          </div>
        </>
      )}
    </div>
  );
}
