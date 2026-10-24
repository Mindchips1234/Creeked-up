// Weekly quests. Three new quests every week (Monday to Sunday), the same for everyone,
// picked from the week number. Finishing one adds its bonus EXP. Pure functions only.
// Depends on data.js (speciesById, sizeRatio).

const QUEST_TARGETS = ["bluegill", "yellow-perch", "rock-bass", "pumpkinseed", "smallmouth-bass", "largemouth-bass", "northern-pike", "walleye"];

const QUEST_TEMPLATES = [
  (r) => { const n = 3 + (r % 3); return { kind: "catches", goal: n, reward: 20 * n, text: `Catch ${n} fish` }; },
  (r) => { const n = 2 + (r % 2); return { kind: "species", goal: n, reward: 40 * n, text: `Catch ${n} different species` }; },
  (r) => { const n = 2 + (r % 2); return { kind: "release", goal: n, reward: 30 * n, text: `Release ${n} fish` }; },
  (r) => { const n = 2 + (r % 2); return { kind: "proof", goal: n, reward: 25 * n, text: `Log ${n} catches with a photo and GPS` }; },
  () => ({ kind: "early", goal: 1, reward: 60, text: "Catch a fish before 8 AM" }),
  (r) => { const s = QUEST_TARGETS[r % QUEST_TARGETS.length]; return { kind: "target", target: s, goal: 1, reward: 80, text: `Catch a ${speciesById(s).name}` }; },
  () => ({ kind: "big", goal: 1, reward: 75, text: "Catch a fish longer than typical for its species" }),
];

// ISO week, e.g. "2026-W43", in the phone's local time.
function weekKey(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day + 3); // Thursday of this week decides the year
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThu) / 864e5 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function questsForWeek(key) {
  const picked = [];
  let h = hash(key);
  const order = QUEST_TEMPLATES.map((_, i) => i);
  while (picked.length < 3) {
    const i = order.splice(h % order.length, 1)[0];
    picked.push({ id: `${key}-${i}`, ...QUEST_TEMPLATES[i](h >>> 8) });
    h = hash(String(h));
  }
  return picked;
}

function questProgress(q, weekCatches) {
  const c = weekCatches;
  switch (q.kind) {
    case "catches": return c.length;
    case "species": return new Set(c.filter((x) => x.speciesId !== "other").map((x) => x.speciesId)).size;
    case "release": return c.filter((x) => x.released).length;
    case "proof": return c.filter((x) => x.hasPhoto && x.lat != null).length;
    case "early": return c.some((x) => new Date(x.caughtAt).getHours() < 8) ? 1 : 0;
    case "target": return c.some((x) => x.speciesId === q.target) ? 1 : 0;
    case "big": return c.some((x) => (sizeRatio(x) || 0) > 1) ? 1 : 0;
    default: return 0;
  }
}

// Quests for the week containing `date`, with progress from that week's catches.
function weekQuests(catches, date) {
  const key = weekKey(date);
  const inWeek = catches.filter((c) => weekKey(new Date(c.caughtAt)) === key);
  return questsForWeek(key).map((q) => {
    const progress = Math.min(q.goal, questProgress(q, inWeek));
    return { ...q, progress, done: progress >= q.goal };
  });
}

// Bonus EXP from every finished quest, across every week you've logged catches in.
function questExp(catches) {
  const weeks = {};
  catches.forEach((c) => { weeks[weekKey(new Date(c.caughtAt))] = c.caughtAt; });
  return Object.values(weeks).reduce((sum, iso) =>
    sum + weekQuests(catches, new Date(iso)).filter((q) => q.done).reduce((s, q) => s + q.reward, 0), 0);
}

if (typeof module !== "undefined") module.exports = { weekKey, questsForWeek, weekQuests, questExp };
