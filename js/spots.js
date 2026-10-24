// Hotspot map data. Everything here is free, public data that the phone asks for directly.
//
// 1. Which waters have the fish: Ontario's Aquatic Resource Area (ARA) data, the same data
//    behind the province's Fish ON-Line map. Each lake, river or stream segment lists the fish
//    species that surveys have recorded there. Open Government Licence – Ontario.
//    https://data.ontario.ca/dataset/aquatic-resource-area-polygon-segment
// 2. Fish stocking: "Fish Stocking Data For Recreational Purposes", Ontario Ministry of Natural
//    Resources, Open Government Licence – Ontario. https://data.ontario.ca/dataset/fish-stocking
// 3. Where to get on the water: Ontario's Fishing Access Points (boat launches, shore access,
//    docks and piers), Open Government Licence – Ontario.
//    https://data.ontario.ca/dataset/fishing-access-points
// 4. More access points from OpenStreetMap (boat ramps, fishing spots, fishing piers), through
//    the free Overpass API. © OpenStreetMap contributors, Open Database License (ODbL).
//
// Honest limits: a species in the ARA list means surveys found it there at some point, not how
// many there are or that they're biting. Ontario's access point data was last checked in 2015,
// and OpenStreetMap is mapped by volunteers, so either can be out of date or miss spots.
// Species at risk are left out of the public ARA data on purpose.

const STOCKING_URL =
  "https://services1.arcgis.com/TJH5KDher0W13Kgo/arcgis/rest/services/FishStockingDataForRecreationalPurposes/FeatureServer/0/query";
const STOCKING_SOURCE = "https://data.ontario.ca/dataset/fish-stocking";
const LIO_URL = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open07/MapServer";
const ARA_POLY_URL = `${LIO_URL}/2/query`; // lakes, ponds and wide rivers (outlines)
const ARA_LINE_URL = `${LIO_URL}/1/query`; // rivers and streams (lines)
const ACCESS_URL = `${LIO_URL}/15/query`;  // Fishing Access Points
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const PAGE_SIZE = 1000; // the stocking service's max per request
const LIO_PAGE_SIZE = 2000; // the LIO service's max per request
const LIO_MAX_PAGES = 5; // stop after 10,000 water segments so a phone never hangs
const CACHE_DAYS = 7;
const ACCESS_MATCH_KM = 0.3; // an access point within 300 m of a water counts as access to it
const SAME_SPOT_KM = 0.05; // two access points within 50 m are treated as the same spot

// Species the province stocks, as spelled in the stocking data. Only these are looked up in
// the stocking records; every species is looked up in the ARA survey data.
const STOCKED = [
  "Walleye", "Brook Trout", "Rainbow Trout", "Brown Trout", "Lake Trout", "Splake", "Chinook Salmon",
  "Coho Salmon", "Atlantic Salmon", "Lake Whitefish", "Bluegill", "Aurora Trout",
].map((name) => ({ name }));

