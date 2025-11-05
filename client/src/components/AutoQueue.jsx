import { useEffect, useState } from "react";

export default function AutoQueue() {
  const [data, setData] = useState({ currentBR: "", brEndsIn: "", voiceUsers: [] });

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/status");
      const json = await res.json();
      setData(json);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold mb-2">Auto Queue</h2>
      <p className="text-sm text-gray-400 mb-2">
        Current BR: <span className="font-bold">{data.currentBR || "..."}</span>  
        &nbsp;| Ends in: {data.brEndsIn || "..."}
      </p>
      <ul className="space-y-1">
        {data.voiceUsers.length > 0 ? (
          data.voiceUsers.map((u, i) => (
            <li key={i} className="text-sm text-gray-300">
              {u.username}: {u.vehicles?.join(", ") || "No vehicles"}
            </li>
          ))
        ) : (
          <li className="text-gray-500 text-sm">No voice users online</li>
        )}
      </ul>
    </div>
  );
}
