import { useEffect, useRef, useState } from "react";

/**
 * A small line chart drawn with plain SVG (no chart library).
 *
 *   points   [{ t: time in ms, v: number }]  oldest first
 *   invert   true when a LOWER number is better (like leaderboard position),
 *            so the line goes up when the squadron climbs
 *   format   how to show a value, e.g. (v) => `#${v}`
 *   minSpan  the smallest range the vertical axis may zoom in to, so tiny
 *            changes (like win rate moving 0.05%) don't look dramatic
 *   floor    the lowest value the axis may show (e.g. 1 for position)
 */
const H = 170;
const PAD = { left: 52, right: 14, top: 14, bottom: 26 };

const shortTime = (t) =>
  new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function LineChart({ title, points, invert = false, format = String, color = "#60a5fa", minSpan = 0, floor }) {
  const [hover, setHover] = useState(null);

  // Draw at the real width of the card, so text stays a readable size on a phone
  const box = useRef(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) setW(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const header = <h3 className="text-sm font-semibold text-gray-300">{title}</h3>;

  if (!points || points.length < 2) {
    return (
      <div ref={box} className="bg-gray-900/50 rounded-lg p-3">
        {header}
        <p className="text-sm text-gray-500 py-8 text-center">
          {points?.length === 1
            ? "One data point so far - the line appears once there are two."
            : "No data in this range yet."}
        </p>
      </div>
    );
  }

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const values = points.map((p) => p.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < minSpan) {
    const mid = (min + max) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
    if (floor !== undefined && min < floor) {
      max += floor - min;
      min = floor;
    }
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const innerW = W - 24 - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t) => PAD.left + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * innerW);
  const y = (v) => {
    const f = (v - min) / (max - min);
    return PAD.top + (invert ? f : 1 - f) * innerH;
  };

  const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const shown = hover ?? points[points.length - 1];

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * (W - 24);
    let best = points[0];
    for (const p of points) if (Math.abs(x(p.t) - px) < Math.abs(x(best.t) - px)) best = p;
    setHover(best);
  }

  return (
    <div ref={box} className="bg-gray-900/50 rounded-lg p-3">
      <div className="flex items-baseline justify-between gap-2">
        {header}
        <span className="text-xs text-gray-400">
          <span className="font-semibold text-gray-100">{format(shown.v)}</span> · {shortTime(shown.t)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W - 24} ${H}`}
        className="w-full h-auto mt-1"
        role="img"
        aria-label={`${title} over time`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* horizontal guides with the top and bottom values */}
        {[0, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD.left}
              x2={W - 24 - PAD.right}
              y1={PAD.top + f * innerH}
              y2={PAD.top + f * innerH}
              stroke="#374151"
              strokeDasharray="3 4"
            />
            <text x={PAD.left - 6} y={PAD.top + f * innerH + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
              {format(invert ? (f === 0 ? min : max) : f === 0 ? max : min)}
            </text>
          </g>
        ))}

        {/* time labels */}
        <text x={PAD.left} y={H - 6} fontSize="11" fill="#9ca3af">
          {shortTime(t0)}
        </text>
        <text x={W - 24 - PAD.right} y={H - 6} fontSize="11" fill="#9ca3af" textAnchor="end">
          {shortTime(t1)}
        </text>

        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {hover && (
          <line x1={x(hover.t)} x2={x(hover.t)} y1={PAD.top} y2={PAD.top + innerH} stroke="#6b7280" />
        )}
        <circle cx={x(shown.t)} cy={y(shown.v)} r="4" fill={color} />
      </svg>
    </div>
  );
}
