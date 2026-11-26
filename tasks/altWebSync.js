import { onAltsChanged } from "../server/hooks.js";
import { updateAltTrackerEmbed } from "../features/altQueue.js";

// When someone adds or removes an alt on the website, refresh the Discord embed too.
export function start(client) {
  onAltsChanged(() => updateAltTrackerEmbed(client));
}
