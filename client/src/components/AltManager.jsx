import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api.js";

/**
 * Alt Manager: search the squad's members and mark / unmark alt accounts.
 * Changes also refresh the alt tracker embed in Discord.
 */
export default function AltManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | alts | others
  const [saving, setSaving] = useState(() => new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/alts");
      if (res.status === 401) {
        setError("The admin token is needed to view members.");
        setUsers([]);
      } else if (!res.ok) {
        throw new Error(`status ${res.status}`);
      } else {
        const json = await res.json();
        setUsers(Array.isArray(json.users) ? json.users : []);
        setError("");
      }
    } catch (e) {
      console.error("[AltManager] load failed", e);
      setError("Could not load members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const altCount = users.filter((u) => u.is_alt).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "alts" && !u.is_alt) return false;
      if (filter === "others" && u.is_alt) return false;
      return !q || u.username.toLowerCase().includes(q);
    });
  }, [users, query, filter]);

  async function toggle(user) {
    const next = user.is_alt ? 0 : 1;
    setNotice("");
    setSaving((s) => new Set(s).add(user.id));
    // show the change straight away, undo it if saving fails
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, is_alt: next } : u)));

    try {
      const res = await apiFetch("/api/alts", {
        method: "POST",
        body: JSON.stringify({ id: user.id, is_alt: next }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setError("");
      setNotice(
        `${user.username} ${next ? "is now marked as an alt" : "is no longer an alt"}. The Discord alt tracker is refreshing.`
      );
    } catch (e) {
      console.error("[AltManager] save failed", e);
      setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, is_alt: user.is_alt } : u)));
      setError(`Could not save the change for ${user.username}.`);
    } finally {
      setSaving((s) => {
        const copy = new Set(s);
        copy.delete(user.id);
        return copy;
      });
    }
  }

  const filterButton = (key, label) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={`px-3 py-1 rounded text-sm ${
        filter === key ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 bg-gray-800 rounded-xl shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-xl font-semibold">Alt Accounts</h2>
        <div className="text-sm text-gray-400">
          {loading ? "loading..." : `${altCount} alt${altCount === 1 ? "" : "s"} of ${users.length} members`}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members..."
          aria-label="Search members"
          className="p-2 rounded bg-gray-700 flex-1 min-w-[12rem]"
        />
        <div className="flex gap-1">
          {filterButton("all", "All")}
          {filterButton("alts", "Alts")}
          {filterButton("others", "Not alts")}
        </div>
        <button onClick={load} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm mb-2">
          {error}{" "}
          <button onClick={load} className="underline">
            Try again
          </button>
        </div>
      )}
      {notice && <div className="text-green-400 text-sm mb-2">{notice}</div>}

      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-left">
          <thead>
            <tr className="text-sm text-gray-300 border-b border-gray-700">
              <th className="py-2 px-2">Member</th>
              <th className="py-2 px-2 w-28">Vehicles</th>
              <th className="py-2 px-2 w-36 text-right">Alt account</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="text-sm border-b border-gray-700 even:bg-gray-700/40">
                <td className="py-2 px-2 truncate">{u.username}</td>
                <td className="py-2 px-2 text-gray-400">{u.vehicle_count}</td>
                <td className="py-2 px-2 text-right">
                  <button
                    onClick={() => toggle(u)}
                    disabled={saving.has(u.id)}
                    aria-pressed={!!u.is_alt}
                    className={`px-3 py-1 rounded text-xs font-semibold disabled:opacity-50 ${
                      u.is_alt ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 hover:bg-gray-500"
                    }`}
                  >
                    {u.is_alt ? "Alt ✓" : "Mark as alt"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-sm text-gray-400">
                  {users.length === 0 ? "No members found." : "No members match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
