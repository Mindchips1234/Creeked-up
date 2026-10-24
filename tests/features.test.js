// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({ module: undefined });
for (const f of ["data.js", "game.js", "seasons.js", "quests.js", "idguide.js", "conditions.js", "tackle.js"]) {
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
  assert.ok(qs.filter((q) => q.kind !== "target").every((q) => q.done), JSON.stringify(qs));
  const ds = run("dayChallenges(many, new Date(2026, 9, 20))");
  const sum = (list) => list.filter((q) => q.done).reduce((s, q) => s + q.reward, 0);
  assert.strictEqual(run("questExp(many)"), sum(qs) + sum(ds));
});

test("Zone 17 opening days land on the right Saturdays (2026)", () => {
  const d = (r) => run(`dayKey(ruleDate(${JSON.stringify(r)}, 2026))`);
  assert.strictEqual(d(["sat", 4, 4]), "2026-04-25"); // trout and salmon opener
  assert.strictEqual(d(["sat", 5, 2]), "2026-05-09"); // walleye opener
  assert.strictEqual(d(["sat", 6, 3]), "2026-06-20"); // bass opener
  assert.strictEqual(d(["sat", 6, 1]), "2026-06-06"); // muskie opener
});

test("Zone 17 seasons open and close on the right days", () => {
  const open = (s, y, m, day) => run(`isInSeason("${s}", new Date(${y}, ${m - 1}, ${day}))`);
  assert.strictEqual(open("walleye", 2026, 5, 8), false);
  assert.strictEqual(open("walleye", 2026, 5, 9), true);
  assert.strictEqual(open("walleye", 2026, 11, 15), true);
  assert.strictEqual(open("walleye", 2026, 11, 16), false);
  assert.strictEqual(open("smallmouth-bass", 2026, 6, 19), false);
  assert.strictEqual(open("smallmouth-bass", 2026, 12, 15), true);
  assert.strictEqual(open("smallmouth-bass", 2026, 12, 16), false);
  assert.strictEqual(open("brook-trout", 2026, 9, 30), true);
  assert.strictEqual(open("brook-trout", 2026, 10, 1), false);
  assert.strictEqual(open("splake", 2026, 7, 1), false);
  assert.strictEqual(open("northern-pike", 2026, 2, 1), true);
  assert.strictEqual(open("rock-bass", 2026, 1, 1), true);
});

test("challenges never ask for an out-of-season fish", () => {
  // Every day of 2026 and 2027: each daily target is open that day, each weekly target all week.
  for (let t = new Date(2026, 0, 1); t < new Date(2028, 0, 1); t.setDate(t.getDate() + 1)) {
    ctx.t = new Date(t);
    const daily = run("challengesForDay(dayKey(t)).filter(q => q.target).map(q => q.target)");
    daily.forEach((s) => assert.ok(run(`isInSeason("${s}", t)`), `${s} on ${t}`));
    const weekly = run("questsForWeek(weekKey(t)).filter(q => q.target).map(q => q.target)");
    weekly.forEach((s) => assert.ok(run(`weekDays(weekKey(t)).every(d => isInSeason("${s}", d))`), `${s} week of ${t}`));
    assert.strictEqual(run("challengesForDay(dayKey(t)).length"), 2);
    assert.strictEqual(run("questsForWeek(weekKey(t)).length"), 3);
    assert.strictEqual(run("weekKey(weekDays(weekKey(t))[0])"), run("weekKey(t)"));
  }
});

test("closed-season catches don't count toward challenges", () => {
  // A walleye on Feb 3, 2026 (closed) shouldn't count toward anything that day.
  ctx.closed = [{ id: "w", speciesId: "walleye", caughtAt: new Date(2026, 1, 3, 12).toISOString(), released: true, hasPhoto: true, lat: 44, lng: -78, lengthCm: 40 }];
  assert.strictEqual(run("dayChallenges(closed, new Date(2026, 1, 3)).some(q => q.progress > 0)"), false);
  assert.strictEqual(run("questExp(closed)"), 0);
  ctx.open = [{ ...ctx.closed[0], speciesId: "yellow-perch" }];
  assert.ok(run("dayChallenges(open, new Date(2026, 1, 3)).some(q => q.progress > 0)"));
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
