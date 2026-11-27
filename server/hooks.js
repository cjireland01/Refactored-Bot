// A tiny way for the website to tell the bot that something happened,
// without the web server needing to know about Discord.

const altsChanged = [];

/** Bot side: run `fn` whenever alts are changed from the website */
export function onAltsChanged(fn) {
  altsChanged.push(fn);
}

/** Web side: announce that alts were changed */
export function emitAltsChanged() {
  for (const fn of altsChanged) {
    Promise.resolve()
      .then(fn)
      .catch((err) => console.error("[hooks] altsChanged handler failed:", err));
  }
}

const metaSheetChanged = [];

/** Bot side: run `fn` whenever the meta sheet list changes */
export function onMetaSheetChanged(fn) {
  metaSheetChanged.push(fn);
}

/** Announce that the meta sheet list changed (after a refresh) */
export function emitMetaSheetChanged() {
  for (const fn of metaSheetChanged) {
    Promise.resolve()
      .then(fn)
      .catch((err) => console.error("[hooks] metaSheetChanged handler failed:", err));
  }
}
