import { createContext, useContext, useEffect, useState } from "react";

// Who is using the dashboard, and what they may do. Loaded from /api/me, and
// re-checked every 30 seconds and whenever the tab is looked at again, so a
// role change in Discord shows up without reloading the page.
//   authEnabled  Discord login is on
//   user         { name, avatar, id } or null
//   canEdit      true for editors (and for everyone when login is off)
const START = { loading: true, authEnabled: false, user: null, level: "none", canEdit: false };
const MeContext = createContext(START);

export function MeProvider({ children }) {
  const [me, setMe] = useState(START);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setMe({ loading: false, ...json });
      } catch {
        // If the bot can't be reached, keep what we had; on first load fall back to the old behaviour
        if (!cancelled) {
          setMe((prev) =>
            prev.loading ? { loading: false, authEnabled: false, user: null, level: "editor", canEdit: true } : prev
          );
        }
      }
    }

    load();
    const timer = setInterval(load, 30 * 1000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, []);

  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
