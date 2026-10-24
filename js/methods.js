// Fishing methods: how a fish was caught (float, fly, lure and so on).
// Catches, tackle box items and map tips can each be tagged with a method.
//
// Sources for the "how" and "goodFor" text:
//   LEARN = Ontario government, "Learn to fish online" (Ministry of Natural Resources).
//   RULES = Ontario government, "Rules on using fishing tackle".
//   ICE   = Canadian Red Cross, "Safety tips on and around ice".
// goodFor only lists a species when the Ontario guide names that method, or the bait or
// lures the method uses, for it. A species missing from a list doesn't mean the method
// won't work, only that the guide doesn't say so.

const METHOD_SOURCES = {
  LEARN: { name: "Ontario: Learn to fish", url: "https://www.ontario.ca/page/learn-fish-online" },
  RULES: { name: "Ontario: Rules on using fishing tackle", url: "https://www.ontario.ca/page/rules-using-fishing-tackle" },
  ICE: { name: "Canadian Red Cross: Safety on ice", url: "https://cdn.redcross.ca/prodmedia/crc/documents/Where-We-Work/Canada/Manitoba/safety-tips-on-and-around-ice-2014.pdf" },
};

const METHODS = [
  { id: "float", name: "Float", short: "Bait under a bobber",
    how: "A float (bobber) holds your bait at a set depth and dips when a fish bites. Move the float up or down the line until you find the depth the fish are at.",
    gear: "Light rod, small hook, a float and a small sinker. Worms or small minnows.",
    goodFor: ["pumpkinseed", "bluegill", "rock-bass", "black-crappie", "yellow-perch"],
    sources: ["LEARN"] },
  { id: "lure", name: "Lure", short: "Cast and reel spoons, spinners, plugs",
    how: "Cast a lure out and reel it back so it moves like prey. Spoons and spinners are heavy enough to cast far and sink deeper. Plugs include crankbaits (dive deep), jerkbaits (dive shallow) and poppers (stay on top).",
    gear: "Spinning rod and reel. A snap swivel stops spoons and spinners from twisting your line.",
    goodFor: ["smallmouth-bass", "largemouth-bass", "northern-pike", "walleye", "yellow-perch", "rock-bass", "channel-catfish", "rainbow-trout"],
    sources: ["LEARN"] },
  { id: "jig", name: "Jigging", short: "Bounce a weighted jig",
    how: "A jig is a single hook with a weighted head. It doesn't move on its own, so you hop it with your rod tip. Work it near the bottom, and try adding a piece of worm.",
    gear: "Spinning rod, jigs with soft plastics, or a jig tipped with a worm or minnow.",
    goodFor: ["walleye", "yellow-perch", "rock-bass"],
    sources: ["LEARN"] },
  { id: "bottom", name: "Bottom", short: "Bait resting on the bottom",
    how: "Let your bait sit right on the bottom and wait for a bite. It's the classic way to catch fish that feed along the bottom.",
    gear: "A sinker heavy enough to hold your bait down. Worms work for most bottom fish; carp also take corn or dough balls.",
    goodFor: ["brown-bullhead", "channel-catfish", "common-carp"],
    sources: ["LEARN"] },
  { id: "fly", name: "Fly fishing", short: "Cast a light fly with a heavy line",
    how: "Flies weigh almost nothing, so the heavy fly line carries the cast. It's most used in rivers for trout and salmon, and it takes a lot of practice.",
    gear: "Fly rod, fly reel, fly line and flies.",
    rule: "A few rivers allow only artificial flies: parts of the East Goulais and Garden rivers (Zone 10) and the Arrow River (Zone 6).",
    goodFor: ["brook-trout", "rainbow-trout"],
    sources: ["LEARN", "RULES"] },
  { id: "troll", name: "Trolling", short: "Pull lures behind a moving boat",
    how: "Pull a lure slowly behind a moving boat to cover lots of water. Deep fish like lake trout and salmon need special gear to get the lure down to them.",
    gear: "A boat, a sturdy rod, and spoons, plugs or spinners.",
    rule: "In open water you may use only 1 line. On the Great Lakes you can use 2 lines from a boat, with some exceptions.",
    goodFor: ["northern-pike", "chinook-salmon", "coho-salmon"], // lake trout left out: not found in Zone 17
    sources: ["LEARN", "RULES"] },
  { id: "ice", name: "Ice fishing", short: "Fish through a hole in the ice",
    how: "Fish through a hole in the ice, usually by jigging or with a tip-up. Check the ice before you walk on it: blue ice is strongest and grey ice is unsafe.",
    gear: "Ice auger, short ice rod or tip-up, small jigs and bait, warm clothes, and ice picks for safety.",
    rule: "In most waters you can use 2 lines through the ice if you stay within 60 m of them and can always see them. The Red Cross says ice should be at least 15 cm thick for walking in small groups.",
    goodFor: [],
    sources: ["RULES", "ICE"] },
  { id: "other", name: "Other", short: "Something else",
    how: "Any other way of fishing.", gear: "", goodFor: [], sources: [] },
];

const METHOD_PREF_KEY = "creeked-up:method";

function methodById(id) {
  return METHODS.find((m) => m.id === id) || null;
}

// Your most-used method, remembered so the log form starts on it.
const MethodPref = {
  get() {
    try { return methodById(localStorage.getItem(METHOD_PREF_KEY)) ? localStorage.getItem(METHOD_PREF_KEY) : ""; } catch { return ""; }
  },
  set(id) {
    try { localStorage.setItem(METHOD_PREF_KEY, id); } catch { /* storage blocked */ }
  },
};

// How many catches each method has, most first. Catches with no method are skipped.
function methodCounts(catches) {
  const counts = {};
  catches.filter((c) => methodById(c.method)).forEach((c) => { counts[c.method] = (counts[c.method] || 0) + 1; });
  return Object.entries(counts).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
}

// Whether the Ontario guide names this method for this species.
function methodSuits(methodId, speciesId) {
  const m = methodById(methodId);
  return !!m && m.goodFor.includes(speciesId);
}

if (typeof module !== "undefined") module.exports = { METHODS, methodById, methodCounts, methodSuits };
