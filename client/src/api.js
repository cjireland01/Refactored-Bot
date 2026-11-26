// Small wrapper around fetch for talking to the bot's web server.
//
// If the server has ADMIN_TOKEN set, saving changes needs that token. The first
// time a save is refused, we ask for it once and remember it in this browser.

const TOKEN_KEY = "vcom_admin_token";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function setToken(value) {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable - the token just won't be remembered
  }
}

export async function apiFetch(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const send = (token) =>
    fetch(url, { ...options, headers: token ? { ...headers, "x-admin-token": token } : headers });

  let res = await send(getToken());

  if (res.status === 401 && method !== "GET") {
    const entered = window.prompt("Admin token needed to save changes (ADMIN_TOKEN in the bot's .env):");
    if (entered && entered.trim()) {
      setToken(entered.trim());
      res = await send(entered.trim());
      if (res.status === 401) setToken(""); // wrong token - forget it
    }
  }
  return res;
}

/** fetch + parse JSON, throwing on a non-2xx response */
export async function apiJson(url, options) {
  const res = await apiFetch(url, options);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
