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
const BADGES = [
  { id: "first-catch", name: "First Fish", desc: "Log your first catch.",
    test: (c) => c.length >= 1 },
  { id: "ten-catches", name: "Getting Hooked", desc: "Log 10 catches.",
    test: (c) => c.length >= 10 },
  { id: "fifty-catches", name: "Regular", desc: "Log 50 catches.",
    test: (c) => c.length >= 50 },
  { id: "five-species", name: "Collector", desc: "Catch 5 different species.",
    test: (c) => speciesCaught(c).size >= 5 },
  { id: "ten-species", name: "Biologist", desc: "Catch 10 different species.",
    test: (c) => speciesCaught(c).size >= 10 },
  { id: "release-ten", name: "Let 'Em Grow", desc: "Release 10 fish.",
    test: (c) => c.filter((x) => x.released).length >= 10 },
  { id: "trio", name: "Triple Threat", desc: "Catch 3 species in one day.",
    test: (c) => {
      const byDay = {};
      c.forEach((x) => {
        const d = x.caughtAt.slice(0, 10);
        (byDay[d] = byDay[d] || new Set()).add(x.speciesId);
      });
      return Object.values(byDay).some((s) => s.size >= 3);
    } },
  { id: "early-bird", name: "Early Bird", desc: "Catch a fish before 7 AM.",
    test: (c) => c.some((x) => new Date(x.caughtAt).getHours() < 7) },
  { id: "night-owl", name: "Night Owl", desc: "Catch a fish after 9 PM.",
    test: (c) => c.some((x) => new Date(x.caughtAt).getHours() >= 21) },
  { id: "big-one", name: "The Big One", desc: "Catch a fish 1.5x its typical length.",
    test: (c) => c.some((x) => sizeRatio(x) >= 1.5) },
  { id: "muskie", name: "Fish of 10,000 Casts", desc: "Catch a muskellunge.",
    test: (c) => c.some((x) => x.speciesId === "muskellunge") },
];

function speciesCaught(catches) {
  return new Set(catches.filter((x) => x.speciesId !== "other").map((x) => x.speciesId));
}

function speciesById(id) {
  return SPECIES.find((s) => s.id === id) || SPECIES[SPECIES.length - 1];
}

function sizeRatio(c) {
  const sp = speciesById(c.speciesId);
  if (!sp.typicalCm || !c.lengthCm) return null;
  return c.lengthCm / sp.typicalCm;
}
