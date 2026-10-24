// Tackle box: the gear you own, saved on this phone. Catches record which bait or lure
// you used, so the app can show what has worked best for you.

const TACKLE_KEY = "creeked-up:tackle";
const TACKLE_TYPES = ["Lure", "Bait", "Fly", "Jig", "Float", "Sinker", "Rod", "Reel", "Line"];

const Tackle = {
  all() {
    try { return JSON.parse(localStorage.getItem(TACKLE_KEY)) || []; } catch { return []; }
  },
  save(items) {
    try { localStorage.setItem(TACKLE_KEY, JSON.stringify(items)); } catch { /* storage blocked */ }
  },
  // method is optional: the fishing method this item is for (see methods.js), or "" for any.
  add(name, type, method = "") {
    const items = Tackle.all();
    if (items.some((t) => t.name.toLowerCase() === name.toLowerCase())) return items;
    items.push({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name, type, method });
    Tackle.save(items);
    return items;
  },
  remove(id) {
    Tackle.save(Tackle.all().filter((t) => t.id !== id));
  },
};

// The baits or lures you've caught the most of a species on, best first.
// Pass a method to count only catches made with that method.
function bestBaits(catches, speciesId, method) {
  const counts = {};
  catches
    .filter((c) => c.bait && (!speciesId || c.speciesId === speciesId) && (!method || c.method === method))
    .forEach((c) => {
      const k = c.bait.trim().toLowerCase();
      (counts[k] = counts[k] || { name: c.bait.trim(), n: 0 }).n += 1;
    });
  return Object.values(counts).sort((a, b) => b.n - a.n);
}

if (typeof module !== "undefined") module.exports = { bestBaits };
