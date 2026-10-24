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
