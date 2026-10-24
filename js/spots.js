// Hotspot map data: Ontario's public fish stocking records.
//
// Source: "Fish Stocking Data For Recreational Purposes", Ontario Ministry of Natural Resources,
// Open Government Licence – Ontario. https://data.ontario.ca/dataset/fish-stocking
// The app asks this public ArcGIS service directly from the phone's browser.
//
// Honest limits: stocking only tells you fish were PUT in a lake, not that they're biting or
// still there. Only 12 species are in this data; bass, pike, perch, muskie and most panfish
// aren't stocked by the province, so the map can't suggest spots for them yet.

const STOCKING_URL =
  "https://services1.arcgis.com/TJH5KDher0W13Kgo/arcgis/rest/services/FishStockingDataForRecreationalPurposes/FeatureServer/0/query";
const STOCKING_SOURCE = "https://data.ontario.ca/dataset/fish-stocking";
const PAGE_SIZE = 1000; // the service's max per request
const CACHE_DAYS = 7;

// Stocked species, as spelled in the data, with the matching species id in data.js.
// Tips are general starting points from common angling practice, NOT from an official
// source. They are meant to get a beginner started, not as expert advice.
const STOCKED = [
  { name: "Walleye", id: "walleye",
    tip: "Low light is best: dawn, dusk and cloudy days. Try a jig and minnow or a worm harness near the bottom, or troll crankbaits along drop-offs." },
  { name: "Brook Trout", id: "brook-trout",
    tip: "Cold, clear water. Small spinners, worms under a light float, or small spoons. Go light on line and stay quiet; they spook easily." },
  { name: "Rainbow Trout", id: "rainbow-trout",
    tip: "Spinners, small spoons, worms or roe bags. In stocked ponds, a float with a worm or dough bait often works in spring." },
  { name: "Brown Trout", id: "brown-trout",
    tip: "Wary fish. Try early morning or evening with spinners, small minnow lures or worms drifted near cover." },
  { name: "Lake Trout", id: "lake-trout",
    tip: "Deep, cold water in summer, so trolling spoons deep works. In spring and fall they come shallower and can be cast to from shore." },
  { name: "Splake", id: "splake",
    tip: "A brook and lake trout cross. Fish them like brook trout: small spoons, spinners or minnows, often near shore in spring and fall." },
  { name: "Chinook Salmon", id: "chinook-salmon",
    tip: "Mostly a Great Lakes boat fish trolling spoons and flasher-fly rigs. In fall they run up rivers, where spawn bags and spoons are common." },
  { name: "Coho Salmon", id: "coho-salmon",
    tip: "Trolled spoons and small flies in the Great Lakes. In spring, try near-shore warm water; in fall, river mouths." },
  { name: "Atlantic Salmon", id: "atlantic-salmon",
    tip: "Being restored in Lake Ontario streams. Check the regulations first, since many waters have special rules for this species." },
  { name: "Lake Whitefish", id: "lake-whitefish",
    tip: "Small mouths, so use small jigs or bait like wax worms near bottom. Popular through the ice in winter." },
  { name: "Bluegill", id: "bluegill",
    tip: "Easy and fun. A small hook with a piece of worm under a bobber near weeds or docks. Great for kids." },
  { name: "Aurora Trout", id: "aurora-trout",
    tip: "A rare native trout stocked in only a few lakes. Check the regulations closely before fishing for it." },
];

// Distance between two points in km (haversine).
function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Box around a point, used to ask the service only for nearby records.
function boundingBox(lat, lng, radiusKm) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

function stockingWhere(species, sinceYear, box) {
  const safe = species.replace(/'/g, "''");
  return `Species='${safe}' AND Stocking_Year>=${sinceYear}` +
    ` AND Latitude>=${box.minLat.toFixed(5)} AND Latitude<=${box.maxLat.toFixed(5)}` +
    ` AND Longitude>=${box.minLng.toFixed(5)} AND Longitude<=${box.maxLng.toFixed(5)}`;
}

// Turns raw stocking records into one entry per lake or river, ranked best first.
// Score favours more fish, more recent stocking and closer water.
function rankWaters(records, here, radiusKm, thisYear) {
  const byWater = {};
  for (const r of records) {
    if (r.Latitude == null || r.Longitude == null) continue;
    const key = r.Waterbody_Location_Identifier || `${r.Latitude},${r.Longitude}`;
    const w = byWater[key] || (byWater[key] = {
      id: key,
      name: r.Official_Waterbody_Name || (r.Unoffcial_Waterbody_Name || "Unnamed water").replace(/\s*\(Unofficial Name\)\s*/i, ""),
      township: r.Geographic_Township || "",
      lat: r.Latitude, lng: r.Longitude,
      fish: 0, lastYear: 0, years: new Set(), stages: new Set(),
    });
    w.fish += r.Number_of_Fish_Stocked || 0;
    w.lastYear = Math.max(w.lastYear, r.Stocking_Year || 0);
    if (r.Stocking_Year) w.years.add(r.Stocking_Year);
    if (r.Developmental_Stage) w.stages.add(r.Developmental_Stage);
  }
  return Object.values(byWater)
    .map((w) => {
      const km = here ? distanceKm(here.lat, here.lng, w.lat, w.lng) : 0;
      const age = Math.max(0, thisYear - w.lastYear);
      const score = Math.log10(1 + w.fish) * Math.pow(0.8, age) / (1 + km / 25);
      return { ...w, km, score, years: [...w.years].sort(), stages: [...w.stages] };
    })
    .filter((w) => !here || w.km <= radiusKm)
    .sort((a, b) => b.score - a.score);
}

// Fetches stocking records near a point, a page at a time. Results are cached on the phone
// for a week so the map still works with no signal after one load.
async function fetchStocking(species, here, radiusKm, sinceYear) {
  const box = boundingBox(here.lat, here.lng, radiusKm);
  const where = stockingWhere(species, sinceYear, box);
  const cacheKey = `stocking:${where}`;
  const cached = readCache(cacheKey);
  if (cached && navigator.onLine !== false && Date.now() - cached.at < CACHE_DAYS * 864e5) return cached.records;

  try {
    const records = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const params = new URLSearchParams({
        where, outFields: "*", returnGeometry: "false", f: "json",
        resultOffset: String(offset), resultRecordCount: String(PAGE_SIZE),
      });
      const res = await fetch(`${STOCKING_URL}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "service error");
      records.push(...(data.features || []).map((f) => f.attributes));
      if (!data.exceededTransferLimit || !data.features || data.features.length === 0) break;
    }
    writeCache(cacheKey, { at: Date.now(), records });
    return records;
  } catch (err) {
    if (cached) return cached.records; // offline or service down: use the last copy
    throw err;
  }
}

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

if (typeof module !== "undefined") {
  module.exports = { distanceKm, boundingBox, stockingWhere, rankWaters, STOCKED };
}
