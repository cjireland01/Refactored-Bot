import "dotenv/config";

// Channel IDs come from .env so the live bot and a test bot can run the exact
// same code. If a variable is not set, the live server's ID is used.
// To switch off a voice channel (e.g. on a test server), set it to empty:
//   VOICE_WAITING_ROOM_2=
const env = (name, fallback) =>
    Object.prototype.hasOwnProperty.call(process.env, name) ? process.env[name].trim() : fallback;

// Drop entries that are blank so nothing tries to fetch an empty channel ID.
const withoutBlanks = (obj) =>
    Object.fromEntries(Object.entries(obj).filter(([, id]) => id));

// === Text Channels ===
export const TEXT_CHANNELS = {
    AUTOQUEUE: env("CHANNEL_AUTOQUEUE", "1355664305932206200"),
    ALTQUEUE: env("CHANNEL_ALTQUEUE", "1435326372796039269"),
    INTEL: env("CHANNEL_INTEL", "1324759892275363982"),
    WARNINGS: env("CHANNEL_WARNINGS", "1421676401458679848"),
    SUGGESTIONS: env("CHANNEL_SUGGESTIONS", "1345885117519888465"),
};

// === Voice Channels ===
export const VOICE_CHANNELS = withoutBlanks({
    WAITING_ROOM: env("VOICE_WAITING_ROOM", "1324759339030020156"),
    WAITING_ROOM_2: env("VOICE_WAITING_ROOM_2", "1436397366461862180"),
    SILENT_ROOM: env("VOICE_SILENT_ROOM", "1343522310409424918"),
    MUSIC_ROOM: env("VOICE_MUSIC_ROOM", "1354134163782893619"),
});

// === Tags / Misc ===
export const TAGS = {
    VCOM: "vcom",
};

// === Leaderboard Settings ===
export const LEADERBOARD = {
    API_BASE: "https://warthunder.com/en/community/getclansleaderboard/dif/_hist/page/{}/sort/dr_era5?",
    MAX_PAGES: 10,
    MAX_ENTRIES: 200,
    POLL_INTERVAL: 1000 * 60,
};

// === Queue refresh ===
// Voice join/leave events trigger a refresh right away (after a short debounce).
// This slower sweep is only a safety net, e.g. for a BR change at its start time.
export const QUEUE = {
    DEBOUNCE_MS: 1000,
    SAFETY_SWEEP_MS: 1000 * 60,
};
