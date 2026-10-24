// EXP, levels and badges. Pure functions only, so they can be tested without a browser.
// Depends on data.js (SPECIES, LEVEL_TITLES, BADGES, speciesById, sizeRatio).

const MAX_SIZE_MULT = 4;

// How much a catch can be trusted. Catches with a photo and GPS earn full EXP.
function trustMultiplier(c) {
  const proofs = (c.hasPhoto ? 1 : 0) + (c.lat != null ? 1 : 0);
  return [0.5, 0.75, 1][proofs];
}

// Below typical length scales down (never under half), above it scales up quickly.
function sizeMultiplier(c) {
  const r = sizeRatio(c);
  if (r == null) return 1;
  if (r < 1) return Math.max(0.5, r);
  return Math.min(MAX_SIZE_MULT, 1 + (r - 1) * 2);
}

// Returns a new list of catches (oldest first) with exp and a breakdown filled in.
// EXP is always recomputed from the whole log, so edits and deletes stay consistent.
function scoreCatches(catches) {
  const sorted = [...catches].sort((a, b) =>
    a.caughtAt === b.caughtAt ? a.createdAt.localeCompare(b.createdAt) : a.caughtAt.localeCompare(b.caughtAt));
  const seen = new Set();
  return sorted.map((c) => {
    const sp = speciesById(c.speciesId);
    const first = c.speciesId !== "other" && !seen.has(c.speciesId);
    seen.add(c.speciesId);
    const parts = {
      base: sp.base,
      size: sizeMultiplier(c),
      firstSpecies: first ? 2 : 1,
      release: c.released ? 1.1 : 1,
      trust: trustMultiplier(c),
    };
    const exp = Math.round(parts.base * parts.size * parts.firstSpecies * parts.release * parts.trust);
    return { ...c, exp, expParts: parts };
  });
}

// EXP needed to go from level n to level n + 1.
function expForNextLevel(n) {
  return Math.round(100 * Math.pow(n, 1.5));
}

function levelFromExp(totalExp) {
  let level = 1;
  let floor = 0;
  while (totalExp >= floor + expForNextLevel(level)) {
    floor += expForNextLevel(level);
    level += 1;
  }
  const need = expForNextLevel(level);
  return {
    level,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1],
    intoLevel: totalExp - floor,
    need,
    progress: (totalExp - floor) / need,
  };
}

function earnedBadges(catches) {
  return BADGES.filter((b) => b.test(catches)).map((b) => b.id);
}

// Bonus EXP from every badge earned so far.
function badgeExp(catches) {
  const earned = new Set(earnedBadges(catches));
  return BADGES.filter((b) => earned.has(b.id)).reduce((sum, b) => sum + b.exp, 0);
}

if (typeof module !== "undefined") {
  module.exports = { trustMultiplier, sizeMultiplier, scoreCatches, expForNextLevel, levelFromExp, earnedBadges, badgeExp };
}
