// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const { distanceKm, boundingBox, stockingWhere, rankWaters } = require("../js/spots.js");

// Three real records from Ontario's stocking service (Aurora District, Walleye).
const RECORDS = [
  { Stocking_Year: 2022, Species: "Walleye", Official_Waterbody_Name: "Heart Lake", Unoffcial_Waterbody_Name: null,
    Waterbody_Location_Identifier: "17-5970-48435", Geographic_Township: "CHINGUACOUSY", Developmental_Stage: "Fingerlings",
    Number_of_Fish_Stocked: 989, Latitude: 43.74034, Longitude: -79.79533 },
  { Stocking_Year: 2023, Species: "Walleye", Official_Waterbody_Name: null, Unoffcial_Waterbody_Name: "Professor's Lake (Unofficial Name)",
    Waterbody_Location_Identifier: "17-6019-48445", Geographic_Township: "CHINGUACOUSY", Developmental_Stage: "Fingerlings",
    Number_of_Fish_Stocked: 1511, Latitude: 43.7483775, Longitude: -79.7348601 },
  { Stocking_Year: 2023, Species: "Walleye", Official_Waterbody_Name: "Bond Lake", Unoffcial_Waterbody_Name: null,
    Waterbody_Location_Identifier: "17-6245-48654", Geographic_Township: "WHITCHURCH", Developmental_Stage: "Adult",
    Number_of_Fish_Stocked: 16, Latitude: 43.9333348, Longitude: -79.4484644 },
];
const BRAMPTON = { lat: 43.7315, lng: -79.7624 };

test("distance is about right (Toronto to Ottawa is roughly 350 km)", () => {
  const km = distanceKm(43.6532, -79.3832, 45.4215, -75.6972);
  assert.ok(km > 340 && km < 360, String(km));
});

test("bounding box covers the radius", () => {
  const b = boundingBox(44, -79, 50);
  assert.ok(distanceKm(44, -79, b.maxLat, -79) >= 49.9);
  assert.ok(distanceKm(44, -79, 44, b.maxLng) >= 49.9);
});

test("where clause escapes quotes", () => {
  const w = stockingWhere("O'Brien Trout", 2021, boundingBox(44, -79, 10));
  assert.ok(w.includes("Species='O''Brien Trout'"));
  assert.ok(w.includes("Stocking_Year>=2021"));
});

test("ranks nearby, recent, well-stocked water first and cleans up names", () => {
  const ranked = rankWaters(RECORDS, BRAMPTON, 50, 2026);
  assert.strictEqual(ranked.length, 3);
  assert.strictEqual(ranked[0].name, "Professor's Lake");
  assert.strictEqual(ranked[ranked.length - 1].name, "Bond Lake");
});

test("drops water outside the radius and merges years for the same lake", () => {
  const more = RECORDS.concat([{ ...RECORDS[0], Stocking_Year: 2024, Number_of_Fish_Stocked: 11 }]);
  const ranked = rankWaters(more, BRAMPTON, 10, 2026);
  assert.strictEqual(ranked.length, 2);
  const heart = ranked.find((w) => w.name === "Heart Lake");
  assert.strictEqual(heart.fish, 1000);
  assert.strictEqual(heart.lastYear, 2024);
  assert.strictEqual(JSON.stringify(heart.years), "[2022,2024]");
});

// ---- Fish survey (ARA) data and access points ----
const {
  roundBox, araWhere, speciesList, parseAra, parseAccess, distanceToPathKm, distanceToWaterKm,
  attachAccess, mergeStocking, rankSpots, overpassQuery,
} = require("../js/spots.js");

// Attributes copied from real ARA records (Ontario LIO, layer "ARA Water Poly Segment").
// The outlines are simplified squares made up for the test, not the real shapes.
const square = (lat, lng, d) => [[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]];
const LEECH = {
  attributes: { WATERBODY_LID: "17-6498-49903", ARA_IDENT: "PS-0073-LEE", OFFICIAL_WATERBODY_NAME: "Leech Lake",
    WATERBODY_TYPE: "Lake or Pond", SURFACE_AREA: 80.0, MAXIMUM_DEPTH: 14.0, THERMAL_REGIME: "Cool",
    FISH_SPECIES_SUMMARY: "Brown Bullhead,Largemouth Bass,Pumpkinseed,Rainbow Trout,Rock Bass,Slimy Sculpin,Smallmouth Bass,White Sucker,Yellow Perch" },
  geometry: { rings: [square(44.0, -79.0, 0.01)] },
};
const GATEWAY = {
  attributes: { WATERBODY_LID: "17-6669-50313", ARA_IDENT: "AP-0035-FIN", OFFICIAL_WATERBODY_NAME: "Gateway Creek",
    WATERBODY_TYPE: "Stream or River", THERMAL_REGIME: "Cold", FISH_SPECIES_SUMMARY: "Brook Trout,Creek Chub,Pumpkinseed" },
  geometry: { paths: [[[-79.2, 44.1], [-79.1, 44.1]]] },
};

