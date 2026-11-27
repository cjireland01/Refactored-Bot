import "../test-support/tempDb.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { EmbedBuilder } from "discord.js";
import db from "../utils/db.js";
import {
  sanitizeVehicleName,
  getBRRange,
  getVehiclesForUsername,
  getAltUsers,
  formatVehicleField,
  addVehicleFields,
} from "../utils/vehicles.js";

before(() => {
  const user = db.prepare("INSERT INTO users (username, member_id, is_alt) VALUES (?, ?, ?)");
  const vehicle = db.prepare("INSERT INTO vehicles (user_id, br, vehicle_name) VALUES (?, ?, ?)");
  user.run("Alice", "a", 0);
  user.run("AltGuy", "c", 1);
  vehicle.run(1, 10.7, "Leopard 2A4");
  vehicle.run(1, 9.7, "T-72A");
  vehicle.run(1, 7.0, "Too Low");
  vehicle.run(1, 12.0, "Too High");
  vehicle.run(2, 10.7, "Alt Tank");
});

test("BR window is one BR below, except at the top", () => {
  assert.deepEqual(getBRRange("10.7"), { min: 9.7, max: 10.7 });
  assert.deepEqual(getBRRange("12.7"), { min: 11.7, max: 12.7 });
  assert.deepEqual(getBRRange("14.0"), { min: 11.0, max: 14.0 });
});

test("vehicle names are cleaned for display", () => {
  assert.equal(sanitizeVehicleName("  Pz.Kpfw.  IV   Ausf. H "), "Pz.Kpfw. IV Ausf. H");
  assert.equal(sanitizeVehicleName("Löwe ▮ Tank"), "Lowe Tank");
  assert.equal(sanitizeVehicleName("M60A1 (AOS)"), "M60A1 (AOS)");
  assert.equal(sanitizeVehicleName(null), "");
});

test("only vehicles inside the BR window are returned, case-insensitively by name", () => {
  const names = getVehiclesForUsername("ALICE", "10.7").map((v) => v.Vehicle).sort();
  assert.deepEqual(names, ["Leopard 2A4", "T-72A"]);
});

test("without a BR every vehicle comes back, highest BR first", () => {
  const all = getVehiclesForUsername("alice");
  assert.equal(all.length, 4);
  assert.equal(all[0].BR, "12.0");
});

test("unknown users have no vehicles", () => {
  assert.deepEqual(getVehiclesForUsername("nobody", "10.7"), []);
  assert.deepEqual(getVehiclesForUsername("", "10.7"), []);
});

test("alt users are listed", () => {
  assert.deepEqual(getAltUsers().map((u) => u.username), ["AltGuy"]);
});

test("a field groups by BR, highest first", () => {
  const text = formatVehicleField([
    { Vehicle: "A", BR: "9.7" },
    { Vehicle: "B", BR: "10.7" },
    { Vehicle: "C", BR: "10.7" },
  ]);
  assert.equal(text, "10.7 - B, C\n9.7 - A");
});

test("a very long field is cut to fit Discord's limit", () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ Vehicle: `Some Long Vehicle Name ${i}`, BR: "10.7" }));
  const text = formatVehicleField(many);
  assert.ok(text.length <= 1024);
  assert.match(text, /some not shown$/);
});

test("an embed never gets more than 25 fields", () => {
  const users = new Map(Array.from({ length: 40 }, (_, i) => [`user${i}`, [{ Vehicle: `X${i}`, BR: "10.7" }]]));
  const embed = new EmbedBuilder();
  const skipped = addVehicleFields(embed, users);
  assert.equal(embed.data.fields.length, 25);
  assert.equal(skipped, 15);
});

test("users with no vehicles get no field", () => {
  const embed = new EmbedBuilder();
  addVehicleFields(embed, new Map([["empty", []]]));
  assert.equal(embed.data.fields, undefined);
});
