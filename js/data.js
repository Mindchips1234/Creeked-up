// Game data for Creeked Up.
//
// Species: common Ontario freshwater sport fish.
//   base       = EXP for a typical fish of this species (set by hand: rarer or harder fish score more)
//   typicalCm  = APPROXIMATE typical adult length, used only for the size bonus.
//                These are rough placeholders, not sourced figures. Check them against
//                a credible source (for example the Ontario fishing regulations summary
//                or a provincial fish ID guide) before relying on them.

const SPECIES = [
  { id: "pumpkinseed",      name: "Pumpkinseed",      base: 10,  typicalCm: 15 },
  { id: "bluegill",         name: "Bluegill",         base: 10,  typicalCm: 18 },
  { id: "rock-bass",        name: "Rock Bass",        base: 12,  typicalCm: 20 },
  { id: "yellow-perch",     name: "Yellow Perch",     base: 15,  typicalCm: 22 },
  { id: "brown-bullhead",   name: "Brown Bullhead",   base: 15,  typicalCm: 28 },
  { id: "white-sucker",     name: "White Sucker",     base: 15,  typicalCm: 40 },
  { id: "black-crappie",    name: "Black Crappie",    base: 20,  typicalCm: 25 },
  { id: "freshwater-drum",  name: "Freshwater Drum",  base: 25,  typicalCm: 40 },
  { id: "common-carp",      name: "Common Carp",      base: 35,  typicalCm: 60 },
  { id: "channel-catfish",  name: "Channel Catfish",  base: 40,  typicalCm: 55 },
  { id: "smallmouth-bass",  name: "Smallmouth Bass",  base: 40,  typicalCm: 35 },
  { id: "largemouth-bass",  name: "Largemouth Bass",  base: 40,  typicalCm: 38 },
  { id: "brook-trout",      name: "Brook Trout",      base: 45,  typicalCm: 25 },
  { id: "lake-whitefish",   name: "Lake Whitefish",   base: 45,  typicalCm: 45 },
  { id: "walleye",          name: "Walleye",          base: 50,  typicalCm: 45 },
  { id: "northern-pike",    name: "Northern Pike",    base: 50,  typicalCm: 60 },
  { id: "rainbow-trout",    name: "Rainbow Trout",    base: 55,  typicalCm: 50 },
  { id: "brown-trout",      name: "Brown Trout",      base: 55,  typicalCm: 45 },
  { id: "splake",           name: "Splake",           base: 55,  typicalCm: 40 },
  { id: "lake-trout",       name: "Lake Trout",       base: 65,  typicalCm: 60 },
  { id: "coho-salmon",      name: "Coho Salmon",      base: 70,  typicalCm: 60 },
  { id: "atlantic-salmon",  name: "Atlantic Salmon",  base: 80,  typicalCm: 60 },
  { id: "aurora-trout",     name: "Aurora Trout",     base: 90,  typicalCm: 30 },
  { id: "chinook-salmon",   name: "Chinook Salmon",   base: 85,  typicalCm: 75 },
  { id: "muskellunge",      name: "Muskellunge",      base: 120, typicalCm: 100 },
  { id: "other",            name: "Other / not sure", base: 5,   typicalCm: null },
];

// Level titles are the cosmetic reward for reaching each level.
const LEVEL_TITLES = [
  "Rookie Caster",     // 1
  "Dock Dabbler",      // 2
  "Creek Wader",       // 3
  "Shore Stalker",     // 4
  "Weedline Walker",   // 5
  "Bait Boss",         // 6
  "Lure Slinger",      // 7
  "Lake Roamer",       // 8
  "Drop-off Diver",    // 9
  "River Runner",      // 10
  "Big Water Hunter",  // 11
  "Trophy Chaser",     // 12
  "Shield Lake Legend",// 13
  "Great Lakes Guru",  // 14
  "Creeked Up Master", // 15+
];

// Badges. Each test receives the full list of catches and returns true when earned.
// Badges are worked out from the catch log every time, so nothing extra is saved.
// The list runs roughly easiest to hardest, because Home shows the first one not yet earned.
//   species = earned by catching every species listed (no test needed)
//   secret  = name and description stay hidden until the badge is earned
const countWhere = (c, f) => c.filter(f).length;

