import { Events } from "discord.js";
import { META_SHEET } from "../config/constants.js";
import { isSheetMetaActive, refreshMetaSheet } from "../utils/metaSheet.js";
import { onMetaSheetChanged, emitMetaSheetChanged } from "../server/hooks.js";
import { refreshVoiceQueue } from "../features/autoQueue.js";
import { updateAltTrackerEmbed } from "../features/altQueue.js";

// Keeps the meta list up to date. Does nothing unless META_SHEET_URL is set.
export function start(client) {
  if (!isSheetMetaActive()) return;

  // When the list changes (here, or from the dashboard's Refresh button),
  // redraw both embeds so they match
  onMetaSheetChanged(async () => {
    await refreshVoiceQueue(client);
    await updateAltTrackerEmbed(client);
  });

  async function refresh() {
    const { changed } = await refreshMetaSheet();
    if (changed) emitMetaSheetChanged();
  }

  client.once(Events.ClientReady, async () => {
    await refresh();
    // Draw once so the first embeds already use the list
    await refreshVoiceQueue(client);
    await updateAltTrackerEmbed(client);
    setInterval(refresh, META_SHEET.REFRESH_MS);
  });
}
