import "../test-support/tempDb.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { EmbedBuilder } from "discord.js";

// Must be set before the modules below are loaded
process.env.META_SHEET_URL = "https://docs.google.com/spreadsheets/d/abc123/edit?gid=42#gid=42";

const { default: db } = await import("../utils/db.js");
const sheet = await import("../utils/metaSheet.js");
const { getVehiclesForUsername, addVehicleFields } = await import("../utils/vehicles.js");

// A small sheet in the same shape as the real one, padded to pass the size check
function makeCsv(extraRows = []) {
  const filler = Array.from({ length: 12 }, (_, i) => `,Filler US ${i},Filler DE ${i},,`);
  return [
    ` ,Updated,,,`,
    `♥ Premium,,,,`,
    `Battle Rating,USA,Germany,Italy/Hungary,United Kingdom`,
    `,,,,`,
    `10.7,"M1 Abrams / ♥ KVT",Leopard 2A4,Leopard 2A4,"Type 74 (E) / (F)"`,
    `,♥ M1A2 Abrams,"Leopard 40/70",,Chieftan Typo`,
    ...filler,
    ...extraRows,
    `,Meta,Specialist,Absolute Meta,Specialized Anti Air`,
    `,Never Parsed,,,`,
  ].join("\n");
}

before(() => {
  const user = db.prepare("INSERT INTO users (username, member_id, is_alt) VALUES (?, ?, ?)");
  const veh = db.prepare("INSERT INTO vehicles (user_id, br, vehicle_name, country) VALUES (?, ?, ?, ?)");
  user.run("Alice", "a", 0);
  user.run("NoMeta", "b", 0);
  veh.run(1, 10.7, "M1 Abrams", "country_usa");
  veh.run(1, 10.7, "Leopard 2A4", "country_germany");
  veh.run(2, 10.3, "Leopard 2A4", "country_france"); // same name, nation not on the sheet
  veh.run(1, 10.7, "◔Leopard 2A4", "country_italy"); // symbol-marked copy, same name
  veh.run(1, 10.0, "Random Tank", "country_usa");
  veh.run(1, 10.3, "Type 74 (F)", "country_japan");
  veh.run(2, 10.7, "Random Tank", "country_usa");
});

test("CSV reader handles quotes, escaped quotes and newlines", () => {
  assert.deepEqual(parse('a,"b,c","d ""q"""\n1,2,3'), [["a", "b,c", 'd "q"'], ["1", "2", "3"]]);
  assert.deepEqual(parse('"multi\nline",x\r\ny,z'), [["multi\nline", "x"], ["y", "z"]]);
});
const parse = (t) => sheet.parseCsv(t);

test("sheet parsing: nations from the header, stops at the key, ignores blanks", () => {
  const cells = sheet.parseMetaSheet(makeCsv());
  const has = (country, cell) => cells.some((c) => c.country === country && c.cell === cell);
  assert.ok(has("country_usa", "M1 Abrams / ♥ KVT"));
  assert.ok(has("country_italy", "Leopard 2A4")); // "Italy/Hungary"
  assert.ok(has("country_britain", "Type 74 (E) / (F)")); // "United Kingdom"
  assert.ok(!cells.some((c) => c.cell === "Never Parsed" || c.cell === "Meta"));
});

test("not the meta sheet -> null", () => {
  assert.equal(sheet.parseMetaSheet("<html>Sign in</html>"), null);
});

test("cells with several vehicles are split sensibly", () => {
  assert.deepEqual(sheet.cellCandidates("M42 / M19"), ["M42 / M19", "M42", "M19"]);
  assert.ok(sheet.cellCandidates("Type 74 (E) / (F)").includes("Type 74 (F)"));
  assert.ok(sheet.cellCandidates("Leopard 40/70").includes("Leopard 40/70"));
  assert.ok(sheet.cellCandidates("♥ Tiger II **").includes("Tiger II"));
});

test("names match ignoring case, symbols, spaces and punctuation", () => {
  assert.equal(sheet.nameKey("◔Leopard 2A4"), sheet.nameKey("leopard  2a4"));
  assert.equal(sheet.nameKey("T-72B3 `Arena`"), sheet.nameKey('T-72B3 "Arena"'));
});

test("link -> CSV address, keeping the tab", () => {
  assert.equal(
    sheet.toCsvUrl("https://docs.google.com/spreadsheets/d/abc123/edit?pli=1&gid=42#gid=42"),
    "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=42"
  );
  assert.equal(sheet.toCsvUrl("https://x.test/a?output=csv"), "https://x.test/a?output=csv");
});

test("a bad download never replaces the list", async () => {
  assert.equal((await sheet.refreshMetaSheet({ fetchText: async () => makeCsv() })).ok, true);
  assert.equal(sheet.isOnMetaSheet("country_germany", "Leopard 2A4"), true);

  const html = await sheet.refreshMetaSheet({ fetchText: async () => "<html>login</html>" });
  assert.equal(html.ok, false);
  const tiny = await sheet.refreshMetaSheet({ fetchText: async () => "Battle Rating,USA\n,Only One" });
  assert.equal(tiny.ok, false);
  const down = await sheet.refreshMetaSheet({ fetchText: async () => { throw new Error("offline"); } });
  assert.equal(down.ok, false);

  assert.equal(sheet.isOnMetaSheet("country_germany", "Leopard 2A4"), true); // still there
  assert.match(sheet.getMetaSheetStatus().error, /offline/);
});

