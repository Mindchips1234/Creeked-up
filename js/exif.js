// Reads the date and GPS place stored inside a JPEG photo (its "EXIF" data).
// Pure function, so it can be tested without a browser.
// Many photos have none of this: screenshots, photos sent through chat apps, and
// photos where the phone removed the location for privacy. Then fields come back null.

function readExif(buffer) {
  const out = { takenAt: null, lat: null, lng: null };
  try {
    const v = new DataView(buffer);
    if (v.getUint16(0) !== 0xffd8) return out; // not a JPEG
    let p = 2;
    while (p + 4 <= v.byteLength) {
      const marker = v.getUint16(p);
      const len = v.getUint16(p + 2);
      if (marker === 0xffe1 && v.getUint32(p + 4) === 0x45786966) { // "Exif"
        readTiff(v, p + 10, out);
        break;
      }
      if (marker === 0xffda || (marker & 0xff00) !== 0xff00) break; // image data starts, no EXIF
      p += 2 + len;
    }
  } catch {
    // Damaged or unusual file: treat it as having no EXIF.
  }
  return out;
}

function readTiff(v, start, out) {
  const le = v.getUint16(start) === 0x4949; // "II" = little-endian
  const u16 = (o) => v.getUint16(start + o, le);
  const u32 = (o) => v.getUint32(start + o, le);
  const ifd = (o) => {
    const tags = {};
    const n = u16(o);
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
    }
    return tags;
  };
  // Values bigger than 4 bytes are stored elsewhere; the entry holds where.
  const SIZE = { 2: 1, 3: 2, 4: 4, 5: 8 };
  const where = (t) => (SIZE[t.type] * t.count > 4 ? u32(t.at) : t.at);
  const ascii = (t) => {
    if (!t || t.type !== 2) return null;
    let s = "";
    for (let i = 0; i < t.count; i++) {
      const ch = v.getUint8(start + where(t) + i);
      if (!ch) break;
      s += String.fromCharCode(ch);
    }
    return s;
  };
  const rationals = (t) => {
    if (!t || t.type !== 5) return null;
    const o = where(t);
    return Array.from({ length: t.count }, (_, i) => u32(o + i * 8) / u32(o + i * 8 + 4));
  };

  const ifd0 = ifd(u32(4));
  const exif = ifd0[0x8769] ? ifd(u32(ifd0[0x8769].at)) : {};
  const stamp = ascii(exif[0x9003]) || ascii(ifd0[0x0132]); // DateTimeOriginal, else DateTime
  out.takenAt = exifDate(stamp, ascii(exif[0x9011]));

  if (ifd0[0x8825]) {
    const gps = ifd(u32(ifd0[0x8825].at));
    const lat = rationals(gps[2]);
    const lng = rationals(gps[4]);
    if (lat && lng && lat.length === 3 && lng.length === 3) {
      const deg = (d) => d[0] + d[1] / 60 + d[2] / 3600;
      const la = deg(lat) * (ascii(gps[1]) === "S" ? -1 : 1);
      const ln = deg(lng) * (ascii(gps[3]) === "W" ? -1 : 1);
      if (isFinite(la) && isFinite(ln) && !(la === 0 && ln === 0)) {
        out.lat = la;
        out.lng = ln;
      }
    }
  }
}

// "2026:10:24 07:30:00" plus an optional "-04:00". Without the offset it is phone-local time.
function exifDate(stamp, offset) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(stamp || "");
  if (!m || m[1] === "0000") return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  const d = new Date(/^[+-]\d{2}:\d{2}$/.test(offset || "") ? iso + offset : iso);
  return isNaN(d) ? null : d;
}

if (typeof module !== "undefined") module.exports = { readExif, exifDate };
