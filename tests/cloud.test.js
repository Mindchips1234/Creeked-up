// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({ module: undefined, CLOUD_CONFIG: { url: "", key: "" } });
for (const f of ["data.js", "game.js", "methods.js", "cloud.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx);
}
const run = (code) => vm.runInContext(code, ctx);

test("sync notes are never uploaded", () => {
  ctx.c = { id: "a", speciesId: "walleye", lat: 44, _synced: true, _photoUp: true };
  assert.deepStrictEqual(JSON.parse(run("JSON.stringify(cloudCatch(c))")), { id: "a", speciesId: "walleye", lat: 44 });
});

test("catches without the synced note need uploading, including ones from before accounts", () => {
  assert.strictEqual(run("needsUpload({ id: 'old' })"), true);
  assert.strictEqual(run("needsUpload({ id: 'x', _synced: true })"), false);
});

test("pulled changes: deletes win, unsent local changes are kept, the rest are saved", () => {
  assert.strictEqual(run("pulledAction({ id: 'a', _synced: true }, { id: 'a', deleted: true })"), "delete");
  assert.strictEqual(run("pulledAction(undefined, { id: 'a', deleted: true })"), "skip");
  assert.strictEqual(run("pulledAction({ id: 'a' }, { id: 'a', deleted: false, data: {} })"), "skip");
  assert.strictEqual(run("pulledAction({ id: 'a', _synced: true }, { id: 'a', deleted: false, data: {} })"), "put");
  assert.strictEqual(run("pulledAction(undefined, { id: 'a', deleted: false, data: {} })"), "put");
});

test("key order doesn't count as a change", () => {
  assert.strictEqual(run("sameData({ a: 1, b: 2 }, { b: 2, a: 1 })"), true);
  assert.strictEqual(run("sameData({ a: 1 }, { a: 2 })"), false);
});

test("a catch from the account is marked as synced", () => {
  const c = run("fromCloudRow({ id: 'a', data: { id: 'a', speciesId: 'pike', hasPhoto: true } })");
  assert.strictEqual(c._synced, true);
  assert.strictEqual(c._photoUp, true);
  assert.strictEqual(c.speciesId, "pike");
});

test("a friend's catch with a hidden location still counts as having one for EXP", () => {
  const base = "{ id: 'f', data: { speciesId: 'walleye', lengthCm: 45, caughtAt: '2026-10-24T12:00:00.000Z', hasPhoto: true, hasLocation: %s } }";
  const withLoc = run(`scoreCatches([fromFriendRow(${base.replace("%s", "true")})])[0]`);
  const noLoc = run(`scoreCatches([fromFriendRow(${base.replace("%s", "false")})])[0]`);
  assert.strictEqual(withLoc.lat, null);
  assert.strictEqual(withLoc.expParts.trust, 1);
  assert.strictEqual(noLoc.expParts.trust, 0.75);
  // Same EXP the owner sees for the same catch.
  const own = run("scoreCatches([{ id: 'f', speciesId: 'walleye', lengthCm: 45, caughtAt: '2026-10-24T12:00:00.000Z', createdAt: '2026-10-24T12:00:00.000Z', hasPhoto: true, lat: 44, lng: -79 }])[0]");
  assert.strictEqual(withLoc.exp, own.exp);
});

test("usernames: 3 to 20 letters, numbers or underscores, any case", () => {
  assert.strictEqual(run("validUsername('Bass_Boss99')"), true);
  assert.strictEqual(run("cleanUsername('  Bass_Boss99 ')"), "bass_boss99");
  assert.strictEqual(run("validUsername('ab')"), false);
  assert.strictEqual(run("validUsername('has space')"), false);
  assert.strictEqual(run("validUsername('a'.repeat(21))"), false);
  assert.strictEqual(run("validUsername('émile')"), false);
});

test("age check uses birth month and year", () => {
  ctx.now = new Date(2026, 9, 24); // Oct 24, 2026
  assert.strictEqual(run("ageFrom(2013, 10, now)"), 13);
  assert.strictEqual(run("ageFrom(2013, 11, now)"), 12);
  assert.strictEqual(run("ageFrom(2000, 1, now)"), 26);
  assert.ok(run("ageFrom(2014, 1, now) < MIN_AGE"));
});

test("summary for friends has stats and badges but no locations or notes", () => {
  ctx.list = run(`scoreCatches([
    { id: '1', speciesId: 'walleye', lengthCm: 50, caughtAt: '2026-10-20T12:00:00.000Z', createdAt: '2026-10-20T12:00:00.000Z', lat: 44.1234, lng: -79.5, notes: 'secret spot by the dock', released: true, method: 'lure', hasPhoto: true },
    { id: '2', speciesId: 'pike', lengthCm: 70, caughtAt: '2026-10-21T12:00:00.000Z', createdAt: '2026-10-21T12:00:00.000Z', released: false, method: 'lure' },
  ])`);
  const s = run("buildSummary(list, 500)");
  assert.strictEqual(s.catches, 2);
  assert.strictEqual(s.species, 2);
  assert.strictEqual(s.releasedPct, 50);
  assert.deepStrictEqual({ ...s.biggest }, { speciesId: "pike", lengthCm: 70 });
  assert.deepStrictEqual({ ...s.topMethod }, { id: "lure", n: 2 });
  assert.strictEqual(s.totalExp, 500);
  assert.ok(s.badges.includes("first-catch"));
  const json = JSON.stringify(s);
  assert.ok(!/44\.12|-79\.5|secret|dock/.test(json));
});

test("plain-language errors", () => {
  assert.match(run("friendlyAuthError({ message: 'Invalid login credentials' })"), /don't match/);
  assert.match(run("friendlyAuthError({ message: 'Database error saving new user' })"), /username/);
  assert.match(run("friendlyAuthError(new TypeError('Failed to fetch'))"), /connection/);
});

test("accounts stay off until the project is set up", () => {
  assert.strictEqual(run("Cloud.configured()"), false);
});
