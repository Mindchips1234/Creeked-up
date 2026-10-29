// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({ module: { exports: {} } });
for (const f of ["data.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx);
}
const run = (code) => vm.runInContext(code, ctx);
const issue = (id, cm, kg) => { ctx.a = [id, cm, kg]; return run("sizeIssue(a[0], a[1], a[2])"); };

test("every fish has size limits above its typical length and record", () => {
  const ids = run("[...SPECIES, ...OTHER_REGION_SPECIES].map((s) => s.id)");
  for (const id of ids) {
    ctx.id = id;
    const lim = run("SIZE_LIMITS[id]");
    assert.ok(lim, `no limits for ${id}`);
    const typical = run("speciesById(id).typicalCm");
    if (typical) assert.ok(typical < lim.maxCm, id);
    if (lim.refCm) {
      assert.ok(lim.maxCm >= lim.refCm && lim.maxKg >= lim.refKg, id);
      assert.strictEqual(issue(id, lim.refCm, lim.refKg), null, `record ${id} should pass`);
    }
  }
});

test("typical fish pass (Ontario government typical length and weight)", () => {
  // Middle of the length and weight ranges on www.ontario.ca/page/<fish>.
  const typical = { "smallmouth-bass": [38, 1.05], walleye: [47, 1.02], "largemouth-bass": [40, 1.25],
    "rock-bass": [18, 0.2], pumpkinseed: [20, 0.2], bluegill: [19, 0.2], "yellow-perch": [22, 0.35],
    "black-crappie": [22, 0.34], "common-carp": [52, 1.85], "channel-catfish": [44, 1.35],
    "lake-whitefish": [48, 1.35], "northern-pike": [60, 2.6], "coho-salmon": [52, 3.4],
    "chinook-salmon": [65, 4.95], muskellunge: [104, 7.5] };
  for (const [id, [cm, kg]] of Object.entries(typical)) assert.strictEqual(issue(id, cm, kg), null, id);
  assert.strictEqual(issue("walleye", 47, null), null);
  assert.strictEqual(issue("walleye", null, 1), null);
  assert.strictEqual(issue("other", 80, 5), null);
});

test("clearly fake sizes are blocked", () => {
  assert.deepStrictEqual({ ...issue("bluegill", 500, null) }, { field: "length", kind: "big", limit: 34, refCm: 28.2 });
  assert.strictEqual(issue("walleye", 47 * 2.54, null).kind, "big");    // 47 typed in inches instead of cm
  assert.strictEqual(issue("smallmouth-bass", 38, 10).kind, "big");      // 10 lb typed as kg
  assert.strictEqual(issue("northern-pike", 30, 15).kind, "fit");        // 30 cm pike can't weigh 15 kg
  assert.strictEqual(issue("muskellunge", 120, 0.2).kind, "fit");        // or a 120 cm muskie 200 g
  assert.strictEqual(issue("other", 300, null).kind, "big");
  assert.strictEqual(issue("walleye", 1, null).kind, "small");
  assert.strictEqual(issue("walleye", 0, null).kind, "small");
  assert.strictEqual(issue("walleye", -5, null).kind, "small");
  assert.strictEqual(issue("walleye", null, 0).kind, "small");
});

test("messages use the units typed in", () => {
  ctx.big = issue("walleye", 47 * 2.54, null);
  const inches = run("sizeIssueText(big, 'walleye', 'in', 'kg')");
  assert.match(inches, /Walleye/);
  assert.match(inches, /36\.5 in/);   // Ontario record
  assert.match(inches, /43\.7 in/);   // 111 cm limit
  ctx.heavy = issue("smallmouth-bass", 38, 10);
  assert.match(run("sizeIssueText(heavy, 'smallmouth-bass', 'cm', 'lb')"), /15\.21 lb/);
  ctx.fit = issue("northern-pike", 30, 15);
  assert.match(run("sizeIssueText(fit, 'northern-pike')"), /doesn't fit a Northern Pike/);
  ctx.other = issue("other", 300, null);
  assert.match(run("sizeIssueText(other, 'other')"), /fish in Ontario/);
});

test("fake sizes already in the log earn no size bonus or size badges", () => {
  ctx.list = [{ id: "x", speciesId: "bluegill", lengthCm: 120, weightKg: 9, caughtAt: "2026-10-24T12:00:00.000Z",
    createdAt: "2026-10-24T12:00:00.000Z", hasPhoto: true, lat: 44, lng: -79 }];
  assert.strictEqual(run("scoreCatches(list)[0].expParts.size"), 1);
  const badges = run("earnedBadges(list)");
  for (const b of ["metre-fish", "fifty-cm", "five-kg", "big-one", "monster", "tape-measure", "on-the-scale"]) {
    assert.ok(!badges.includes(b), b);
  }
  // A real length with a weight that doesn't fit keeps the length and drops the weight.
  ctx.c = { speciesId: "northern-pike", lengthCm: 30, weightKg: 15 };
  assert.strictEqual(run("okLength(c)"), 30);
  assert.strictEqual(run("okWeight(c)"), null);
});
