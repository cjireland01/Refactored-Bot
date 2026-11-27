// Settings for "Log in with Discord". Read from the environment when used
// (not when loaded), so they can be changed in tests.
//
// Login is only turned on when ALL the required settings are present. Without
// them the dashboard works the old way (open, or protected by ADMIN_TOKEN).

const clean = (v) => String(v ?? "").trim();

export function authConfig() {
  const publicUrl = clean(process.env.PUBLIC_URL).replace(/\/+$/, "");
  const cfg = {
    clientId: clean(process.env.CLIENT_ID),
    clientSecret: clean(process.env.DISCORD_CLIENT_SECRET),
    guildId: clean(process.env.WEB_GUILD_ID),
    sessionSecret: clean(process.env.SESSION_SECRET),
    publicUrl,
    secureCookies: publicUrl.startsWith("https://"),
    editorRole: clean(process.env.WEB_EDITOR_ROLE) || "Chapter Master",
    viewerRole: clean(process.env.WEB_VIEWER_ROLE), // blank = any server member
    sessionDays: 7,
  };
  cfg.enabled = Boolean(cfg.clientId && cfg.clientSecret && cfg.guildId && cfg.sessionSecret && cfg.publicUrl);
  return cfg;
}

/** Which required settings are missing (for a clear startup message) */
export function missingAuthSettings() {
  const cfg = authConfig();
  return [
    ["CLIENT_ID", cfg.clientId],
    ["DISCORD_CLIENT_SECRET", cfg.clientSecret],
    ["WEB_GUILD_ID", cfg.guildId],
    ["SESSION_SECRET", cfg.sessionSecret],
    ["PUBLIC_URL", cfg.publicUrl],
  ]
    .filter(([, v]) => !v)
    .map(([name]) => name);
}
