// components/MetaVehiclesManager.jsx
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api.js";

/**
 * Meta Vehicles Manager
 * - Normalizes server response
 * - Filters by country and category (air/ground/other)
 * - Sorts by BR, name, country, meta
 * - Toggles meta flag via POST
 */

const DEBUG = false;

function normalizeString(str) {
  if (!str) return "";
  return str
    .replace(/\u00A0/g, " ")  // non-breaking space → normal space
    .replace(/\s+/g, " ")     // collapse multiple spaces
    .trim()
    .toLowerCase();
}

function normalizeVehicle(raw) {
  if (!raw) return null;

  const vehicle_name = String(raw.vehicle_name ?? raw.name ?? raw.Vehicle ?? raw.vehicle ?? "").trim();
  let br = raw.br ?? raw.BR ?? raw.battleRating ?? raw.battle_rating ?? null;
  if (br !== null) br = Number(br) || null;

  const country = String(raw.country ?? raw.nation ?? raw.country_name ?? "").trim();
  const move_type = String(raw.move_type ?? raw.unitMoveType ?? raw.unit_move_type ?? raw.unit_class ?? "").trim();

  let is_meta = raw.is_meta ?? raw.meta ?? 0;
  if (typeof is_meta === "boolean") is_meta = is_meta ? 1 : 0;
  if (typeof is_meta === "string") is_meta = is_meta === "true" ? 1 : 0;
  if (typeof is_meta === "number") is_meta = is_meta ? 1 : 0;

  return { vehicle_name, br, country, move_type, is_meta };
}

function groupMoveType(type) {
  if (!type) return "other";
  const t = type.toLowerCase();
  if (t === "air" || t.includes("heli") || t === "helicopter") return "air";
  if (["tank", "heavy_tank", "wheeled_vehicle", "armored"].includes(t) || t.includes("vehicle")) return "ground";
  return "other";
}

export default function MetaVehiclesManager() {
  const [rawVehicles, setRawVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [countryFilter, setCountryFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all"); // all | air | ground | other
  const [sortField, setSortField] = useState("br"); // br | vehicle_name | country | is_meta
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  async function fetchVehicles() {
    setLoading(true);
    try {
      const res = await fetch("/api/meta-vehicles");
      const data = await res.json();
      if (DEBUG) console.debug("raw /api/meta-vehicles:", data);

      const normalized = (Array.isArray(data) ? data : [])
        .map(normalizeVehicle)
        .filter(Boolean);

      setRawVehicles(normalized);
    } catch (err) {
      console.error("Error fetching meta vehicles:", err);
      setRawVehicles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchVehicles(); }, []);

  // derive country list
  const countries = useMemo(() => {
    const arr = Array.from(new Set(
      rawVehicles
        .map(v => normalizeString(v.country).replace(/^country_/, ""))
        .filter(Boolean)
    ));
    arr.sort();
    return ["all", ...arr];
  }, [rawVehicles]);

  // filtered vehicles
  const filtered = useMemo(() => {
    return rawVehicles.filter((v) => {
      const vehicleCountry = normalizeString(v.country).replace(/^country_/, "");
      const countryMatch = countryFilter === "all" || vehicleCountry === countryFilter;
      const categoryMatch = categoryFilter === "all" || groupMoveType(normalizeString(v.move_type)) === categoryFilter;
      return countryMatch && categoryMatch;
    });
  }, [rawVehicles, countryFilter, categoryFilter]);

  // sorted vehicles
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((x, y) => {
      let A = x[sortField];
      let B = y[sortField];

      if (A === undefined || A === null) A = "";
      if (B === undefined || B === null) B = "";

      if (sortField === "br" || sortField === "is_meta") {
        const na = Number(A) || 0;
        const nb = Number(B) || 0;
        if (na < nb) return sortDir === "asc" ? -1 : 1;
        if (na > nb) return sortDir === "asc" ? 1 : -1;
        return 0;
      }

      const sa = String(A).toLowerCase();
      const sb = String(B).toLowerCase();
      if (sa < sb) return sortDir === "asc" ? -1 : 1;
      if (sa > sb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  async function toggleMeta(vehicleName, current) {
    setRawVehicles(prev =>
      prev.map(v => v.vehicle_name === vehicleName ? { ...v, is_meta: current ? 0 : 1 } : v)
    );

    try {
      await apiFetch("/api/meta-vehicles", {
        method: "POST",
        body: JSON.stringify({ vehicle_name: vehicleName, is_meta: current ? 0 : 1 }),
      });
      // Re-read from the server either way, so the page shows what was really saved
      await fetchVehicles();
    } catch (err) {
      console.error("Error toggling meta:", err);
      await fetchVehicles();
    }
  }

  function changeSort(field) {
    if (field === sortField) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDir(field === "br" ? "desc" : "asc");
    }
  }

  return (
    <div className="p-4 bg-gray-800 rounded-md shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Meta Vehicles</h2>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 bg-gray-700 rounded text-sm"
            onClick={() => fetchVehicles()}
          >
            Refresh
          </button>
          <div className="text-sm text-gray-400">{loading ? "loading..." : `${rawVehicles.length} total`}</div>
        </div>
      </div>

      {/* filters */}
      <div className="flex gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">Country:</span>
          {countries.map(c => (
            <button
              key={c}
              onClick={() => setCountryFilter(c)}
              className={`px-2 py-1 rounded text-sm ${countryFilter === c ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-200"}`}
            >
              {c === "all" ? "ALL" : c.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">Category:</span>
          {["all", "air", "ground", "other"].map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2 py-1 rounded text-sm ${categoryFilter === c ? "bg-green-600 text-white" : "bg-gray-600 text-gray-200"}`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* sort */}
      <div className="flex gap-2 items-center mb-3">
        <span className="text-sm text-gray-300">Sort:</span>
        {["vehicle_name","country","br","is_meta"].map(f => (
          <button
            key={f}
            onClick={() => changeSort(f)}
            className={`px-2 py-1 rounded text-sm ${sortField === f ? "bg-yellow-500" : "bg-gray-600"}`}
          >
            {f.replace("_"," ").toUpperCase()} {sortField === f ? (sortDir==="asc"?"↑":"↓") : ""}
          </button>
        ))}
      </div>

      {/* results */}
      <div className="overflow-auto max-h-[50vh]">
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="text-sm text-gray-300 border-b">
              <th className="py-2 px-2 w-1/2">Vehicle</th>
              <th className="py-2 px-2 w-1/6">BR</th>
              <th className="py-2 px-2 w-1/6">Country</th>
              <th className="py-2 px-2 w-1/6">Type</th>
              <th className="py-2 px-2 w-12">Meta</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(v => (
              <tr key={v.vehicle_name} className="text-sm border-b even:bg-gray-700">
                <td className="py-2 px-2 truncate">{v.vehicle_name}</td>
                <td className="py-2 px-2">{v.br ?? "-"}</td>
                <td className="py-2 px-2">{v.country ?? "-"}</td>
                <td className="py-2 px-2">{groupMoveType(v.move_type)}</td>
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={v.is_meta === 1}
                    onChange={() => toggleMeta(v.vehicle_name, v.is_meta===1)}
                  />
                </td>
              </tr>
            ))}
            {sorted.length===0 && (
              <tr>
                <td colSpan={5} className="p-4 text-sm text-gray-400">No vehicles match filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
