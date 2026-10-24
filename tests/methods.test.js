// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({ module: undefined });
for (const f of ["data.js", "methods.js", "tackle.js", "spots.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx);
}
// JSON round trip so arrays from the script context compare equal here.
const run = (code) => JSON.parse(JSON.stringify(vm.runInContext(code, ctx)));

test("every method has a unique id, a source and real species", () => {
  const ids = run("METHODS.map(m => m.id)");
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const want of ["float", "fly", "lure", "jig", "bottom", "troll", "ice"]) assert.ok(ids.includes(want), want);
  const bad = run(`METHODS.flatMap(m => m.goodFor.filter(id => !SPECIES.some(s => s.id === id)))`);
  assert.deepStrictEqual(bad, []);
  const unsourced = run(`METHODS.filter(m => m.id !== "other" && (!m.sources.length || m.sources.some(k => !METHOD_SOURCES[k]))).map(m => m.id)`);
  assert.deepStrictEqual(unsourced, []);
});

test("method counts skip catches with no method", () => {
  ctx.cs = [{ method: "fly" }, { method: "float" }, { method: "fly" }, {}, { method: "made-up" }];
  assert.deepStrictEqual(run("methodCounts(cs)"), [{ id: "fly", n: 2 }, { id: "float", n: 1 }]);
});

test("best baits can be narrowed to one method", () => {
  ctx.cs = [
    { speciesId: "walleye", bait: "Jig and minnow", method: "jig" },
    { speciesId: "walleye", bait: "Crankbait", method: "troll" },
    { speciesId: "walleye", bait: "Crankbait", method: "troll" },
  ];
  assert.strictEqual(run('bestBaits(cs, "walleye")[0].name'), "Crankbait");
  assert.strictEqual(run('bestBaits(cs, "walleye", "jig")[0].name'), "Jig and minnow");
});
