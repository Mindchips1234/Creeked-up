// Open seasons for Fisheries Management Zone 17 (Kawarthas, Peterborough, Durham, Northumberland).
// Pure functions only. Depends on data.js (speciesById).
//
// Source: Ontario Sport Fishing Variation Order SF-2025/17, Schedule A (zone-wide rules),
// in effect from January 1, 2025:
//   https://www.ontario.ca/page/sport-fishing-variation-order-fisheries-management-zone-17
// matching the Zone 17 page of the Ontario Fishing Regulations Summary:
//   https://www.ontario.ca/document/ontario-fishing-regulations-summary/fisheries-management-zone-17
// Species the zone doesn't list are open all year for angling ("Unless stated otherwise,
// species that are not listed (such as rock bass) have a year-round open season for angling."):
//   https://www.ontario.ca/document/ontario-fishing-regulations-summary/general-fishing-regulations
//
// Only the zone-wide rules are here. Some lakes, rivers and fish sanctuaries in Zone 17 have
// different dates (for example walleye is closed all year in Lake Scugog, and some Lake Ontario
// tributaries are open longer for trout and salmon). The app doesn't know which lake you're on.

const ZONE = { id: 17, name: "Zone 17" };

// A date rule is either [month, day] or ["sat", month, n] for the nth Saturday of that month.
const OPENS_4TH_SAT_APR = ["sat", 4, 4];
const TROUT_SALMON = [{ from: OPENS_4TH_SAT_APR, to: [9, 30] }];

// null = open all year. [] = closed all year. Otherwise the open stretches of the year.
const ZONE17_SEASONS = {
  "brook-trout": TROUT_SALMON,
  "rainbow-trout": TROUT_SALMON,
  "brown-trout": TROUT_SALMON,
  "lake-trout": TROUT_SALMON,
  "coho-salmon": TROUT_SALMON,      // Pacific salmon
  "chinook-salmon": TROUT_SALMON,   // Pacific salmon
  "atlantic-salmon": TROUT_SALMON,  // limit is 0: catch and release only
  "splake": [],
  "channel-catfish": [{ from: OPENS_4TH_SAT_APR, to: [11, 15] }],
  "lake-whitefish": [{ from: OPENS_4TH_SAT_APR, to: [11, 15] }],
  "walleye": [{ from: ["sat", 5, 2], to: [11, 15] }],
  "smallmouth-bass": [{ from: ["sat", 6, 3], to: [12, 15] }],
  "largemouth-bass": [{ from: ["sat", 6, 3], to: [12, 15] }],
  "muskellunge": [{ from: ["sat", 6, 1], to: [12, 15] }],
};

// Fish that are never picked as a challenge target, and why.
const NOT_A_TARGET = {
  "atlantic-salmon": "Zone 17 limit is 0 (release only), and they're rare there.",
  "aurora-trout": "Not in the Zone 17 rules, so its status there couldn't be checked.",
  "other": "Not a species.",
};

function ruleDate(rule, year) {
  if (rule[0] !== "sat") return new Date(year, rule[0] - 1, rule[1]);
  const [, month, n] = rule;
  const first = new Date(year, month - 1, 1);
  const firstSat = 1 + ((6 - first.getDay() + 7) % 7);
  return new Date(year, month - 1, firstSat + 7 * (n - 1));
}

// True when angling for this species is open in Zone 17 on `date` (local time).
function isInSeason(speciesId, date) {
  const s = ZONE17_SEASONS[speciesId];
  if (s === undefined || s === null) return true;
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return s.some((r) => day >= ruleDate(r.from, day.getFullYear()) && day <= ruleDate(r.to, day.getFullYear()));
}

// The open stretch for this year, as text, e.g. "Apr 25 to Sep 30". Null when open all year.
function seasonText(speciesId, year) {
  const s = ZONE17_SEASONS[speciesId];
  if (s === undefined || s === null) return null;
  if (!s.length) return "Closed all year";
  const f = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return s.map((r) => `${f(ruleDate(r.from, year))} to ${f(ruleDate(r.to, year))}`).join(", ");
}

// Species that can be a challenge target on every one of `dates`.
function challengeTargets(dates) {
  return SPECIES.filter((sp) => !NOT_A_TARGET[sp.id] && dates.every((d) => isInSeason(sp.id, d))).map((sp) => sp.id);
}

if (typeof module !== "undefined") module.exports = { ZONE, isInSeason, seasonText, challengeTargets, ruleDate };
