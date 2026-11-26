import "../test-support/tempDb.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import db from "../utils/db.js";
import { TEXT_CHANNELS, VOICE_CHANNELS } from "../config/constants.js";
import { refreshVoiceQueue, requestQueueRefresh } from "../features/autoQueue.js";
import { webState } from "../server/state.js";
import { zonedTimeToMs } from "../utils/time.js";

// ---- a tiny fake of the parts of Discord the queue touches ----
const posts = [];
const edits = [];
let nextId = 0;
let failEdits = false; // pretend the message was deleted: Discord rejects the edit

const textChannel = {
  send: async ({ embeds }) => {
    posts.push(embeds[0].data);
    return {
      id: ++nextId,
      edit: async ({ embeds }) => {
        if (failEdits) throw new Error("Unknown Message");
        edits.push(embeds[0].data);
      },
    };
  },
};
const members = new Map();
const voiceChannel = { members };
const client = {
  channels: {
    fetch: async (id) => {
      if (id === TEXT_CHANNELS.AUTOQUEUE) return textChannel;
      if (id === VOICE_CHANNELS.WAITING_ROOM) return voiceChannel;
      throw new Error("Unknown Channel");
    },
  },
};
const join = (id, name) => members.set(id, { displayName: name, user: { bot: false, username: name } });
const names = (embed) => embed.fields.map((f) => f.name).sort();

before(() => {
  db.prepare("INSERT INTO br_schedule (br, start) VALUES (10.7, '2020-01-01')").run();
  const user = db.prepare("INSERT INTO users (username, member_id) VALUES (?, ?)");
  const vehicle = db.prepare("INSERT INTO vehicles (user_id, br, vehicle_name) VALUES (?, ?, ?)");
  user.run("Alice", "a");
  user.run("Bob", "b");
  vehicle.run(1, 10.7, "Leopard 2A4");
  vehicle.run(2, 10.3, "Abrams");
});

test("nothing is posted while the voice channels are empty", async () => {
  await refreshVoiceQueue(client);
  assert.equal(posts.length, 0);
});

test("when people join, one embed is posted with each member's vehicles", async () => {
  join(1, "Alice");
  join(2, "Bob | Tag"); // display names with a tag still match "bob"
  await refreshVoiceQueue(client);

  assert.equal(posts.length, 1);
  assert.deepEqual(names(posts[0]), ["Alice", "Bob | Tag"]);
  assert.match(posts[0].fields.find((f) => f.name === "Alice").value, /Leopard 2A4/);
});

test("the website gets the same data", () => {
  const alice = webState.voiceUsers.find((u) => u.username === "Alice");
  assert.ok(alice.vehicles.includes("Leopard 2A4 (10.7)"));
});

test("when nothing changed there is no Discord call at all", async () => {
  await refreshVoiceQueue(client);
  assert.equal(posts.length, 1);
  assert.equal(edits.length, 0);
});

test("a change edits the existing embed instead of posting a new one", async () => {
  members.delete(2);
  await refreshVoiceQueue(client);
  assert.equal(posts.length, 1);
  assert.equal(edits.length, 1);
  assert.deepEqual(names(edits[0]), ["Alice"]);
});

test("overlapping refreshes are serialized and never double-post", async () => {
  join(3, "Carl");
  await Promise.all([refreshVoiceQueue(client), refreshVoiceQueue(client), refreshVoiceQueue(client)]);
  assert.equal(posts.length, 1);
  assert.equal(edits.length, 2);
});

test("a burst of voice events becomes a single refresh", async () => {
  members.delete(3);
  for (let i = 0; i < 5; i++) requestQueueRefresh(client, 40);
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(edits.length, 3);
});

test("if the embed message was deleted, a new one is posted", async () => {
  failEdits = true;
  join(4, "Dana");
  await refreshVoiceQueue(client);
  assert.equal(posts.length, 2); // edit failed -> fell back to posting a fresh embed
  assert.ok(names(posts[1]).includes("Carl") === false);

  // and from then on, edits work again on the new message
  failEdits = false;
  const editsBefore = edits.length;
  members.delete(4);
  await refreshVoiceQueue(client);
  assert.equal(posts.length, 2);
  assert.equal(edits.length, editsBefore + 1);
});
