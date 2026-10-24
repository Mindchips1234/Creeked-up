// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Load the browser scripts into one shared context, the same way index.html does.
const ctx = vm.createContext({ module: { exports: {} } });
for (const f of ["data.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx);
}
const run = (code) => vm.runInContext(code, ctx);

const fish = (o) => ({
  id: Math.random().toString(36), createdAt: "2026-10-24T12:00:00.000Z",
  caughtAt: "2026-10-24T12:00:00.000Z", hasPhoto: true, lat: 44, lng: -79,
  released: false, lengthCm: null, ...o,
});

test("full proof, typical size, first of species earns double base", () => {
  ctx.list = [fish({ speciesId: "walleye", lengthCm: 45 })];
  const [c] = run("scoreCatches(list)");
  assert.strictEqual(c.exp, 100); // 50 base x2 first species
});

test("second of a species loses the first-catch bonus", () => {
  ctx.list = [
    fish({ speciesId: "walleye", lengthCm: 45, caughtAt: "2026-10-24T10:00:00.000Z" }),
    fish({ speciesId: "walleye", lengthCm: 45, caughtAt: "2026-10-24T11:00:00.000Z" }),
  ];
  const s = run("scoreCatches(list)");
  assert.strictEqual(JSON.stringify(s.map((c) => c.exp)), "[100,50]");
});

test("no photo and no GPS halves EXP", () => {
  ctx.list = [fish({ speciesId: "walleye", lengthCm: 45, hasPhoto: false, lat: null })];
  assert.strictEqual(run("scoreCatches(list)")[0].exp, 50);
});

test("size bonus is capped and small fish never drop below half", () => {
  ctx.big = fish({ speciesId: "bluegill", lengthCm: 500 });
  ctx.small = fish({ speciesId: "bluegill", lengthCm: 1 });
  assert.strictEqual(run("sizeMultiplier(big)"), 4);
  assert.strictEqual(run("sizeMultiplier(small)"), 0.5);
});

test("release adds 10 percent", () => {
  ctx.list = [fish({ speciesId: "muskellunge", lengthCm: 100, released: true })];
  assert.strictEqual(run("scoreCatches(list)")[0].exp, 264); // 120 x2 x1.1
});

test("levels follow the curve", () => {
  assert.strictEqual(run("levelFromExp(0)").level, 1);
  assert.strictEqual(run("levelFromExp(99)").level, 1);
  assert.strictEqual(run("levelFromExp(100)").level, 2);
  const need2 = run("expForNextLevel(2)"); // 283
  assert.strictEqual(run(`levelFromExp(${100 + need2})`).level, 3);
  assert.strictEqual(run("levelFromExp(10000000)").title, "Creeked Up Master");
});

test("badges", () => {
  ctx.list = [
    fish({ speciesId: "bluegill", caughtAt: "2026-10-24T05:00:00" }),
    fish({ speciesId: "walleye" }),
    fish({ speciesId: "muskellunge" }),
  ];
  const b = run("earnedBadges(list)");
  for (const id of ["first-catch", "trio", "early-bird", "muskie"]) assert.ok(b.includes(id), id);
  assert.ok(!b.includes("ten-catches"));
});

test("every badge has a unique id, a name and a description", () => {
  const ids = run("BADGES.map((b) => b.id)");
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(run("BADGES.every((b) => b.name && b.desc && typeof b.test === 'function')"));
  ctx.none = [];
  assert.strictEqual(run("earnedBadges(none)").length, 0); // an empty log earns nothing
});

test("species set and size badges", () => {
  ctx.list = ["pumpkinseed", "bluegill", "rock-bass", "yellow-perch", "black-crappie"].map((s) => fish({ speciesId: s }));
  ctx.list.push(fish({ speciesId: "northern-pike", lengthCm: 120, weightKg: 6 }));
  const b = run("earnedBadges(list)");
  for (const id of ["panfish-sweep", "five-species", "pike", "monster", "metre-fish", "five-kg", "five-species-day"]) assert.ok(b.includes(id), id);
  assert.ok(!b.includes("bass-pair"));
});

test("days are counted in local time, so a late evening catch stays on its own day", () => {
  ctx.list = [
    fish({ speciesId: "bluegill", caughtAt: new Date(2026, 9, 24, 23, 30).toISOString() }),
    fish({ speciesId: "walleye", caughtAt: new Date(2026, 9, 25, 0, 30).toISOString() }),
    fish({ speciesId: "rock-bass", caughtAt: new Date(2026, 9, 25, 9, 0).toISOString() }),
  ];
  assert.ok(!run("earnedBadges(list)").includes("trio"));
});

test("streaks and weekends", () => {
  // 24 Oct 2026 is a Saturday.
  ctx.list = [24, 25, 26].map((d) => fish({ speciesId: "bluegill", caughtAt: new Date(2026, 9, d, 10).toISOString() }));
  assert.strictEqual(run("longestStreak(list)"), 3);
  const b = run("earnedBadges(list)");
  assert.ok(b.includes("weekend-warrior") && b.includes("streak-three"));
  assert.ok(!b.includes("streak-seven"));
  ctx.gap = [24, 26].map((d) => fish({ speciesId: "bluegill", caughtAt: new Date(2026, 9, d, 10).toISOString() }));
  assert.strictEqual(run("longestStreak(gap)"), 1);
});

test("places must be at least 1 km apart to count separately", () => {
  ctx.list = [
    fish({ speciesId: "bluegill", lat: 44.0, lng: -79.0 }),
    fish({ speciesId: "bluegill", lat: 44.001, lng: -79.0 }), // about 110 m away, same place
    fish({ speciesId: "bluegill", lat: 44.05, lng: -79.0 }),  // about 5.5 km away
    fish({ speciesId: "bluegill", lat: 44.1, lng: -79.0 }),
    fish({ speciesId: "bluegill", lat: null, lng: null }),    // no location, ignored
  ];
  assert.strictEqual(run("distinctSpots(list)"), 3);
  assert.ok(run("earnedBadges(list)").includes("three-spots"));
});

test("seasons and baits", () => {
  ctx.list = [0, 3, 6, 9].map((m, i) => fish({ speciesId: "bluegill", caughtAt: new Date(2026, m, 10, 10).toISOString(), bait: ["Worm", "worm ", "Jig", "Spinner"][i] }));
  const b = run("earnedBadges(list)");
  assert.ok(b.includes("four-seasons") && b.includes("cold-hands"));
  assert.ok(!b.includes("five-baits")); // "Worm" and "worm " are the same bait
});