// Starting tips per species id (from data.js). These are general starting points from common
// angling practice, NOT from an official source. They are meant to get a beginner started.
const SPECIES_TIPS = {
  "walleye": "Low light is best: dawn, dusk and cloudy days. Try a jig and minnow or a worm harness near the bottom, or troll crankbaits along drop-offs.",
  "brook-trout": "Cold, clear water. Small spinners, worms under a light float, or small spoons. Go light on line and stay quiet; they spook easily.",
  "rainbow-trout": "Spinners, small spoons, worms or roe bags. In stocked ponds, a float with a worm or dough bait often works in spring.",
  "brown-trout": "Wary fish. Try early morning or evening with spinners, small minnow lures or worms drifted near cover.",
  "lake-trout": "Deep, cold water in summer, so trolling spoons deep works. In spring and fall they come shallower and can be cast to from shore.",
  "splake": "A brook and lake trout cross. Fish them like brook trout: small spoons, spinners or minnows, often near shore in spring and fall.",
  "chinook-salmon": "Mostly a Great Lakes boat fish trolling spoons and flasher-fly rigs. In fall they run up rivers, where spawn bags and spoons are common.",
  "coho-salmon": "Trolled spoons and small flies in the Great Lakes. In spring, try near-shore warm water; in fall, river mouths.",
  "atlantic-salmon": "Being restored in Lake Ontario streams. Check the regulations first, since many waters have special rules for this species.",
  "lake-whitefish": "Small mouths, so use small jigs or bait like wax worms near bottom. Popular through the ice in winter.",
  "bluegill": "Easy and fun. A small hook with a piece of worm under a bobber near weeds or docks. Great for kids.",
  "aurora-trout": "A rare native trout stocked in only a few lakes. Check the regulations closely before fishing for it.",
  "pumpkinseed": "Shallow weedy water near docks and lily pads. A small hook with a bit of worm under a bobber works well.",
  "rock-bass": "Rocky shorelines, docks and fallen trees. Small jigs, spinners or a worm near the bottom.",
  "yellow-perch": "They travel in schools, so once you catch one, stay put. Small jigs or a minnow or worm near the bottom by weed edges.",
  "brown-bullhead": "Soft, muddy bays, often best in the evening and at night. A worm on the bottom.",
  "white-sucker": "Often caught in spring in rivers and creeks. A worm on the bottom in current.",
  "black-crappie": "Around brush, docks and weed edges, especially in spring. Small minnows or tiny jigs under a float.",
  "freshwater-drum": "Bottom feeders in big lakes and rivers. A worm or crayfish on the bottom.",
  "common-carp": "Shallow, warm, muddy water. Corn or dough bait on the bottom, with patience and strong line.",
  "channel-catfish": "Rivers and big lakes, often at night. Worms, minnows or cut bait on the bottom.",
  "smallmouth-bass": "Rocks, drop-offs and points in clear water. Tubes, small crankbaits and drop-shot worms are common choices.",
  "largemouth-bass": "Weeds, lily pads, docks and fallen trees in warm water. Soft plastic worms, spinnerbaits or topwater lures.",
  "northern-pike": "Weed edges and shallow bays. Spoons, spinners or large minnow lures. Use a steel or heavy leader; their teeth cut line.",
  "muskellunge": "Big fish, few bites. Large lures and bucktails along weed edges and points. Use heavy gear, a leader and a big net.",
};

// Distance between two points in km (haversine).
function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Box around a point, used to ask the services only for nearby records.
function boundingBox(lat, lng, radiusKm) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

// Rounds a box outward to 0.01° (about 1 km), so the services never get your exact location
// and nearby searches can share the saved copy.
function roundBox(b) {
  const down = (v) => Math.floor(v * 100) / 100;
  const up = (v) => Math.ceil(v * 100) / 100;
  return { minLat: down(b.minLat), maxLat: up(b.maxLat), minLng: down(b.minLng), maxLng: up(b.maxLng) };
}