const BADGES = [
  // Getting started
  { id: "first-catch", name: "First Fish", desc: "Log your first catch.",
    test: (c) => c.length >= 1 },
  { id: "first-release", name: "Catch and Release", desc: "Release your first fish.",
    test: (c) => c.some((x) => x.released) },
  { id: "say-cheese", name: "Say Cheese", desc: "Log a catch with a photo.",
    test: (c) => c.some((x) => x.hasPhoto) },
  { id: "tape-measure", name: "Tape Measure", desc: "Log a catch with its length.",
    test: (c) => c.some((x) => x.lengthCm) },
  { id: "on-the-scale", name: "On the Scale", desc: "Log a catch with its weight.",
    test: (c) => c.some((x) => x.weightKg) },
  { id: "three-species", name: "Variety Pack", desc: "Catch 3 different species.",
    test: (c) => speciesCaught(c).size >= 3 },
  { id: "five-catches", name: "Warming Up", desc: "Log 5 catches.",
    test: (c) => c.length >= 5 },

  // Count
  { id: "ten-catches", name: "Getting Hooked", desc: "Log 10 catches.",
    test: (c) => c.length >= 10 },
  { id: "twenty-five-catches", name: "Weekend Regular", desc: "Log 25 catches.",
    test: (c) => c.length >= 25 },
  { id: "fifty-catches", name: "Regular", desc: "Log 50 catches.",
    test: (c) => c.length >= 50 },
  { id: "hundred-catches", name: "Century", desc: "Log 100 catches.",
    test: (c) => c.length >= 100 },
  { id: "two-fifty-catches", name: "Tight Lines", desc: "Log 250 catches.",
    test: (c) => c.length >= 250 },
  { id: "five-hundred-catches", name: "Lifer", desc: "Log 500 catches.",
    test: (c) => c.length >= 500 },

  // Species
  { id: "five-species", name: "Collector", desc: "Catch 5 different species.",
    test: (c) => speciesCaught(c).size >= 5 },
  { id: "ten-species", name: "Biologist", desc: "Catch 10 different species.",
    test: (c) => speciesCaught(c).size >= 10 },
  { id: "fifteen-species", name: "Field Guide", desc: "Catch 15 different species.",
    test: (c) => speciesCaught(c).size >= 15 },
  { id: "twenty-species", name: "Naturalist", desc: "Catch 20 different species.",
    test: (c) => speciesCaught(c).size >= 20 },
  { id: "all-species", name: "Gotta Catch 'Em All", secret: true, desc: "Catch every species in the app.",
    test: (c) => speciesCaught(c).size >= SPECIES.filter((s) => s.id !== "other").length },

  // Species sets
  { id: "panfish-sweep", name: "Panfish Sweep", desc: "Catch a pumpkinseed, bluegill, rock bass, yellow perch and black crappie.",
    species: ["pumpkinseed", "bluegill", "rock-bass", "yellow-perch", "black-crappie"] },
  { id: "bass-pair", name: "Bass Pair", desc: "Catch a smallmouth bass and a largemouth bass.",
    species: ["smallmouth-bass", "largemouth-bass"] },
  { id: "whiskers", name: "Whiskers", desc: "Catch a brown bullhead and a channel catfish.",
    species: ["brown-bullhead", "channel-catfish"] },
  { id: "underdogs", name: "Underdogs", desc: "Catch a common carp and a white sucker.",
    species: ["common-carp", "white-sucker"] },
  { id: "toothy-critters", name: "Toothy Critters", desc: "Catch a northern pike, walleye and muskellunge.",
    species: ["northern-pike", "walleye", "muskellunge"] },
  { id: "trout-trio", name: "Trout Trio", desc: "Catch a brook, rainbow and brown trout.",
    species: ["brook-trout", "rainbow-trout", "brown-trout"] },
  { id: "salmon-slam", name: "Salmon Slam", desc: "Catch a coho, chinook and Atlantic salmon.",
    species: ["coho-salmon", "chinook-salmon", "atlantic-salmon"] },

  // Single species
  { id: "walleye", name: "Pickerel Pro", desc: "Catch a walleye.",
    species: ["walleye"] },
  { id: "pike", name: "Water Wolf", desc: "Catch a northern pike.",
    species: ["northern-pike"] },
  { id: "whitefish", name: "Whitefish Whisperer", desc: "Catch a lake whitefish.",
    species: ["lake-whitefish"] },
  { id: "muskie", name: "Fish of 10,000 Casts", secret: true, desc: "Catch a muskellunge.",
    species: ["muskellunge"] },
  { id: "ten-of-a-kind", name: "Specialist", desc: "Catch 10 of the same species.",
    test: (c) => Object.values(tallyBy(c.filter((x) => x.speciesId !== "other"), (x) => x.speciesId)).some((n) => n >= 10) },

  // Release
  { id: "release-ten", name: "Let 'Em Grow", desc: "Release 10 fish.",
    test: (c) => countWhere(c, (x) => x.released) >= 10 },
  { id: "release-fifty", name: "Conservationist", desc: "Release 50 fish.",
    test: (c) => countWhere(c, (x) => x.released) >= 50 },
  { id: "release-hundred", name: "Steward of the Water", desc: "Release 100 fish.",
    test: (c) => countWhere(c, (x) => x.released) >= 100 },

  // Proof
  { id: "proof-ten", name: "Proof Positive", desc: "Log 10 catches with both a photo and a location.",
    test: (c) => countWhere(c, (x) => x.hasPhoto && x.lat != null) >= 10 },
  { id: "photo-fifty", name: "Photographer", desc: "Log 50 catches with a photo.",
    test: (c) => countWhere(c, (x) => x.hasPhoto) >= 50 },

  // Size
  { id: "big-one", name: "The Big One", desc: "Catch a fish 1.5x its typical length.",
    test: (c) => c.some((x) => sizeRatio(x) >= 1.5) },
  { id: "monster", name: "Monster", secret: true, desc: "Catch a fish twice its typical length.",
    test: (c) => c.some((x) => sizeRatio(x) >= 2) },
  { id: "fifty-cm", name: "Half Metre", desc: "Catch a fish 50 cm or longer.",
    test: (c) => c.some((x) => x.lengthCm >= 50) },
  { id: "metre-fish", name: "Metre Fish", secret: true, desc: "Catch a fish 100 cm or longer.",
    test: (c) => c.some((x) => x.lengthCm >= 100) },
  { id: "five-kg", name: "Heavyweight", desc: "Catch a fish 5 kg (11 lb) or heavier.",
    test: (c) => c.some((x) => x.weightKg >= 5) },
  { id: "measure-twenty-five", name: "Data Keeper", desc: "Log the length of 25 catches.",
    test: (c) => countWhere(c, (x) => x.lengthCm) >= 25 },

  // One day
  { id: "trio", name: "Triple Threat", desc: "Catch 3 species in one day.",
    test: (c) => Object.values(groupByDay(c)).some((d) => speciesCaught(d).size >= 3) },
  { id: "five-species-day", name: "Grand Slam", desc: "Catch 5 species in one day.",
    test: (c) => Object.values(groupByDay(c)).some((d) => speciesCaught(d).size >= 5) },
  { id: "five-in-a-day", name: "Good Day", desc: "Catch 5 fish in one day.",
    test: (c) => Object.values(groupByDay(c)).some((d) => d.length >= 5) },
  { id: "ten-in-a-day", name: "Hot Bite", desc: "Catch 10 fish in one day.",
    test: (c) => Object.values(groupByDay(c)).some((d) => d.length >= 10) },
  { id: "twenty-in-a-day", name: "On Fire", secret: true, desc: "Catch 20 fish in one day.",
    test: (c) => Object.values(groupByDay(c)).some((d) => d.length >= 20) },

  // Time of day
  { id: "early-bird", name: "Early Bird", desc: "Catch a fish before 7 AM.",
    test: (c) => c.some((x) => new Date(x.caughtAt).getHours() < 7) },
  { id: "night-owl", name: "Night Owl", desc: "Catch a fish after 9 PM.",
    test: (c) => c.some((x) => new Date(x.caughtAt).getHours() >= 21) },
  { id: "lunch-break", name: "Lunch Break", secret: true, desc: "Catch a fish between noon and 1 PM.",
    test: (c) => c.some((x) => new Date(x.caughtAt).getHours() === 12) },
  { id: "graveyard-shift", name: "Graveyard Shift", secret: true, desc: "Catch a fish between midnight and 4 AM.",
    test: (c) => c.some((x) => new Date(x.caughtAt).getHours() < 4) },
  { id: "round-the-clock", name: "Round the Clock", secret: true, desc: "Catch fish in the morning, afternoon, evening and night.",
    test: (c) => new Set(c.map((x) => partOfDay(new Date(x.caughtAt).getHours()))).size >= 4 },

  // Calendar
  { id: "weekend-warrior", name: "Weekend Warrior", secret: true, desc: "Catch a fish on both the Saturday and Sunday of one weekend.",
    test: (c) => {
      const days = new Set(Object.keys(groupByDay(c)));
      return [...days].some((d) => {
        const sat = new Date(d + "T12:00:00");
        if (sat.getDay() !== 6) return false;
        sat.setDate(sat.getDate() + 1);
        return days.has(localDay(sat));
      });
    } },
  { id: "streak-three", name: "Three in a Row", desc: "Catch a fish on 3 days in a row.",
    test: (c) => longestStreak(c) >= 3 },
  { id: "streak-seven", name: "Week Straight", desc: "Catch a fish on 7 days in a row.",
    test: (c) => longestStreak(c) >= 7 },
  { id: "ten-days", name: "Time on the Water", desc: "Catch fish on 10 different days.",
    test: (c) => Object.keys(groupByDay(c)).length >= 10 },
  { id: "fifty-days", name: "Dedicated", desc: "Catch fish on 50 different days.",
    test: (c) => Object.keys(groupByDay(c)).length >= 50 },
  { id: "cold-hands", name: "Cold Hands", desc: "Catch a fish in December, January or February.",
    test: (c) => c.some((x) => [11, 0, 1].includes(new Date(x.caughtAt).getMonth())) },
  { id: "four-seasons", name: "Four Seasons", desc: "Catch a fish in winter, spring, summer and fall.",
    test: (c) => new Set(c.map((x) => Math.floor(((new Date(x.caughtAt).getMonth() + 1) % 12) / 3))).size >= 4 },
  { id: "year-round", name: "Year-Rounder", secret: true, desc: "Catch a fish in all 12 months.",
    test: (c) => new Set(c.map((x) => new Date(x.caughtAt).getMonth())).size >= 12 },

  // Places (needs location turned on when logging)
  { id: "three-spots", name: "Spot Hopper", desc: "Catch fish at 3 places at least 1 km apart.",
    test: (c) => distinctSpots(c) >= 3 },
  { id: "ten-spots", name: "Explorer", desc: "Catch fish at 10 places at least 1 km apart.",
    test: (c) => distinctSpots(c) >= 10 },
  { id: "twenty-five-spots", name: "Road Tripper", desc: "Catch fish at 25 places at least 1 km apart.",
    test: (c) => distinctSpots(c) >= 25 },

  // Notes
  { id: "five-baits", name: "Tinkerer", desc: "Catch fish on 5 different baits or lures.",
    test: (c) => new Set(c.map((x) => (x.bait || "").trim().toLowerCase()).filter(Boolean)).size >= 5 },
  { id: "journal", name: "Journal Keeper", secret: true, desc: "Write notes on 10 catches.",
    test: (c) => countWhere(c, (x) => (x.notes || "").trim()) >= 10 },

  // Fishing methods (picked on the log form; ids match METHODS in methods.js)
  { id: "method-float", name: "Bobber Watcher", desc: "Catch a fish float fishing.",
    test: (c) => c.some((x) => x.method === "float") },
  { id: "method-lure", name: "Cast and Retrieve", desc: "Catch a fish on a lure.",
    test: (c) => c.some((x) => x.method === "lure") },
  { id: "method-fly", name: "Fly Guy", desc: "Catch a fish fly fishing.",
    test: (c) => c.some((x) => x.method === "fly") },
  { id: "method-ice", name: "Hard Water", desc: "Catch a fish ice fishing.",
    test: (c) => c.some((x) => x.method === "ice") },
  { id: "fly-ten", name: "Fly Fanatic", desc: "Catch 10 fish fly fishing.",
    test: (c) => countWhere(c, (x) => x.method === "fly") >= 10 },
  { id: "three-methods", name: "Versatile", desc: "Catch fish with 3 different methods.",
    test: (c) => new Set(c.map((x) => x.method).filter((m) => m && m !== "other")).size >= 3 },
  { id: "five-methods", name: "Jack of All Trades", secret: true, desc: "Catch fish with 5 different methods.",
    test: (c) => new Set(c.map((x) => x.method).filter((m) => m && m !== "other")).size >= 5 },
];

