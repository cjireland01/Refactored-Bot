import { useEffect, useState } from "react";

export default function AltQueue() {
  const [altUsers, setAltUsers] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [expandedBR, setExpandedBR] = useState({});

  // Fetch altqueue data from backend
  useEffect(() => {
    async function fetchAltUsers() {
      try {
        const res = await fetch("/api/status/altqueue");
        const json = await res.json();
        setAltUsers(json.alts || []);
      } catch (err) {
        console.error("Error fetching alt queue:", err);
      }
    }
    fetchAltUsers();
  }, []);

  const toggleUser = (username) => {
    setExpandedUser((prev) => (prev === username ? null : username));
  };

  const toggleBR = (username, br) => {
    setExpandedBR((prev) => ({
      ...prev,
      [username]: prev[username] === br ? null : br,
    }));
  };

  return (
    <div className="w-full bg-gray-800/60 text-white p-6 rounded-2xl shadow-lg min-h-[600px]">
      <h2 className="text-2xl font-semibold mb-4">Alt Queue</h2>

      {altUsers.length === 0 ? (
        <p className="text-gray-400">No alt users found.</p>
      ) : (
        <div className="space-y-4">
          {altUsers.map((user) => (
            <div key={user.username}>
              {/* USER HEADER */}
              <button
                onClick={() => toggleUser(user.username)}
                className="w-full flex justify-between items-center bg-gray-700 hover:bg-gray-600 transition-colors rounded-xl px-4 py-3 font-semibold"
              >
                <span>{user.username || "(Unnamed User)"}</span>
                <span className="text-gray-400">
                  {expandedUser === user.username ? "▲" : "▼"}
                </span>
              </button>

              {/* USER VEHICLES */}
              {expandedUser === user.username && user.vehicles && (
                <div className="pl-6 pt-2 space-y-2">
                  {Object.entries(
                    user.vehicles.reduce((acc, v) => {
                      const br = v.BR || "Unknown";
                      if (!acc[br]) acc[br] = [];
                      acc[br].push(v.Vehicle);
                      return acc;
                    }, {})
                  )
                    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
                    .map(([br, vehicles]) => (
                      <div key={br}>
                        {/* BR HEADER */}
                        <button
                          onClick={() => toggleBR(user.username, br)}
                          className="text-left w-full bg-gray-700/40 hover:bg-gray-600/40 transition-colors rounded-lg px-3 py-2 flex justify-between items-center"
                        >
                          <span className="font-medium">{br}</span>
                          <span className="text-gray-400">
                            {expandedBR[user.username] === br ? "▲" : "▼"}
                          </span>
                        </button>

                        {/* VEHICLES LIST */}
                        {expandedBR[user.username] === br && (
                          <ul className="list-disc list-inside pl-4 text-gray-300 mt-1">
                            {vehicles.map((v, idx) => (
                              <li key={idx}>{v}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
