import { useState } from "react";

export default function BRScheduler() {
  const [newBR, setNewBR] = useState("");
  const [message, setMessage] = useState("");

  const handleUpdate = async () => {
    try {
      const res = await fetch("/api/br-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newBR }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ BR updated to ${data.newBR}`);
      } else {
        setMessage(`❌ Error: ${data.error || "Failed to update"}`);
      }
    } catch (err) {
      setMessage(`❌ Network error`);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md mb-4">
      <h2 className="text-xl font-semibold mb-2">Adjust BR Schedule</h2>
      <div className="flex space-x-2">
        <input
          type="number"
          step="0.3"
          min="1.0"
          max="14.0"
          value={newBR}
          onChange={(e) => setNewBR(e.target.value)}
          placeholder="Enter BR (e.g. 11.3)"
          className="flex-1 p-2 rounded bg-gray-700 text-white"
        />
        <button
          onClick={handleUpdate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
        >
          Update
        </button>
      </div>
      {message && <p className="text-sm text-gray-300 mt-2">{message}</p>}
    </div>
  );
}
