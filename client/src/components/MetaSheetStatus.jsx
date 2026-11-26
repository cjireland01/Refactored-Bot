import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";

const countryName = (c) => String(c ?? "").replace(/^country_/, "");

/**
 * Shows whether the queues are filtered by the Google meta sheet, when it was
 * last read, and which sheet entries matched no vehicle (usually typos).
 */
export default function MetaSheetStatus() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/meta-sheet");
      if (res.ok) setInfo(await res.json());
    } catch {
      // leave the panel hidden
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setBusy(true);
    setNote("");
    try {
      const res = await apiFetch("/api/meta-sheet/refresh", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json.status) setInfo(json.status);
      if (res.status === 401) setNote("The admin token is needed.");
      else if (!res.ok) setNote(json.error || "Could not read the sheet.");
      else setNote(json.changed ? "Updated - the Discord embeds were refreshed." : "Already up to date.");
    } catch {
      setNote("Could not reach the bot.");
    } finally {
      setBusy(false);
    }
  }

  if (!info) return null;
  if (!info.enabled) {
    return (
      <div className="mb-4 p-3 rounded bg-gray-900/50 text-sm text-gray-400">
        Meta sheet is off - the queues show every vehicle. Set <code>META_SHEET_URL</code> in the bot's .env to filter by a Google Sheet.
      </div>
    );
  }

  const shown = showAll ? info.unmatched : info.unmatched.slice(0, 8);
  return (
    <div className="mb-4 p-3 rounded bg-gray-900/50 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-gray-100">Queues use the Google meta sheet</span>
          <span className="text-gray-400">
            {" "}
            · {info.entries} entries
            {info.lastFetched ? ` · read ${new Date(info.lastFetched).toLocaleTimeString()}` : " · not read yet since the bot started"}
          </span>
        </div>
        <button className="px-3 py-1 bg-gray-700 rounded text-sm disabled:opacity-50" onClick={refresh} disabled={busy}>
          {busy ? "Reading..." : "Read sheet now"}
        </button>
      </div>

      {info.error && <p className="mt-2 text-red-400">Last read failed: {info.error} (using the last good copy)</p>}
      {note && <p className="mt-2 text-gray-300">{note}</p>}
      <p className="mt-2 text-gray-400">
        The Meta column below shows what is on the sheet. To change it, edit the sheet.
      </p>

      {info.unmatched.length > 0 && (
        <div className="mt-2">
          <p className="text-yellow-300">
            {info.unmatched.length} sheet {info.unmatched.length === 1 ? "entry matches" : "entries match"} no vehicle in the database
            (typo, different spelling, or nobody has scraped it):
          </p>
          <ul className="mt-1 text-gray-300 columns-1 sm:columns-2">
            {shown.map((u) => (
              <li key={`${u.country}|${u.cell}`}>
                <span className="text-gray-500">{countryName(u.country)}:</span> {u.cell}
              </li>
            ))}
          </ul>
          {info.unmatched.length > 8 && (
            <button className="mt-1 text-blue-300 underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${info.unmatched.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
