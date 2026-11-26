import React, { useState, useEffect } from "react";
import axios from "axios";

const BRScheduler = () => {
  const [schedule, setSchedule] = useState([]);
  const [newBR, setNewBR] = useState("");
  const [start, setStart] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch schedule from backend
  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/br");
      setSchedule(res.data);
      setError("");
    } catch (err) {
      console.error("[BRScheduler] Fetch error:", err);
      setError("Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // Add or update BR
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newBR || !start) return;

    try {
      await axios.post("/api/br", {
        id: editingId,
        br: parseFloat(newBR),
        start,
      });
      setNewBR("");
      setStart("");
      setEditingId(null);
      fetchSchedule();
    } catch (err) {
      console.error("[BRScheduler] Save error:", err);
      setError("Failed to save entry.");
    }
  };

  // Edit entry
  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setNewBR(entry.br);
    setStart(entry.start);
  };

  // Delete entry
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await axios.delete(`/api/br/${id}`);
      fetchSchedule();
    } catch (err) {
      console.error("[BRScheduler] Delete error:", err);
      setError("Failed to delete entry.");
    }
  };

  return (
    <div className="p-4 bg-gray-800 text-white rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">BR Schedule</h2>

      {error && <div className="text-red-400 mb-2">{error}</div>}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2 mb-4"
      >
        <input
          type="number"
          step="0.3"
          placeholder="BR (e.g. 9.7)"
          value={newBR}
          onChange={(e) => setNewBR(e.target.value)}
          className="p-2 rounded bg-gray-700 flex-1"
          required
        />
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="p-2 rounded bg-gray-700 flex-1"
          required
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
        >
          {editingId ? "Update" : "Add"}
        </button>
      </form>

      {loading ? (
        <div>Loading schedule...</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-700 text-left">
              <th className="p-2">BR</th>
              <th className="p-2">Start Date</th>
              <th className="p-2 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedule.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-2 text-center text-gray-400">
                  No scheduled BRs.
                </td>
              </tr>
            ) : (
              schedule.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-700">
                  <td className="p-2">{entry.br.toFixed(1)}</td>
                  <td className="p-2">
                    {entry.start}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="text-yellow-400 hover:underline mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BRScheduler;