test("round box widens to 0.01 degrees so the exact spot isn't sent", () => {
  const b = roundBox({ minLat: 43.12345, maxLat: 43.98761, minLng: -79.55555, maxLng: -79.00001 });
  assert.deepStrictEqual(b, { minLat: 43.12, maxLat: 43.99, minLng: -79.56, maxLng: -79 });
});

test("ARA search clause escapes quotes and can require a name", () => {
  assert.strictEqual(araWhere("O'Fish", false), "FISH_SPECIES_SUMMARY LIKE '%O''Fish%'");
  assert.ok(araWhere("Walleye", true).endsWith("AND OFFICIAL_WATERBODY_NAME IS NOT NULL"));
  assert.deepStrictEqual(speciesList("Brook Trout, Creek Chub,"), ["Brook Trout", "Creek Chub"]);
});

test("parseAra keeps only exact species matches and merges split segments", () => {
  const half = { ...LEECH, geometry: { rings: [square(44.03, -79.0, 0.01)] } };
  const waters = parseAra([LEECH, half, GATEWAY], "Smallmouth Bass");
  assert.strictEqual(waters.length, 1);
  const w = waters[0];
  assert.strictEqual(w.name, "Leech Lake");
  assert.strictEqual(w.type, "lake");
  assert.strictEqual(w.shapes.length, 2);
  assert.strictEqual(w.areaHa, 80);
  // Coordinates are flipped to [lat, lng] for Leaflet.
  assert.deepStrictEqual(w.shapes[0].paths[0][0], [43.99, -79.01]);
  // "Bass" alone must not match "Smallmouth Bass".
  assert.strictEqual(parseAra([LEECH], "Bass").length, 0);
  // Unnamed water gets a plain label.
  const unnamed = { ...GATEWAY, attributes: { ...GATEWAY.attributes, WATERBODY_LID: null, OFFICIAL_WATERBODY_NAME: null } };
  assert.strictEqual(parseAra([unnamed], "Brook Trout")[0].name, "Unnamed stream");
});

// Real records from Ontario's Fishing Access Points layer (Marie Curtis Park, Toronto).
const LIO_ACCESS = [
  { attributes: { OBJECTID: 1, FISHING_ACCESS_POINT_TYPE: "Boat Launch", SITE_NAME: "Marie Curtis Park Boat Launch",
    PARKING_PRESENCE_FLG: "Yes", USER_FEE_FLG: "Unknown", SITE_OWNERSHIP_TYPE: "Municipal", GENERAL_COMMENTS: null },
    geometry: { x: -79.5426453, y: 43.5855391 } },
  { attributes: { OBJECTID: 2, FISHING_ACCESS_POINT_TYPE: "Enhanced Shoreline Access", SITE_NAME: "Marie Curtis Park",
    PARKING_PRESENCE_FLG: "Yes", USER_FEE_FLG: "Unknown", SITE_OWNERSHIP_TYPE: "Municipal", GENERAL_COMMENTS: null },
    geometry: { x: -79.5430495, y: 43.5831527 } },
  { attributes: { OBJECTID: 3, FISHING_ACCESS_POINT_TYPE: "Boat Launch", SITE_NAME: "Port Credit Yacht Club",
    PARKING_PRESENCE_FLG: "Unknown", USER_FEE_FLG: "Unknown", SITE_OWNERSHIP_TYPE: "Private",
    GENERAL_COMMENTS: "RECREATION_POINT.OGF_ID = 1200810486" },
    geometry: { x: -79.5504487, y: 43.5749136 } },
];

