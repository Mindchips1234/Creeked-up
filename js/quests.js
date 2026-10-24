// Challenges. Two kinds, the same for everyone, picked from the date:
//   weekly quests: 3 new ones every Monday (Monday to Sunday)
//   daily challenges: 2 new ones every day at midnight
// Finishing one adds its bonus EXP. Pure functions only.
// Depends on data.js (speciesById, sizeRatio) and seasons.js (isInSeason, challengeTargets).
//
// Season rules (Zone 17):
//   - A "catch this species" challenge only picks fish that are open in Zone 17 on that day
//     (daily) or on every day of that week (weekly), so it never asks for an out-of-season fish.
//   - A catch of a fish whose season was closed that day doesn't count toward any challenge.
//     Ontario law says you can't target a closed-season fish, even to release it.

const QUEST_TEMPLATES = [
  (r) => { const n = 3 + (r % 3); return { kind: "catches", goal: n, reward: 20 * n, text: `Catch ${n} fish` }; },
  (r) => { const n = 2 + (r % 2); return { kind: "species", goal: n, reward: 40 * n, text: `Catch ${n} different species` }; },
  (r) => { const n = 2 + (r % 2); return { kind: "release", goal: n, reward: 30 * n, text: `Release ${n} fish` }; },
  (r) => { const n = 2 + (r % 2); return { kind: "proof", goal: n, reward: 25 * n, text: `Log ${n} catches with a photo and GPS` }; },
  () => ({ kind: "early", goal: 1, reward: 60, text: "Catch a fish before 8 AM" }),
  (r, targets) => targetQuest(r, targets, 80),
  () => ({ kind: "big", goal: 1, reward: 75, text: "Catch a fish longer than typical for its species" }),
];

const DAILY_TEMPLATES = [
  (r) => { const n = 1 + (r % 2); return { kind: "catches", goal: n, reward: 15 * n, text: n === 1 ? "Catch a fish" : `Catch ${n} fish` }; },
  () => ({ kind: "species", goal: 2, reward: 35, text: "Catch 2 different species" }),
  () => ({ kind: "release", goal: 1, reward: 15, text: "Release a fish" }),
  () => ({ kind: "proof", goal: 1, reward: 20, text: "Log a catch with a photo and GPS" }),
  () => ({ kind: "early", goal: 1, reward: 30, text: "Catch a fish before 8 AM" }),
  () => ({ kind: "evening", goal: 1, reward: 30, text: "Catch a fish after 6 PM" }),
  (r, targets) => targetQuest(r, targets, 40),
];

function targetQuest(r, targets, reward) {
  if (!targets.length) return null;
  const s = targets[r % targets.length];
  return { kind: "target", target: s, goal: 1, reward, text: `Catch a ${speciesById(s).name}` };
}

// ISO week, e.g. "2026-W43", in the phone's local time.
function weekKey(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day + 3); // Thursday of this week decides the year
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThu) / 864e5 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// The 7 days (Monday to Sunday) of a week key.
function weekDays(key) {
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  const monday = new Date(y, 0, 4 - ((jan4.getDay() + 6) % 7) + 7 * (w - 1));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

// Local day, e.g. "2026-10-24".
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pick(key, templates, count, targets) {
  const picked = [];
  let h = hash(key);
  const order = templates.map((_, i) => i);
  while (picked.length < count && order.length) {
    const i = order.splice(h % order.length, 1)[0];
    const q = templates[i](h >>> 8, targets);
    if (q) picked.push({ id: `${key}-${i}`, ...q });
    h = hash(String(h));
  }
  return picked;
}

function questsForWeek(key) {
  return pick(key, QUEST_TEMPLATES, 3, challengeTargets(weekDays(key)));
}

function challengesForDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return pick(`day-${key}`, DAILY_TEMPLATES, 2, challengeTargets([new Date(y, m - 1, d)]));
}

// Catches that can count toward challenges: not a closed-season fish on the day it was caught.
function countable(catches) {
  return catches.filter((x) => isInSeason(x.speciesId, new Date(x.caughtAt)));
}

function questProgress(q, catches) {
  const c = catches;
  switch (q.kind) {
    case "catches": return c.length;
    case "species": return new Set(c.filter((x) => x.speciesId !== "other").map((x) => x.speciesId)).size;
    case "release": return c.filter((x) => x.released).length;
    case "proof": return c.filter((x) => photoCounts(x) && x.lat != null).length;
    case "early": return c.some((x) => new Date(x.caughtAt).getHours() < 8) ? 1 : 0;
    case "evening": return c.some((x) => new Date(x.caughtAt).getHours() >= 18) ? 1 : 0;
    case "target": return c.some((x) => x.speciesId === q.target) ? 1 : 0;
    case "big": return c.some((x) => (sizeRatio(x) || 0) > 1) ? 1 : 0;
    default: return 0;
  }
}

function withProgress(quests, catches) {
  return quests.map((q) => {
    const progress = Math.min(q.goal, questProgress(q, catches));
    return { ...q, progress, done: progress >= q.goal };
  });
}

// Quests for the week containing `date`, with progress from that week's catches.
function weekQuests(catches, date) {
  const key = weekKey(date);
  return withProgress(questsForWeek(key), countable(catches).filter((c) => weekKey(new Date(c.caughtAt)) === key));
}

// Daily challenges for the day of `date`, with progress from that day's catches.
function dayChallenges(catches, date) {
  const key = dayKey(date);
  return withProgress(challengesForDay(key), countable(catches).filter((c) => dayKey(new Date(c.caughtAt)) === key));
}

// Bonus EXP from every finished weekly quest and daily challenge, across every week and day
// you've logged catches in.
function questExp(catches) {
  const weeks = {};
  const days = {};
  catches.forEach((c) => {
    const d = new Date(c.caughtAt);
    weeks[weekKey(d)] = d;
    days[dayKey(d)] = d;
  });
  const sum = (list) => list.filter((q) => q.done).reduce((s, q) => s + q.reward, 0);
  return Object.values(weeks).reduce((t, d) => t + sum(weekQuests(catches, d)), 0)
    + Object.values(days).reduce((t, d) => t + sum(dayChallenges(catches, d)), 0);
}

if (typeof module !== "undefined") module.exports = { weekKey, dayKey, weekDays, questsForWeek, challengesForDay, weekQuests, dayChallenges, questExp };
