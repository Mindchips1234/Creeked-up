// Game data for Creeked Up.
//
// Species: fish found in Ontario Fisheries Management Zone 17 (the user's zone).
//   Source: Ontario Ministry of Natural Resources, "Background Information to Fisheries
//   Management Plan for Fisheries Management Zone 17" (Feb 2008), Table 4 and section 3,
//   https://www.ontario.ca/files/2025-06/264336.pdf , and the FMZ 17 Fisheries Management
//   Plan (Nov 2009), https://www.ontario.ca/files/2025-06/264321.pdf . Coho, chinook and
//   Atlantic salmon are from section 3.2 and 3.4.2 (Lake Ontario tributaries in the zone).
//   These documents are older; species can come and go.
//   base       = EXP for a typical fish of this species (set by hand: rarer or harder fish score more)
//   typicalCm  = typical adult length, used only for the size bonus. It is the middle of the
//                length range on the Ontario government's page for each fish, for example
//                https://www.ontario.ca/page/walleye ("Typical length: 35.5-58.4 centimetres").
//                Each page is www.ontario.ca/page/<the fish's id>. Checked 2026-10-29.
//                Muskellunge's page gives 71-137 cm but also 28-40 in, which don't match;
//                the cm figures are used here.

const SPECIES = [
  { id: "pumpkinseed",      name: "Pumpkinseed",      base: 10,  typicalCm: 20 },
  { id: "bluegill",         name: "Bluegill",         base: 10,  typicalCm: 19 },
  { id: "rock-bass",        name: "Rock Bass",        base: 12,  typicalCm: 18 },
  { id: "yellow-perch",     name: "Yellow Perch",     base: 15,  typicalCm: 22 },
  { id: "brown-bullhead",   name: "Brown Bullhead",   base: 15,  typicalCm: 28 },
  { id: "white-sucker",     name: "White Sucker",     base: 15,  typicalCm: 40 },
  { id: "black-crappie",    name: "Black Crappie",    base: 20,  typicalCm: 22 },
  { id: "common-carp",      name: "Common Carp",      base: 35,  typicalCm: 52 },
  { id: "channel-catfish",  name: "Channel Catfish",  base: 40,  typicalCm: 44 },
  { id: "smallmouth-bass",  name: "Smallmouth Bass",  base: 40,  typicalCm: 38 },
  { id: "largemouth-bass",  name: "Largemouth Bass",  base: 40,  typicalCm: 40 },
  { id: "brook-trout",      name: "Brook Trout",      base: 45,  typicalCm: 28 },
  { id: "lake-whitefish",   name: "Lake Whitefish",   base: 45,  typicalCm: 48 },
  { id: "walleye",          name: "Walleye",          base: 50,  typicalCm: 47 },
  { id: "northern-pike",    name: "Northern Pike",    base: 50,  typicalCm: 60 },
  { id: "rainbow-trout",    name: "Rainbow Trout",    base: 55,  typicalCm: 40 },
  { id: "brown-trout",      name: "Brown Trout",      base: 55,  typicalCm: 40 },
  { id: "coho-salmon",      name: "Coho Salmon",      base: 70,  typicalCm: 52 },
  { id: "atlantic-salmon",  name: "Atlantic Salmon",  base: 80,  typicalCm: 48 },
  { id: "chinook-salmon",   name: "Chinook Salmon",   base: 85,  typicalCm: 65 },
  { id: "muskellunge",      name: "Muskellunge",      base: 120, typicalCm: 104 },
  { id: "other",            name: "Other / not sure", base: 5,   typicalCm: null },
];

// Fish the app had before it was limited to Zone 17. Kept only so catches logged before
// still show the right name and EXP. They can't be picked when logging a new catch.
//   freshwater-drum: not in the FMZ 17 species table (only mentioned in the Bay of Quinte,
//                    which is Lake Ontario, not Zone 17)
//   lake-trout:      "believed to have disappeared from Stony Lake by late 1980's", and the
//                    zone has an "absence of lakes supporting ... lake trout"
//   splake:          closed all year in Zone 17 (Variation Order SF-2025/17)
//   aurora-trout:    not mentioned in either FMZ 17 document
const OTHER_REGION_SPECIES = [
  { id: "freshwater-drum",  name: "Freshwater Drum",  base: 25,  typicalCm: 48 },
  { id: "splake",           name: "Splake",           base: 55,  typicalCm: 36 },
  { id: "lake-trout",       name: "Lake Trout",       base: 65,  typicalCm: 55 },
  { id: "aurora-trout",     name: "Aurora Trout",     base: 90,  typicalCm: 35 },
];