test("refresh reports whether anything changed", async () => {
  const same = await sheet.refreshMetaSheet({ fetchText: async () => makeCsv() });
  assert.deepEqual([same.ok, same.changed], [true, false]);
  const edited = await sheet.refreshMetaSheet({ fetchText: async () => makeCsv([",Extra Tank,,,"]) });
  assert.deepEqual([edited.ok, edited.changed], [true, true]);
  assert.equal(sheet.isOnMetaSheet("country_usa", "Extra Tank"), true);
  // put it back for the tests below
  await sheet.refreshMetaSheet({ fetchText: async () => makeCsv() });
  assert.equal(sheet.isOnMetaSheet("country_usa", "Extra Tank"), false);
});

test("the list survives a restart (saved in the database)", () => {
  const saved = db.prepare("SELECT COUNT(*) AS n FROM meta_sheet_cells").get().n;
  assert.ok(saved >= 20);
  sheet.loadSavedMetaSheet();
  assert.equal(sheet.isOnMetaSheet("country_usa", "M1A2 Abrams"), true);
});

test("matching is per nation", () => {
  assert.equal(sheet.isOnMetaSheet("country_germany", "Leopard 2A4"), true);
  assert.equal(sheet.isOnMetaSheet("country_italy", "Leopard 2A4"), true); // listed under Italy too
  assert.equal(sheet.isOnMetaSheet("country_france", "Leopard 2A4"), false); // not under France
  assert.equal(sheet.isOnMetaSheet("country_usa", "Leopard 2A4"), false);
  assert.equal(sheet.isOnMetaSheet("country_usa", "M1 Abrams"), true); // from "M1 Abrams / ♥ KVT"
  assert.equal(sheet.isOnMetaSheet("country_britain", "Type 74 (F)"), true); // from "(E) / (F)"
  assert.equal(sheet.isOnMetaSheet(null, "M1 Abrams"), true); // unknown nation: any nation
  assert.equal(sheet.isOnMetaSheet("country_usa", ""), false);
});

test("queues only get vehicles that are on the sheet", () => {
  const rows = getVehiclesForUsername("alice", "10.7");
  const names = rows.map((r) => r.Vehicle).sort();
  // M1 Abrams (usa), Leopard 2A4 (germany), ◔Leopard 2A4 (italy) - not France, not Random Tank
  assert.deepEqual(names, ["M1 Abrams", "Leopard 2A4", "◔Leopard 2A4"].sort());
  assert.deepEqual(getVehiclesForUsername("nometa", "10.7"), []);
});

test("players without meta vehicles are listed as 'No meta vehicles'", () => {
  const embed = new EmbedBuilder();
  const map = new Map([
    ["Alice", getVehiclesForUsername("alice", "10.7")],
    ["NoMeta", getVehiclesForUsername("nometa", "10.7")],
  ]);
  addVehicleFields(embed, map, { emptyText: "No meta vehicles" });
  const fields = embed.data.fields;
  assert.equal(fields.length, 2);
  assert.equal(fields.find((f) => f.name === "NoMeta").value, "No meta vehicles");

  const plain = new EmbedBuilder();
  addVehicleFields(plain, map); // without emptyText they are left out, as before
  assert.equal(plain.data.fields.length, 1);
});

test("status lists sheet entries that match nothing in the database", () => {
  const status = sheet.getMetaSheetStatus();
  assert.equal(status.enabled, true);
  assert.ok(status.entries >= 20);
  assert.ok(status.unmatched.some((u) => u.cell === "Chieftan Typo"));
  assert.ok(!status.unmatched.some((u) => u.cell === "M1 Abrams / ♥ KVT"));
});

test("several tabs (comma separated links) are combined, and one failing keeps the old list", async () => {
  // can't change the env after load, so exercise the same path through refresh with two links
  const mod = await import("../config/constants.js");
  const original = mod.META_SHEET.URL;
  mod.META_SHEET.URL = "https://docs.google.com/spreadsheets/d/abc/edit?gid=1, https://docs.google.com/spreadsheets/d/abc/edit?gid=2";
  try {
    const air = makeCsv([",Air Plane One,,,"]);
    const ground = makeCsv();
    const ok = await sheet.refreshMetaSheet({ fetchText: async (link) => (link.includes("gid=2") ? air : ground) });
    assert.equal(ok.ok, true);
    assert.equal(sheet.isOnMetaSheet("country_usa", "Air Plane One"), true);
    assert.equal(sheet.isOnMetaSheet("country_usa", "M1A2 Abrams"), true);

    const broken = await sheet.refreshMetaSheet({
      fetchText: async (link) => (link.includes("gid=2") ? "<html>nope</html>" : ground),
    });
    assert.equal(broken.ok, false);
    assert.match(broken.error, /Link 2/);
    assert.equal(sheet.isOnMetaSheet("country_usa", "Air Plane One"), true); // old list kept
  } finally {
    mod.META_SHEET.URL = original;
    await sheet.refreshMetaSheet({ fetchText: async () => makeCsv() });
  }
});

test("the dashboard's meta list reflects the sheet while it is on", async () => {
  const { createApp } = await import("../server/app.js");
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/meta-vehicles`);
    const rows = await res.json();
    const by = (n) => rows.find((r) => r.vehicle_name === n);
    assert.equal(by("M1 Abrams").is_meta, 1);
    assert.equal(by("M1 Abrams").from_sheet, true);
    assert.equal(by("Random Tank").is_meta, 0);
  } finally {
    server.close();
  }
});