test("parseAccess labels types, drops private OSM spots and duplicates", () => {
  const osm = [
    { type: "node", id: 10, lat: 43.58556, lon: -79.54266, tags: { leisure: "slipway" } }, // same as Ontario's launch
    { type: "way", id: 11, center: { lat: 43.6, lon: -79.5 }, tags: { man_made: "pier", fishing: "yes", name: "Test Pier" } },
    { type: "node", id: 12, lat: 43.7, lon: -79.4, tags: { leisure: "slipway", access: "private" } },
  ];
  const pts = parseAccess(LIO_ACCESS, osm);
  assert.strictEqual(pts.length, 4);
  assert.deepStrictEqual(pts.map((p) => p.kind), ["launch", "pier", "launch", "pier"]);
  assert.strictEqual(pts[0].parking, true);
  assert.strictEqual(pts[0].owner, "Municipal");
  assert.strictEqual(pts[2].notes, ""); // internal IDs are hidden
  assert.strictEqual(pts[3].source, "osm");
  assert.strictEqual(pts[3].osmUrl, "https://www.openstreetmap.org/way/11");
});

test("distance to a line and to a lake", () => {
  // About 1.1 km north of a line running east-west.
  const km = distanceToPathKm({ lat: 44.01, lng: -79.15 }, [[44.0, -79.2], [44.0, -79.1]]);
  assert.ok(km > 1.05 && km < 1.17, String(km));
  const [lake] = parseAra([LEECH], "Yellow Perch");
  assert.strictEqual(distanceToWaterKm({ lat: 44.0, lng: -79.0 }, lake), 0); // inside
  const out = distanceToWaterKm({ lat: 44.0, lng: -78.985 }, lake); // ~400 m east of the edge
  assert.ok(out > 0.35 && out < 0.45, String(out));
});

test("access points attach to the closest water within 300 m", () => {
  const waters = parseAra([LEECH, GATEWAY], "Pumpkinseed");
  const pts = [
    { id: "a", lat: 44.011, lng: -79.0, kind: "launch" }, // just past the lake's north edge
    { id: "b", lat: 44.1005, lng: -79.15, kind: "shore" }, // beside the creek
    { id: "c", lat: 44.05, lng: -79.05, kind: "shore" },  // far from both
  ];
  assert.strictEqual(attachAccess(waters, pts), 2);
  assert.deepStrictEqual(waters.find((w) => w.name === "Leech Lake").access.map((p) => p.id), ["a"]);
  assert.deepStrictEqual(waters.find((w) => w.name === "Gateway Creek").access.map((p) => p.id), ["b"]);
});

test("stocking merges into the matching water by its Ontario ID", () => {
  const waters = parseAra([LEECH], "Rainbow Trout");
  const stocked = [
    { id: "17-6498-49903", name: "Leech Lake", lat: 44, lng: -79, fish: 2000, lastYear: 2025, years: [2024, 2025], stages: ["Yearlings"] },
    { id: "17-0000-00000", name: "Pond X", lat: 44.2, lng: -79.2, fish: 500, lastYear: 2023, years: [2023], stages: ["Adult"] },
  ];
  mergeStocking(waters, stocked);
  assert.strictEqual(waters.length, 2);
  assert.strictEqual(waters[0].stocking.fish, 2000);
  assert.strictEqual(waters[1].shapes[0].kind, "point");
});

test("ranking favours water you can get onto, and measures to the access point", () => {
  const here = { lat: 44.0, lng: -79.1 };
  const waters = parseAra([LEECH, GATEWAY], "Pumpkinseed");
  attachAccess(waters, [{ id: "a", lat: 44.011, lng: -79.0, kind: "launch" }]);
  const ranked = rankSpots(waters, here, 50, 2026);
  assert.strictEqual(ranked[0].name, "Leech Lake");
  assert.strictEqual(ranked[0].near.access.id, "a");
  assert.ok(Math.abs(ranked[0].km - distanceKm(44.0, -79.1, 44.011, -79.0)) < 1e-9);
  // Without access, distance is to the nearest edge point.
  assert.ok(ranked[1].km < distanceKm(44.0, -79.1, 44.1, -79.1) + 1e-9);
  assert.strictEqual(rankSpots(waters, here, 1, 2026).length, 0);
});

test("Overpass query asks for launches, fishing spots and fishing piers in the box", () => {
  const q = overpassQuery({ minLat: 43, minLng: -80, maxLat: 44, maxLng: -79 });
  assert.ok(q.includes('nwr["leisure"="slipway"](43,-80,44,-79)'));
  assert.ok(q.includes('nwr["leisure"="fishing"]'));
  assert.ok(q.includes('["man_made"="pier"]'));
  assert.ok(q.includes("out center tags"));
});