function stockingWhere(species, sinceYear, box) {
  const safe = species.replace(/'/g, "''");
  return `Species='${safe}' AND Stocking_Year>=${sinceYear}` +
    ` AND Latitude>=${box.minLat.toFixed(5)} AND Latitude<=${box.maxLat.toFixed(5)}` +
    ` AND Longitude>=${box.minLng.toFixed(5)} AND Longitude<=${box.maxLng.toFixed(5)}`;
}

// ARA search: any water whose species list mentions the fish. Exact matching is done after.
function araWhere(species, namedOnly) {
  const safe = species.replace(/'/g, "''");
  return `FISH_SPECIES_SUMMARY LIKE '%${safe}%'` + (namedOnly ? " AND OFFICIAL_WATERBODY_NAME IS NOT NULL" : "");
}

// The species list is comma separated, e.g. "Brook Trout,Creek Chub,Pumpkinseed".
function speciesList(summary) {
  return (summary || "").split(",").map((s) => s.trim()).filter(Boolean);
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

// Groups ARA features (lake outlines and stream lines) into one entry per water, keeping only
// waters whose species list really has this fish. Coordinates come back as [lng, lat].
function parseAra(features, species) {
  const byWater = {};
  for (const f of features) {
    const a = f.attributes || {};
    if (!speciesList(a.FISH_SPECIES_SUMMARY).includes(species)) continue;
    const g = f.geometry || {};
    const isPoly = Array.isArray(g.rings);
    const paths = (g.rings || g.paths || []).map((p) => p.map(([lng, lat]) => [lat, lng]));
    if (!paths.length) continue;
    const key = a.WATERBODY_LID || `ara:${a.ARA_IDENT || a.OGF_ID}`;
    const isLake = /lake|pond/i.test(a.WATERBODY_TYPE || "");
    const w = byWater[key] || (byWater[key] = {
      id: key,
      lid: a.WATERBODY_LID || null,
      name: a.OFFICIAL_WATERBODY_NAME || "",
      type: isLake ? "lake" : "river",
      areaHa: null, maxDepthM: null, thermal: null,
      species: new Set(),
      shapes: [],
      access: [],
      stocking: null,
    });
    if (!w.name && a.OFFICIAL_WATERBODY_NAME) w.name = a.OFFICIAL_WATERBODY_NAME;
    if (a.SURFACE_AREA != null) w.areaHa = Math.max(w.areaHa || 0, a.SURFACE_AREA);
    if (a.MAXIMUM_DEPTH != null) w.maxDepthM = Math.max(w.maxDepthM || 0, a.MAXIMUM_DEPTH);
    if (a.THERMAL_REGIME && a.THERMAL_REGIME !== "Unknown") w.thermal = a.THERMAL_REGIME;
    speciesList(a.FISH_SPECIES_SUMMARY).forEach((s) => w.species.add(s));
    w.shapes.push({ kind: isPoly ? "poly" : "line", paths });
  }
  return Object.values(byWater).map((w) => ({
    ...w,
    name: w.name || (w.type === "lake" ? "Unnamed lake" : "Unnamed stream"),
    named: !!w.name,
    species: [...w.species].filter((s) => s !== "Unidentifiable").sort(),
  }));
}

// Turns Ontario access points and OpenStreetMap features into one list, dropping duplicates
// (the Ontario point is kept when both mark the same spot).
function parseAccess(lioFeatures, osmElements) {
  const points = [];
  for (const f of lioFeatures || []) {
    const a = f.attributes || {};
    const g = f.geometry || {};
    if (g.x == null || g.y == null) continue;
    points.push({
      id: `on:${a.OBJECTID}`,
      lat: g.y, lng: g.x,
      kind: lioKind(a.FISHING_ACCESS_POINT_TYPE),
      name: a.SITE_NAME || "",
      parking: flag(a.PARKING_PRESENCE_FLG),
      fee: flag(a.USER_FEE_FLG),
      owner: a.SITE_OWNERSHIP_TYPE && a.SITE_OWNERSHIP_TYPE !== "Unknown" ? a.SITE_OWNERSHIP_TYPE : null,
      notes: a.GENERAL_COMMENTS && !/OGF_ID/.test(a.GENERAL_COMMENTS) ? a.GENERAL_COMMENTS : "",
      source: "ontario",
    });
  }
  for (const e of osmElements || []) {
    const t = e.tags || {};
    const lat = e.lat != null ? e.lat : e.center && e.center.lat;
    const lng = e.lon != null ? e.lon : e.center && e.center.lon;
    if (lat == null || lng == null) continue;
    if (["private", "no"].includes(t.access)) continue;
    if (points.some((p) => distanceKm(p.lat, p.lng, lat, lng) < SAME_SPOT_KM)) continue;
    points.push({
      id: `osm:${e.type}/${e.id}`,
      lat, lng,
      kind: t.leisure === "slipway" ? "launch" : t.man_made === "pier" ? "pier" : "shore",
      name: t.name || "",
      parking: null,
      fee: t.fee === "yes" ? true : t.fee === "no" ? false : null,
      owner: null,
      notes: "",
      source: "osm",
      osmUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    });
  }
  return points;
}

function lioKind(type) {
  if (/boat/i.test(type || "")) return "launch";
  if (/enhanced/i.test(type || "")) return "pier"; // shoreline access with a dock or pier
  return "shore";
}

function flag(v) {
  return v === "Yes" ? true : v === "No" ? false : null;
}

const ACCESS_LABELS = { launch: "Boat launch", pier: "Dock or pier", shore: "Shore access" };

// Distance in km from a point to a line (or ring) of [lat, lng] points. Uses a flat
// approximation, which is accurate to well under 1% at these short distances.
function distanceToPathKm(pt, path) {
  const kx = 111.32 * Math.cos((pt.lat * Math.PI) / 180);
  const ky = 110.57;
  const px = pt.lng * kx, py = pt.lat * ky;
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const ax = path[i][1] * kx, ay = path[i][0] * ky;
    const b = path[i + 1] || path[i];
    const bx = b[1] * kx, by = b[0] * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

function insideRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > pt.lat) !== (yj > pt.lat) && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// How far a point is from a water's edge (0 when it's on a lake).
function distanceToWaterKm(pt, water) {
  let best = Infinity;
  for (const s of water.shapes) {
    if (s.kind === "poly" && s.paths[0] && insideRing(pt, s.paths[0])) return 0;
    for (const p of s.paths) best = Math.min(best, distanceToPathKm(pt, p));
  }
  return best;
}

// Gives each access point to the closest water within ACCESS_MATCH_KM.
// Returns how many points matched a water.
function attachAccess(waters, points, maxKm = ACCESS_MATCH_KM) {
  let matched = 0;
  for (const p of points) {
    let best = null, bestKm = maxKm;
    for (const w of waters) {
      const km = distanceToWaterKm(p, w);
      if (km <= bestKm) { best = w; bestKm = km; }
    }
    if (best) { best.access.push(p); matched++; }
  }
  return matched;
}

// Adds stocking info to the matching ARA waters (they share Ontario's waterbody ID).
// A stocked water that isn't in the ARA results is added with just its stocking point.
function mergeStocking(waters, stockedWaters) {
  const byLid = {};
  waters.forEach((w) => { if (w.lid) byLid[w.lid] = w; });
  for (const s of stockedWaters) {
    const stocking = { fish: s.fish, lastYear: s.lastYear, years: s.years, stages: s.stages };
    const w = byLid[s.id];
    if (w) { w.stocking = stocking; continue; }
    waters.push({
      id: s.id, lid: s.id, name: s.name, named: s.name !== "Unnamed water", type: "water",
      areaHa: null, maxDepthM: null, thermal: null, species: [],
      shapes: [{ kind: "point", paths: [[[s.lat, s.lng]]] }],
      access: [], stocking,
    });
  }
  return waters;
}

// Closest place on a water to you: its nearest access point if it has one, otherwise the
// nearest point of its outline.
function nearestPoint(water, here) {
  if (water.access.length) {
    let best = null;
    for (const p of water.access) {
      const km = distanceKm(here.lat, here.lng, p.lat, p.lng);
      if (!best || km < best.km) best = { lat: p.lat, lng: p.lng, km, access: p };
    }
    return best;
  }
  let best = null;
  for (const s of water.shapes) for (const path of s.paths) for (const [lat, lng] of path) {
    const km = distanceKm(here.lat, here.lng, lat, lng);
    if (!best || km < best.km) best = { lat, lng, km, access: null };
  }
  return best;
}

// Ranks waters best first. Every water here has the fish on record; on top of that the score
// favours a known way onto the water, recent stocking, a real name, and being close.
function rankSpots(waters, here, radiusKm, thisYear) {
  return waters
    .map((w) => {
      const near = nearestPoint(w, here) || { lat: here.lat, lng: here.lng, km: 0, access: null };
      let evidence = w.species.length ? 1 : 0.5;
      if (w.stocking) {
        const age = Math.max(0, thisYear - w.stocking.lastYear);
        evidence += (Math.log10(1 + w.stocking.fish) / 2) * Math.pow(0.8, age);
      }
      const access = w.access.length ? 1.5 + 0.1 * Math.min(w.access.length, 5) : 0.6;
      const named = w.named ? 1 : 0.5;
      const score = (evidence * access * named) / (1 + near.km / 15);
      return { ...w, near, km: near.km, score };
    })
    .filter((w) => w.km <= radiusKm)
    .sort((a, b) => b.score - a.score);
}

// --- Fetching -------------------------------------------------------------------------------

// Gets JSON from a public ArcGIS service. If the browser blocks the request (some government
// servers don't allow other websites to read them), it tries JSONP, which ArcGIS also supports.
async function getArcgisJson(url, params) {
  const qs = new URLSearchParams({ ...params, f: "json" });
  let data;
  try {
    const res = await fetch(`${url}?${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    if (typeof document === "undefined" || navigator.onLine === false || !(err instanceof TypeError)) throw err;
    data = await jsonp(url, qs);
  }
  if (data.error) throw new Error(data.error.message || "service error");
  return data;
}

let jsonpCount = 0;
function jsonp(url, qs) {
  return new Promise((resolve, reject) => {
    const name = `__creekedUpCb${Date.now()}${jsonpCount++}`;
    const script = document.createElement("script");
    const done = () => { delete window[name]; script.remove(); clearTimeout(timer); };
    const timer = setTimeout(() => { done(); reject(new Error("timed out")); }, 30000);
    window[name] = (data) => { done(); resolve(data); };
    script.onerror = () => { done(); reject(new Error("blocked")); };
    script.src = `${url}?${qs}&callback=${name}`;
    document.head.appendChild(script);
  });
}

// Pages through an ArcGIS query until it's done or the page cap is hit.
async function arcgisFeatures(url, params, pageSize, maxPages) {
  const features = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await getArcgisJson(url, {
      ...params, resultOffset: String(page * pageSize), resultRecordCount: String(pageSize),
    });
    features.push(...(data.features || []));
    if (!data.exceededTransferLimit || !data.features || data.features.length === 0) break;
  }
  return features;
}

// Saves results on the phone for a week, so the map still works with no signal after one load.
async function cached(key, load) {
  const hit = readCache(key);
  if (hit && navigator.onLine !== false && Date.now() - hit.at < CACHE_DAYS * 864e5) return hit.data;
  try {
    const data = await load();
    writeCache(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data; // offline or service down: use the last copy
    throw err;
  }
}

function envelope(box) {
  return {
    geometry: [box.minLng, box.minLat, box.maxLng, box.maxLat].join(","),
    geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
  };
}

// Waters near you whose survey records list this fish, with simplified outlines (about 100 m).
async function fetchWaters(species, box) {
  return cached(`waters:${species}:${JSON.stringify(box)}`, async () => {
    const common = {
      ...envelope(box), outSR: "4326", returnGeometry: "true",
      maxAllowableOffset: "0.001", geometryPrecision: "5",
      outFields: "WATERBODY_LID,ARA_IDENT,OGF_ID,OFFICIAL_WATERBODY_NAME,WATERBODY_TYPE,SURFACE_AREA,MAXIMUM_DEPTH,THERMAL_REGIME,FISH_SPECIES_SUMMARY",
    };
    const [polys, lines] = await Promise.all([
      arcgisFeatures(ARA_POLY_URL, { ...common, where: araWhere(species, false) }, LIO_PAGE_SIZE, LIO_MAX_PAGES),
      // Streams: named ones only. Unnamed creeks are hard to find and very numerous.
      arcgisFeatures(ARA_LINE_URL, { ...common, where: araWhere(species, true) }, LIO_PAGE_SIZE, LIO_MAX_PAGES),
    ]);
    return parseAra(polys.concat(lines), species);
  });
}

async function fetchOntarioAccess(box) {
  return cached(`access:${JSON.stringify(box)}`, () => arcgisFeatures(ACCESS_URL, {
    ...envelope(box), outSR: "4326", returnGeometry: "true", where: "1=1",
    outFields: "OBJECTID,FISHING_ACCESS_POINT_TYPE,SITE_NAME,PARKING_PRESENCE_FLG,USER_FEE_FLG,SITE_OWNERSHIP_TYPE,GENERAL_COMMENTS",
  }, LIO_PAGE_SIZE, 2).then((fs) => fs.map((f) => ({ attributes: f.attributes, geometry: f.geometry }))));
}

function overpassQuery(box) {
  const b = `(${box.minLat},${box.minLng},${box.maxLat},${box.maxLng})`;
  return `[out:json][timeout:25];(nwr["leisure"="slipway"]${b};nwr["leisure"="fishing"]${b};` +
    `nwr["man_made"="pier"]["fishing"~"yes|designated"]${b};);out center tags;`;
}

async function fetchOsmAccess(box) {
  return cached(`osm:${JSON.stringify(box)}`, async () => {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(overpassQuery(box))}`,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.elements || []).map((e) => ({ type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags: e.tags }));
  });
}

// Stocking records near a point, a page at a time.
async function fetchStocking(species, box, sinceYear) {
  const where = stockingWhere(species, sinceYear, box);
  return cached(`stocking:${where}`, async () => {
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
    return records;
  });
}

// Everything the map needs for one search. Each source can fail on its own; the result says
// which ones did, so the map can still show what it got.
async function findSpots(species, here, radiusKm, sinceYear, thisYear) {
  const box = roundBox(boundingBox(here.lat, here.lng, radiusKm));
  const stocked = STOCKED.some((s) => s.name === species);
  const [waters, lio, osm, stocking] = await Promise.allSettled([
    fetchWaters(species, box),
    fetchOntarioAccess(box),
    fetchOsmAccess(box),
    stocked ? fetchStocking(species, box, sinceYear) : Promise.resolve([]),
  ]);
  const failed = [];
  if (waters.status === "rejected") failed.push("fish survey");
  if (lio.status === "rejected") failed.push("Ontario access point");
  if (osm.status === "rejected") failed.push("OpenStreetMap");
  if (stocking.status === "rejected") failed.push("stocking");
  if (waters.status === "rejected" && (stocking.status === "rejected" || !stocked)) {
    throw new Error("no fish data");
  }

  // Copies, so the saved results are never changed by ranking.
  const list = waters.status === "fulfilled" ? waters.value.map((w) => ({ ...w, access: [] })) : [];
  if (stocking.status === "fulfilled") mergeStocking(list, rankWaters(stocking.value, null, radiusKm, thisYear));
  const points = parseAccess(lio.status === "fulfilled" ? lio.value : [], osm.status === "fulfilled" ? osm.value : []);
  attachAccess(list, points);
  return { spots: rankSpots(list, here, radiusKm, thisYear), failed, stocked };
}

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

if (typeof module !== "undefined") {
  module.exports = {
    distanceKm, boundingBox, roundBox, stockingWhere, araWhere, speciesList, rankWaters,
    parseAra, parseAccess, distanceToPathKm, distanceToWaterKm, attachAccess, mergeStocking,
    nearestPoint, rankSpots, overpassQuery, STOCKED, SPECIES_TIPS, ACCESS_LABELS,
  };
}