// Bonus EXP for each badge, by tier. Harder badges give more, and secret badges give 50% extra.
const BADGE_TIER_EXP = { 1: 25, 2: 50, 3: 100, 4: 250, 5: 500, 6: 1000 };
const BADGE_TIERS = {
  1: ["first-catch", "first-release", "say-cheese", "tape-measure", "on-the-scale", "three-species", "five-catches", "early-bird", "night-owl", "method-float", "method-lure"],
  2: ["ten-catches", "five-species", "bass-pair", "walleye", "pike", "trio", "five-in-a-day", "lunch-break", "cold-hands", "streak-three", "three-spots", "five-baits", "big-one", "fifty-cm", "method-fly", "method-ice", "three-methods"],
  3: ["twenty-five-catches", "fifty-catches", "ten-species", "panfish-sweep", "whiskers", "underdogs", "trout-trio", "whitefish", "ten-of-a-kind", "release-ten", "proof-ten", "five-kg", "measure-twenty-five", "five-species-day", "ten-in-a-day", "graveyard-shift", "round-the-clock", "weekend-warrior", "ten-days", "four-seasons", "ten-spots", "journal", "fly-ten", "five-methods"],
  4: ["hundred-catches", "fifteen-species", "toothy-critters", "salmon-slam", "release-fifty", "photo-fifty", "monster", "streak-seven", "twenty-in-a-day"],
  5: ["two-fifty-catches", "twenty-species", "muskie", "release-hundred", "metre-fish", "fifty-days", "year-round", "twenty-five-spots"],
  6: ["five-hundred-catches", "all-species"],
};
Object.entries(BADGE_TIERS).forEach(([tier, ids]) => ids.forEach((id) => {
  const b = BADGES.find((x) => x.id === id);
  b.exp = Math.round(BADGE_TIER_EXP[tier] * (b.secret ? 1.5 : 1));
}));

