import "../test-support/tempDb.js";
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.CHANNEL_AUTOQUEUE = "  111  ";
process.env.VOICE_WAITING_ROOM = "222";
process.env.VOICE_WAITING_ROOM_2 = "";
process.env.VOICE_SILENT_ROOM = "";
delete process.env.VOICE_MUSIC_ROOM;
delete process.env.CHANNEL_INTEL;

const { TEXT_CHANNELS, VOICE_CHANNELS } = await import("../config/constants.js");

test("channel IDs come from the environment and are trimmed", () => {
  assert.equal(TEXT_CHANNELS.AUTOQUEUE, "111");
  assert.equal(VOICE_CHANNELS.WAITING_ROOM, "222");
});

test("IDs that are not set fall back to the live server's", () => {
  assert.equal(TEXT_CHANNELS.INTEL, "1324759892275363982");
  assert.equal(VOICE_CHANNELS.MUSIC_ROOM, "1354134163782893619");
});

test("a voice channel set to blank is switched off", () => {
  assert.deepEqual(Object.keys(VOICE_CHANNELS).sort(), ["MUSIC_ROOM", "WAITING_ROOM"]);
});
