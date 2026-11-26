import { useEffect, useState } from "react";

/**
 * Robust AutoQueue UI
 * - Accepts vehicles as strings ("Name (11.3)" or "Name — 11.3") OR objects { Vehicle, BR }
 * - Sanitizes names
 * - Groups by BR descending
 * - Nested dropdowns: user -> BR -> vehicles
 */

export default function AutoQueue() {
  const [data, setData] = useState({ currentBR: "", brEndsIn: "", voiceUsers: [] });
  const [expandedUsers, setExpandedUsers] = useState({});
  const [expandedBRs, setExpandedBRs] = useState({});

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/status");
        const json = await res.json();
        if (mounted) setData(json || { currentBR: "", brEndsIn: "", voiceUsers: [] });
      } catch (e) {
        console.error("Failed to fetch /api/status", e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Toggle user open/closed
  const toggleUser = (username) => {
    setExpandedUsers(prev => ({ ...prev, [username]: !prev[username] }));
  };

  // Toggle BR open/closed for a given user
  const toggleBR = (username, br) => {
    const key = `${username}::${br}`;
    setExpandedBRs(prev => ({ ...prev, [key]: !prev[key] }));
  };

// sanitize vehicle name: remove diacritics, control chars, weird glyphs, then collapse whitespace
const sanitizeName = (s) => {
  if (!s) return "";
  // normalize and remove combining diacritical marks
  let out = String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  // remove control / invisible Unicode chars (category C)
  out = out.replace(/\p{C}/gu, "");
  // allow letters/numbers/space and these punctuation: , . - ' ( ) / : + &
  // everything else removed (including block/box glyphs)
  out = out.replace(/[^\p{L}\p{N}\s,\.\-'\(\)\/:\+&]/gu, "");
  // collapse whitespace
  out = out.replace(/\s+/g, " ").trim();
  return out;
};

// helper parse: handles object {Vehicle, BR} or strings "Name (11.3)" or "Name — 11.3" or "Name - 11.3"
const parseVehicleItem = (item) => {
  if (!item) return null;
  if (typeof item === "object") {
    // object may have Vehicle/vehicle_name, BR/br
    const nameRaw = item.Vehicle ?? item.vehicle_name ?? item.name ?? "";
    const brRaw = item.BR ?? item.br ?? item.battleRating ?? "";
    const name = sanitizeName(nameRaw);
    const br = brRaw ? Number(brRaw).toFixed ? Number(brRaw).toFixed(1) : String(brRaw) : "Unknown";
    return { name, br };
  }
  if (typeof item === "string") {
    const normalized = item.replace(/\u2014|\u2013|\u2012/g, "-");
    let m = normalized.match(/^(.*)\(\s*(\d+(?:\.\d)?)\s*\)\s*$/);
    if (m) return { name: sanitizeName(m[1]), br: Number(m[2]).toFixed(1) };
    m = normalized.match(/^(.*?)[\-\u2014\u2013]\s*(\d+(?:\.\d)?)\s*$/);
    if (m) return { name: sanitizeName(m[1]), br: Number(m[2]).toFixed(1) };
    m = normalized.match(/^(.*?)[\s—-]+\s*(\d+(?:\.\d)?)\s*$/);
    if (m) return { name: sanitizeName(m[1]), br: Number(m[2]).toFixed(1) };
    // fallback: no br found
    return { name: sanitizeName(normalized), br: "Unknown" };
  }
  return null;
};


  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold mb-2">Auto Queue</h2>
      <p className="text-sm text-gray-400 mb-3">
        Current BR: <span className="font-bold">{data.currentBR || "..."}</span>
        &nbsp;| Ends in: <span className="font-medium">{data.brEndsIn || "..."}</span>
      </p>

      <div className="space-y-3">
        {Array.isArray(data.voiceUsers) && data.voiceUsers.length > 0 ? (
          data.voiceUsers.map((u, idx) => {
            // ensure we have username + vehicles
            const username = u.username ?? u.name ?? `user-${idx}`;
            const rawVehicles = Array.isArray(u.vehicles) ? u.vehicles : [];

            // parse and group vehicles by BR
            const grouped = {};
            rawVehicles.forEach((rv) => {
              const parsed = parseVehicleItem(rv);
              if (!parsed) return;
              const brKey = parsed.br ?? "Unknown";
              if (!grouped[brKey]) grouped[brKey] = [];
              grouped[brKey].push(parsed.name);
            });

            // Sort BR keys descending (treat "Unknown" as last)
            const brKeys = Object.keys(grouped)
              .sort((a, b) => {
                if (a === "Unknown") return 1;
                if (b === "Unknown") return -1;
                return parseFloat(b) - parseFloat(a);
              });

            return (
              <div key={username + idx} className="border border-gray-700 rounded-lg p-3">
                <button
                  onClick={() => toggleUser(username)}
                  className="w-full text-left font-medium hover:text-white flex justify-between items-center"
                  aria-expanded={!!expandedUsers[username]}
                >
                  <span className="truncate">{username}</span>
                  <span className="ml-2 text-sm text-gray-300">{expandedUsers[username] ? "▲" : "▼"}</span>
                </button>

                {expandedUsers[username] && (
                  <div className="mt-2 ml-3 space-y-2">
                    {brKeys.length === 0 && (
                      <div className="text-sm text-gray-400">No tracked vehicles</div>
                    )}

                    {brKeys.map((br) => {
                      const key = `${username}::${br}`;
                      const vehicles = grouped[br] || [];
                      return (
                        <div key={key} className="rounded-sm">
                          <button
                            onClick={() => toggleBR(username, br)}
                            className="w-full text-left text-sm font-semibold text-blue-300 flex justify-between items-center"
                            aria-expanded={!!expandedBRs[key]}
                          >
                            <span>BR {br} — {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""}</span>
                            <span className="ml-2 text-gray-300">{expandedBRs[key] ? "▲" : "▼"}</span>
                          </button>

                          {expandedBRs[key] && (
                            <ul className="list-disc list-inside text-sm text-gray-200 mt-1 ml-4">
                              {vehicles.map((v, vi) => <li key={vi}>{v}</li>)}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-gray-500 text-sm">No voice users online</div>
        )}
      </div>
    </div>
  );
}
