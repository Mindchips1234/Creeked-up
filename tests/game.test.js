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