// Size limits. A length or weight past these is not a real fish, so the catch can't be saved
// with it. Catches that got in another way (an old log, a backup, the account) keep the number,
// but it earns no size bonus and counts for no size badge.
//   refCm, refKg = the biggest fish on record. Mostly the Ontario record from the Ontario
//                  Federation of Anglers and Hunters' Record Fish Registry, listing of
//                  Feb 13, 2026: https://www.ofah.org/wp-content/uploads/2026/02/Record.Fish_.Listings-Feb.2026.pdf
//                  (pounds and inches, converted here).
//                  * = no usable Ontario length, so both numbers are FishBase's largest
//                  published fish of the species anywhere (https://www.fishbase.se/summary/<Genus-species>.html):
//                  rock bass 43 cm and 1.4 kg, northern pike 150 cm and 28.4 kg, brown bullhead
//                  55 cm and 2.7 kg. The registry's brown bullhead row is misprinted.
//   maxCm        = refCm x 1.2, rounded. (* = FishBase's world maximum, with no margin.)
//   maxKg        = refKg x 1.5, rounded, because weight varies more than length.
//                  (Brown bullhead: FishBase's 2.7 kg, with no margin.)
// The margins are a judgement call, not from a source: room for a new record and a slightly
// off tape or scale, while still catching typos and cm/in or kg/lb mix-ups.
const MIN_CM = 2.5;   // 1 inch
const MIN_KG = 0.01;  // the app saves weight to 0.01 kg
// Length and weight together: weight is compared with the record fish scaled by length
// cubed (fish grow in all three directions). Allowed: 0.2x to 2x that, plus or minus 50 g
// for small fish and kitchen scales. Wide on purpose, so only clearly wrong pairs are caught.
const WEIGHT_FIT = { low: 0.2, high: 2, slackKg: 0.05 };
const SIZE_LIMITS = {
  "pumpkinseed":     { refCm: 27.4,  refKg: 0.62,  maxCm: 33,  maxKg: 0.9 },
  "bluegill":        { refCm: 28.2,  refKg: 0.83,  maxCm: 34,  maxKg: 1.2 },
  "rock-bass":       { refCm: 43,    refKg: 1.4,   maxCm: 43,  maxKg: 2.0 },  // * (max kg: Ontario record 1.36 x 1.5)
  "yellow-perch":    { refCm: 40.0,  refKg: 1.14,  maxCm: 48,  maxKg: 1.7 },
  "brown-bullhead":  { refCm: 55,    refKg: 2.7,   maxCm: 55,  maxKg: 2.7 },  // *
  "white-sucker":    { refCm: 61.0,  refKg: 2.65,  maxCm: 73,  maxKg: 4.0 },
  "black-crappie":   { refCm: 43.2,  refKg: 1.71,  maxCm: 52,  maxKg: 2.6 },
  "common-carp":     { refCm: 104.1, refKg: 19.0,  maxCm: 125, maxKg: 28.5 },
  "channel-catfish": { refCm: 99.8,  refKg: 15.13, maxCm: 120, maxKg: 22.7 },
  "smallmouth-bass": { refCm: 60.3,  refKg: 4.6,   maxCm: 72,  maxKg: 6.9 },
  "largemouth-bass": { refCm: 55.9,  refKg: 4.73,  maxCm: 67,  maxKg: 7.1 },
  "brook-trout":     { refCm: 80.0,  refKg: 6.58,  maxCm: 96,  maxKg: 9.9 },
  "lake-whitefish":  { refCm: 74.9,  refKg: 6.7,   maxCm: 90,  maxKg: 10.1 },
  "walleye":         { refCm: 92.7,  refKg: 10.09, maxCm: 111, maxKg: 15.1 },
  "northern-pike":   { refCm: 150,   refKg: 28.4,  maxCm: 150, maxKg: 28.7 }, // * (max kg: Ontario record 19.11 x 1.5)
  "rainbow-trout":   { refCm: 99.3,  refKg: 18.45, maxCm: 119, maxKg: 27.7 },
  "brown-trout":     { refCm: 96.5,  refKg: 15.59, maxCm: 116, maxKg: 23.4 },
  "coho-salmon":     { refCm: 101.6, refKg: 13.25, maxCm: 122, maxKg: 19.9 },
  "atlantic-salmon": { refCm: 88.9,  refKg: 11.02, maxCm: 107, maxKg: 16.5 },
  "chinook-salmon":  { refCm: 119.4, refKg: 21.04, maxCm: 143, maxKg: 31.6 },
  "muskellunge":     { refCm: 147.3, refKg: 29.48, maxCm: 177, maxKg: 44.2 },
  "freshwater-drum": { refCm: 88.9,  refKg: 10.27, maxCm: 107, maxKg: 15.4 },
  "splake":          { refCm: 88.9,  refKg: 9.39,  maxCm: 107, maxKg: 14.1 },
  "lake-trout":      { refCm: 130.8, refKg: 28.63, maxCm: 157, maxKg: 42.9 },
  "aurora-trout":    { refCm: 56.6,  refKg: 3.01,  maxCm: 68,  maxKg: 4.5 },
  // Other / not sure: Ontario's biggest freshwater fish, the lake sturgeon (FishBase, Acipenser
  // fulvescens: 274 cm, 125 kg). No length-weight check, since the fish could be anything.
  "other":           { refCm: null,  refKg: null,  maxCm: 274, maxKg: 125 },
};

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
    test: (c) => c.some((x) => okLength(x)) },
  { id: "on-the-scale", name: "On the Scale", desc: "Log a catch with its weight.",
    test: (c) => c.some((x) => okWeight(x)) },
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
    test: (c) => c.some((x) => okLength(x) >= 50) },
  { id: "metre-fish", name: "Metre Fish", secret: true, desc: "Catch a fish 100 cm or longer.",
    test: (c) => c.some((x) => okLength(x) >= 100) },
  { id: "five-kg", name: "Heavyweight", desc: "Catch a fish 5 kg (11 lb) or heavier.",
    test: (c) => c.some((x) => okWeight(x) >= 5) },
  { id: "measure-twenty-five", name: "Data Keeper", desc: "Log the length of 25 catches.",
    test: (c) => countWhere(c, (x) => okLength(x)) >= 25 },

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
  return SPECIES.find((s) => s.id === id) || OTHER_REGION_SPECIES.find((s) => s.id === id) || SPECIES[SPECIES.length - 1];
}

