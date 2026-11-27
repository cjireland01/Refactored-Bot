import { Events } from "discord.js";
import { setAccessLookup } from "../server/auth/access.js";
import { authConfig, missingAuthSettings } from "../server/auth/config.js";

// Tells the website how to find out someone's level: look them up in the
// squadron server and compare their roles. Does nothing unless login is on.
export function start(client) {
  const cfg = authConfig();
  if (!cfg.enabled) {
    if (process.env.DISCORD_CLIENT_SECRET || process.env.PUBLIC_URL) {
      console.warn(`[auth] Discord login is NOT on. Missing: ${missingAuthSettings().join(", ")}`);
    }
    return;
  }

  const named = (roles, name) => roles.find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());

  setAccessLookup(async (userId, c) => {
    const guild = await client.guilds.fetch(c.guildId);
    const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
    if (!member) {
      console.warn(`[auth] ${userId} was refused: not a member of "${guild.name}".`);
      return "none";
    }

    const roles = await guild.roles.fetch();
    const who = `${member.displayName} (${userId})`;

    if (c.viewerRole) {
      const viewer = named(roles, c.viewerRole);
      if (!viewer) {
        console.warn(`[auth] ${who} was refused: the role "${c.viewerRole}" (WEB_VIEWER_ROLE) doesn't exist in "${guild.name}".`);
        return "none";
      }
      if (member.roles.highest.position < viewer.position) {
        console.warn(
          `[auth] ${who} was refused: their highest role is "${member.roles.highest.name}", which is below "${viewer.name}". ` +
            `They need "${viewer.name}" or a role above it.`
        );
        return "none";
      }
    }

    // Same rule as the /alt command: the editor role, or anything above it
    const editor = named(roles, c.editorRole);
    if (!editor) {
      console.warn(`[auth] The role "${c.editorRole}" (WEB_EDITOR_ROLE) doesn't exist in "${guild.name}", so nobody can edit.`);
      return "viewer";
    }
    return member.roles.highest.position >= editor.position ? "editor" : "viewer";
  });

  // Check the settings once the bot is online, so mistakes show up at startup
  client.once(Events.ClientReady, async () => {
    try {
      const guild = await client.guilds.fetch(cfg.guildId);
      const roles = await guild.roles.fetch();
      console.log(`[auth] Discord login is on for "${guild.name}".`);
      for (const [setting, name] of [["WEB_EDITOR_ROLE", cfg.editorRole], ["WEB_VIEWER_ROLE", cfg.viewerRole]]) {
        if (!name) continue;
        if (!named(roles, name)) {
          const list = [...roles.values()].filter((r) => r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => r.name);
          console.warn(`[auth] ${setting}="${name}" matches no role in "${guild.name}". Roles there: ${list.join(", ")}`);
        }
      }
    } catch (err) {
      console.warn(`[auth] Could not read the server for WEB_GUILD_ID=${cfg.guildId}: ${err.message}. Is the ID right, and is the bot in that server?`);
    }
  });
}
