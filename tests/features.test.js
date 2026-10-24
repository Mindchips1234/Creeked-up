// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({ module: undefined });
for (const f of ["data.js", "game.js", "quests.js", "idguide.js", "conditions.js", "tackle.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx);
}
const run = (code) => vm.runInContext(code, ctx);

test("ISO week keys", () => {
  assert.strictEqual(run('weekKey(new Date(2026, 9, 24))'), "2026-W43");
  assert.strictEqual(run('weekKey(new Date(2026, 0, 1))'), "2026-W01");
  assert.strictEqual(run('weekKey(new Date(2027, 0, 1))'), "2026-W53");
});

test("three different quests per week, same every time", () => {
  const a = run('JSON.stringify(questsForWeek("2026-W43"))');
  assert.strictEqual(a, run('JSON.stringify(questsForWeek("2026-W43"))'));
  const kinds = run('questsForWeek("2026-W43").map(q => q.kind)');
  assert.strictEqual(new Set(kinds).size, 3);
});

test("quest bonus EXP counts only finished quests", () => {
  ctx.none = [];
  assert.strictEqual(run("questExp(none)"), 0);
  // Ten varied catches in one week finish every quest kind except possibly a target species.
  ctx.many = ["bluegill","yellow-perch","rock-bass","pumpkinseed","smallmouth-bass","largemouth-bass","northern-pike","walleye"].map((s, i) => ({
    id: String(i), speciesId: s, caughtAt: new Date(2026, 9, 20, 6, i).toISOString(), createdAt: "x",
    released: true, hasPhoto: true, lat: 44, lng: -79, lengthCm: 200,
  }));
  const qs = run("weekQuests(many, new Date(2026, 9, 21))");
  assert.ok(qs.every((q) => q.done), JSON.stringify(qs));
  assert.strictEqual(run("questExp(many)"), qs.reduce((s, q) => s + q.reward, 0));
});

test("fish scan ranks the right fish first for classic marks", () => {
  assert.strictEqual(run('identify(["whitetail","glassyeye"])[0].id'), "walleye");
  assert.strictEqual(run('identify(["duckbill","spots"])[0].id'), "northern-pike");
  assert.strictEqual(run('identify(["pinkstripe"])[0].id'), "rainbow-trout");
  assert.strictEqual(run('identify(["sidestripe","spiny"])[0].id'), "largemouth-bass");
  assert.strictEqual(run("identify([]).length"), 0);
});

test("every ID guide species exists and every trait is defined", () => {
  const ok = run(`Object.entries(ID_GUIDE).every(([id, g]) => SPECIES.some(s => s.id === id) &&
    g.traits.every(t => ID_TRAITS.some(x => x.id === t)))`);
  assert.ok(ok);
});

test("moon phase matches known dates", () => {
  // Full moon 2026-10-26 (approx), new moon 2026-10-10 (approx).
  const full = run("moonPhase(new Date(Date.UTC(2026, 9, 26, 4)))");
  assert.ok(full.lit >= 95, JSON.stringify(full));
  const nw = run("moonPhase(new Date(Date.UTC(2026, 9, 10, 16)))");
  assert.ok(nw.lit <= 5, JSON.stringify(nw));
});

test("weather codes", () => {
  assert.strictEqual(run("weatherText(0)"), "Clear");
  assert.strictEqual(run("weatherText(63)"), "Rain");
  assert.strictEqual(run("weatherText(95)"), "Thunderstorm");
});

test("best baits counts per species, ignoring case", () => {
  ctx.cs = [
    { speciesId: "walleye", bait: "Jig and minnow" }, { speciesId: "walleye", bait: "jig and minnow " },
    { speciesId: "walleye", bait: "Crankbait" }, { speciesId: "bluegill", bait: "Worm" },
  ];
  const b = run('bestBaits(cs, "walleye")');
  assert.strictEqual(b[0].n, 2);
  assert.strictEqual(b.length, 2);
});