// True for fish found in Zone 17 (in SPECIES), not counting "other".
function isZoneSpecies(id) {
  return id !== "other" && SPECIES.some((s) => s.id === id);
}

function sizeRatio(c) {
  const sp = speciesById(c.speciesId);
  const len = okLength(c);
  if (!sp.typicalCm || !len) return null;
  return len / sp.typicalCm;
}

// What's wrong with a length and weight for this fish, or null if they look real.
// Either can be null (not measured). Returns { field: "length" | "weight", kind, ... }.
function sizeIssue(speciesId, lengthCm, weightKg) {
  const lim = SIZE_LIMITS[speciesById(speciesId).id] || SIZE_LIMITS.other;
  const hasLen = lengthCm != null;
  const hasWt = weightKg != null;
  if (hasLen && !(lengthCm >= MIN_CM)) return { field: "length", kind: "small", limit: MIN_CM };
  if (hasLen && lengthCm > lim.maxCm) return { field: "length", kind: "big", limit: lim.maxCm, refCm: lim.refCm };
  if (hasWt && !(weightKg >= MIN_KG)) return { field: "weight", kind: "small", limit: MIN_KG };
  if (hasWt && weightKg > lim.maxKg) return { field: "weight", kind: "big", limit: lim.maxKg, refKg: lim.refKg };
  if (hasLen && hasWt && lim.refCm) {
    const scaled = lim.refKg * Math.pow(lengthCm / lim.refCm, 3);
    const low = Math.max(0, scaled * WEIGHT_FIT.low - WEIGHT_FIT.slackKg);
    const high = scaled * WEIGHT_FIT.high + WEIGHT_FIT.slackKg;
    if (weightKg < low || weightKg > high) return { field: "weight", kind: "fit", low, high };
  }
  return null;
}

// The length and weight that count for EXP, badges and records: null when not measured or not real.
// A weight that doesn't fit the length is the one dropped.
function okLength(c) {
  if (!c.lengthCm) return null;
  return sizeIssue(c.speciesId, c.lengthCm, null) ? null : c.lengthCm;
}
function okWeight(c) {
  if (!c.weightKg) return null;
  return sizeIssue(c.speciesId, okLength(c), c.weightKg) ? null : c.weightKg;
}

// A plain message for a sizeIssue() result, in the units the person typed in ("cm"/"in", "kg"/"lb").
function sizeIssueText(issue, speciesId, lenUnit = "cm", wtUnit = "kg") {
  const r = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  const len = (cm) => lenUnit === "in" ? `${r(cm / 2.54, 1)} in` : `${r(cm, 1)} cm`;
  const wt = (kg) => wtUnit === "lb" ? `${r(kg / 0.45359237, 2)} lb` : `${r(kg, 2)} kg`;
  const sp = speciesById(speciesId);
  const fish = sp.id === "other" ? "fish in Ontario" : sp.name;
  if (issue.field === "length" && issue.kind === "small") {
    return `That length is too small to be a real catch. Enter at least ${len(issue.limit)}, or leave it blank.`;
  }
  if (issue.field === "length") {
    const rec = issue.refCm ? ` The biggest on record is about ${len(issue.refCm)}.` : "";
    return `That's too long for a real ${fish}.${rec} The most the app accepts is ${len(issue.limit)}. Check the number, and that you picked the right unit (cm or in).`;
  }
  if (issue.kind === "small") {
    return `That weight is too small to measure. Enter at least ${wt(issue.limit)}, or leave it blank.`;
  }
  if (issue.kind === "big") {
    const rec = issue.refKg ? ` The heaviest on record is about ${wt(issue.refKg)}.` : "";
    return `That's too heavy for a real ${fish}.${rec} The most the app accepts is ${wt(issue.limit)}. Check the number, and that you picked the right unit (kg or lb).`;
  }
  const range = issue.low < MIN_KG ? `up to ${wt(issue.high)}` : `${wt(issue.low)} to ${wt(issue.high)}`;
  return `That weight doesn't fit a ${sp.name} of that length. For that length the app accepts ${range}. Check both numbers and their units.`;
}