// Species badges are earned by catching every species in their list.
BADGES.forEach((b) => {
  if (b.species) b.test = (c) => b.species.every((id) => c.some((x) => x.speciesId === id));
});

function speciesCaught(catches) {
  return new Set(catches.filter((x) => x.speciesId !== "other").map((x) => x.speciesId));
}

function tallyBy(list, key) {
  const t = {};
  list.forEach((x) => { t[key(x)] = (t[key(x)] || 0) + 1; });
  return t;
}

// Calendar day in the phone's own time zone, e.g. "2026-10-24".
function localDay(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function groupByDay(catches) {
  const byDay = {};
  catches.forEach((x) => {
    const d = localDay(new Date(x.caughtAt));
    (byDay[d] = byDay[d] || []).push(x);
  });
  return byDay;
}

function partOfDay(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// Most days in a row with at least one catch.
function longestStreak(catches) {
  const days = new Set(Object.keys(groupByDay(catches)));
  let best = 0;
  days.forEach((d) => {
    const prev = new Date(d + "T12:00:00");
    prev.setDate(prev.getDate() - 1);
    if (days.has(localDay(prev))) return; // not the start of a run
    let n = 0;
    const day = new Date(d + "T12:00:00");
    while (days.has(localDay(day))) { n += 1; day.setDate(day.getDate() + 1); }
    best = Math.max(best, n);
  });
  return best;
}

// Straight-line distance in km between two catches.
function kmBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Counts places: a catch is a new place if it is at least 1 km from every place found so far.
function distinctSpots(catches) {
  const spots = [];
  catches.filter((x) => x.lat != null && x.lng != null).forEach((x) => {
    if (spots.every((s) => kmBetween(s, x) >= 1)) spots.push(x);
  });
  return spots.length;
}

function speciesById(id) {
  return SPECIES.find((s) => s.id === id) || SPECIES[SPECIES.length - 1];
}

function sizeRatio(c) {
  const sp = speciesById(c.speciesId);
  if (!sp.typicalCm || !c.lengthCm) return null;
  return c.lengthCm / sp.typicalCm;
}
