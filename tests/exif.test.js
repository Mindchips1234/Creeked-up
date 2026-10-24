// Run with: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({});
for (const f of ["data.js", "game.js", "exif.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), ctx);
}

// Builds a tiny JPEG header with an EXIF block, the way a phone camera writes one.
function fakeJpeg({ date, offset, gps, littleEndian = false }) {
  const tiff = new DataView(new ArrayBuffer(400));
  const le = littleEndian;
  let free = 200; // where long values go
  const putIfd = (at, entries) => {
    tiff.setUint16(at, entries.length, le);
    entries.forEach(([tag, type, count, value], i) => {
      const e = at + 2 + i * 12;
      tiff.setUint16(e, tag, le); tiff.setUint16(e + 2, type, le); tiff.setUint32(e + 4, count, le);
      if (typeof value === "number") tiff.setUint32(e + 8, value, le);
      else if (type === 2 && value.length <= 4) [...value].forEach((ch, j) => tiff.setUint8(e + 8 + j, ch.charCodeAt(0)));
      else {
        tiff.setUint32(e + 8, free, le);
        if (type === 2) { [...value].forEach((ch, j) => tiff.setUint8(free + j, ch.charCodeAt(0))); free += value.length; }
        else { value.forEach(([n, d], j) => { tiff.setUint32(free + j * 8, n, le); tiff.setUint32(free + j * 8 + 4, d, le); }); free += value.length * 8; }
      }
    });
  };
  tiff.setUint16(0, le ? 0x4949 : 0x4d4d); tiff.setUint16(2, 42, le); tiff.setUint32(4, 8, le);
  const ifd0 = [[0x8769, 4, 1, 60]];
  if (gps) ifd0.push([0x8825, 4, 1, 120]);
  putIfd(8, ifd0);
  const exif = [[0x9003, 2, 20, date + "\0"]];
  if (offset) exif.push([0x9011, 2, 7, offset + "\0"]);
  putIfd(60, exif);
  if (gps) putIfd(120, [
    [1, 2, 2, gps.latRef + "\0"], [2, 5, 3, gps.lat],
    [3, 2, 2, gps.lngRef + "\0"], [4, 5, 3, gps.lng],
  ]);
  const body = new Uint8Array(tiff.buffer);
  const app1Len = 2 + 6 + body.length;
  const out = new Uint8Array(4 + app1Len + 2);
  out.set([0xff, 0xd8, 0xff, 0xe1, app1Len >> 8, app1Len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  out.set(body, 12);
  out.set([0xff, 0xda], 4 + app1Len);
  return out.buffer;
}

const run = (buf) => { ctx.buf = buf; return vm.runInContext("readExif(buf)", ctx); };

test("reads date and GPS from a photo", () => {
  const r = run(fakeJpeg({
    date: "2026:10:24 07:30:15", offset: "-04:00",
    gps: { latRef: "N", lat: [[44, 1], [30, 1], [3600, 100]], lngRef: "W", lng: [[79, 1], [15, 1], [0, 1]] },
  }));
  assert.strictEqual(r.takenAt.toISOString(), "2026-10-24T11:30:15.000Z");
  assert.ok(Math.abs(r.lat - 44.51) < 1e-9);
  assert.ok(Math.abs(r.lng - -79.25) < 1e-9);
});

test("little-endian photos (most Android phones) read the same", () => {
  const r = run(fakeJpeg({ date: "2026:10:24 07:30:15", offset: "+00:00", littleEndian: true }));
  assert.strictEqual(r.takenAt.toISOString(), "2026-10-24T07:30:15.000Z");
  assert.strictEqual(r.lat, null);
});

test("no EXIF, or not a JPEG, gives empty results instead of crashing", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).buffer;
  assert.deepStrictEqual({ ...run(png) }, { takenAt: null, lat: null, lng: null });
  const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer;
  assert.strictEqual(run(bare).takenAt, null);
  const cut = fakeJpeg({ date: "2026:10:24 07:30:15" }).slice(0, 40);
  assert.strictEqual(run(cut).takenAt, null);
});

test("a gallery photo whose date doesn't fit the catch earns no photo proof", () => {
  const base = { hasPhoto: true, lat: 44 };
  ctx.c = { ...base };
  assert.strictEqual(vm.runInContext("trustMultiplier(c)", ctx), 1); // older catches with no flag still count
  ctx.c = { ...base, photoProof: false };
  assert.strictEqual(vm.runInContext("trustMultiplier(c)", ctx), 0.75);
  ctx.c = { ...base, photoProof: true };
  assert.strictEqual(vm.runInContext("trustMultiplier(c)", ctx), 1);
});
