// The Map tab: waters near you that have the fish, their outlines and access points,
// plus your own catches. Depends on Leaflet (vendor/leaflet), spots.js, data.js, methods.js
// and app.js (state, $, esc, toast, speciesById, fmtDate, bestBaits).

const ONTARIO_CENTER = [45.0, -79.4];
const MAX_SPOTS = 25;
const YEARS_BACK = 5;
const ACCESS_COLORS = { launch: "#1f5fbf", pier: "#7a3fb8", shore: "#2a8f3a" };

const MapView = (() => {
  let map = null;
  let spotLayer = null;
  let catchLayer = null;
  let hereMarker = null;
  let layersById = {};

  // Every species in the game except "other". Built from data.js so the two always match.
  function mapSpecies() {
    return SPECIES.filter((s) => s.id !== "other").slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  function init() {
    const sel = $("mapSpecies");
    sel.innerHTML = mapSpecies().map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    const walleye = mapSpecies().find((s) => s.id === "walleye");
    if (walleye) sel.value = walleye.id;
    $("mapSearch").addEventListener("click", search);
    sel.addEventListener("change", () => { showTip(); drawCatches(); });
    $("mapMethod").innerHTML = `<option value="">Any method</option>` +
      METHODS.filter((m) => m.id !== "other").map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
    $("mapMethod").value = MethodPref.get() === "other" ? "" : MethodPref.get();
    $("mapMethod").addEventListener("change", showTip);

    map = L.map("map", { zoomControl: true }).setView(ONTARIO_CENTER, 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    spotLayer = L.layerGroup().addTo(map);
    catchLayer = L.layerGroup().addTo(map);
    showTip();
  }

  function show() {
    if (!map) init();
    setTimeout(() => map.invalidateSize(), 50); // the map was hidden while the tab was closed
    drawCatches();
  }

  function selected() {
    return mapSpecies().find((s) => s.id === $("mapSpecies").value) || mapSpecies()[0];
  }

  function showTip() {
    const s = selected();
    const tip = SPECIES_TIPS[s.id];
    const m = methodById($("mapMethod").value);
    const best = bestBaits(state.catches, s.id, m ? m.id : "")[0];
    const suits = m && methodSuits(m.id, s.id);
    const usual = METHODS.filter((x) => methodSuits(x.id, s.id)).map((x) => x.name);
    $("mapTip").hidden = false;
    $("mapTip").innerHTML = `<div class="badge-name">How to start with ${esc(s.name)}</div>
      ${tip ? `<div class="badge-desc">${esc(tip)}</div>` : ""}
      ${m ? `<div class="badge-desc"><b>${esc(m.name)}:</b> ${esc(m.how)} ${m.gear ? esc(m.gear) : ""}</div>
        <div class="badge-desc">${suits
          ? `Ontario's Learn to Fish guide names this method for ${esc(s.name)}.`
          : `Ontario's Learn to Fish guide doesn't name this method for ${esc(s.name)}. It may still work.${usual.length ? ` Methods it does name: ${esc(usual.join(", "))}.` : ""}`}</div>
        ${m.rule ? `<div class="badge-desc"><b>Rules and safety:</b> ${esc(m.rule)}</div>` : ""}` : ""}
      ${best ? `<div class="badge-desc"><b>Your best${m ? ` with ${esc(m.name.toLowerCase())}` : ""} so far:</b> ${esc(best.name)} (${best.n} fish)</div>` : ""}
      <div class="tip-note">General tips, not expert or official advice.${m && m.sources.length ? ` Method info: ${methodSourceLinks(m)}.` : ""}</div>`;
  }

  // Your own catches, as orange dots. Only catches of the selected fish are shown.
  // They are drawn on this phone only and never sent to the map services.
  function drawCatches() {
    if (!catchLayer) return;
    catchLayer.clearLayers();
    const s = selected();
    state.scored
      .filter((c) => c.lat != null && c.speciesId === s.id)
      .forEach((c) => {
        L.circleMarker([c.lat, c.lng], { radius: 7, color: "#b85e12", fillColor: "#e07a1f", fillOpacity: 0.9, weight: 2 })
          .bindPopup(`<b>Your ${esc(speciesById(c.speciesId).name)}</b><br>${fmtDate(c.caughtAt)}${okLength(c) ? `<br>${c.lengthCm} cm` : ""}`)
          .addTo(catchLayer);
      });
  }

  function whereAmI() {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
      );
    });
  }

  async function search() {
    const s = selected();
    const radius = Number($("mapRadius").value);
    const btn = $("mapSearch");
    btn.disabled = true;
    status("Finding you...");

    let here = await whereAmI();
    let usedCenter = false;
    if (!here) {
      const c = map.getCenter();
      here = { lat: c.lat, lng: c.lng };
      usedCenter = true;
    }

    status(`Looking for ${s.name} waters and access points...`);
    try {
      const thisYear = new Date().getFullYear();
      const { spots, failed } = await findSpots(s.name, here, radius, thisYear - YEARS_BACK, thisYear);
      const top = spots.slice(0, MAX_SPOTS);
      draw(top, here);
      const where = usedCenter ? "the middle of the map (location is off)" : "you";
      const withAccess = top.filter((w) => w.access.length).length;
      let msg = top.length
        ? `${top.length} ${top.length === 1 ? "water" : "waters"} with ${s.name} on record within ${radius} km of ${where}` +
          (spots.length > top.length ? ` (best ${top.length} of ${spots.length})` : "") +
          `. ${withAccess} ${withAccess === 1 ? "has" : "have"} a mapped boat launch or shore access.`
        : `No waters with ${s.name} on record within ${radius} km of ${where}. Try a bigger distance or another fish.`;
      if (failed.length) msg += ` Couldn't load the ${failed.join(" and ")} data this time, so some spots may be missing.`;
      status(msg);
    } catch (err) {
      status("Couldn't load Ontario's fish data. Check your connection and try again.");
    } finally {
      btn.disabled = false;
    }
  }

  function draw(waters, here) {
    spotLayer.clearLayers();
    layersById = {};
    if (hereMarker) hereMarker.remove();
    hereMarker = L.circleMarker([here.lat, here.lng], { radius: 8, color: "#fff", fillColor: "#2a7de1", fillOpacity: 1, weight: 3 })
      .bindPopup("You are here").addTo(map);

    const bounds = L.latLngBounds([[here.lat, here.lng]]);
    waters.forEach((w, i) => {
      const group = L.featureGroup().addTo(spotLayer);
      const style = { color: "#0b2c2d", weight: 2, fillColor: "#3fa79b", fillOpacity: 0.25 };
      const popup = waterPopup(w, i);
      for (const s of w.shapes) {
        if (s.kind === "poly") L.polygon(s.paths, style).bindPopup(popup).addTo(group);
        else if (s.kind === "line") s.paths.forEach((p) => L.polyline(p, { color: "#1b7f8c", weight: 4, opacity: 0.85 }).bindPopup(popup).addTo(group));
        else L.circleMarker(s.paths[0][0], { radius: 9, ...style, fillOpacity: 0.9 }).bindPopup(popup).addTo(group);
      }
      // Number label at the closest point, so you can match the map to the list.
      const label = L.marker(labelPoint(w), {
        icon: L.divIcon({ className: "spot-num", html: String(i + 1), iconSize: [22, 22] }),
        keyboard: false,
      }).bindPopup(popup).addTo(group);

      for (const p of w.access) {
        // A marker (not a circle) so it sits above the number labels and stays tappable.
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "access-dot", html: `<span style="background:${ACCESS_COLORS[p.kind]}"></span>`, iconSize: [18, 18] }),
          zIndexOffset: 1000, title: ACCESS_LABELS[p.kind],
        })
          .bindPopup(accessPopup(p, w))
          .addTo(group);
        bounds.extend([p.lat, p.lng]);
      }
      bounds.extend([w.near.lat, w.near.lng]);
      layersById[w.id] = { group, label };
    });

    if (waters.length) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    else map.setView([here.lat, here.lng], 10);

    $("spotList").innerHTML = waters.map((w, i) => `
      <li><button class="spot-row" data-id="${esc(w.id)}">
        <span class="spot-rank">${i + 1}</span>
        <span class="catch-main">
          <span class="catch-name">${esc(w.name)}</span>
          <span class="catch-meta">${esc(spotMeta(w))}</span>
        </span>
      </button></li>`).join("");
    $("spotList").querySelectorAll(".spot-row").forEach((b) => b.addEventListener("click", () => focus(b.dataset.id)));
  }

  // Where the number goes: the middle of a lake, the middle of a stream line, or the point.
  // Not on an access point, so the access point's own marker stays tappable.
  function labelPoint(w) {
    const poly = w.shapes.find((s) => s.kind === "poly");
    if (poly) return L.latLngBounds(poly.paths[0]).getCenter();
    const paths = w.shapes.flatMap((s) => s.paths).sort((a, b) => b.length - a.length);
    const p = paths[0];
    return p[Math.floor(p.length / 2)];
  }

  function spotMeta(w) {
    const bits = [`${w.km.toFixed(1)} km`];
    bits.push(w.access.length ? accessSummary(w.access) : "no mapped access");
    if (w.stocking) bits.push(`stocked ${w.stocking.lastYear}`);
    return bits.join(" · ");
  }

  function accessSummary(points) {
    const n = { launch: 0, pier: 0, shore: 0 };
    points.forEach((p) => n[p.kind]++);
    const parts = [];
    if (n.launch) parts.push(`${n.launch} boat launch${n.launch > 1 ? "es" : ""}`);
    if (n.pier) parts.push(`${n.pier} dock${n.pier > 1 ? "s" : ""}/pier${n.pier > 1 ? "s" : ""}`);
    if (n.shore) parts.push(`${n.shore} shore spot${n.shore > 1 ? "s" : ""}`);
    return parts.join(", ");
  }

  function directions(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  function waterPopup(w, i) {
    const facts = [];
    if (w.areaHa) facts.push(`${Math.round(w.areaHa).toLocaleString()} ha`);
    if (w.maxDepthM) facts.push(`up to ${Math.round(w.maxDepthM)} m deep`);
    if (w.thermal) facts.push(`${w.thermal.toLowerCase()} water`);
    const others = w.species.filter((s) => s !== selected().name && SPECIES.some((g) => g.name === s));
    const near = w.near.access
      ? `<a href="${directions(w.near.lat, w.near.lng)}" target="_blank" rel="noopener">Directions to the closest access point</a>`
      : `No boat launch or shore access is mapped here. Check that the shore is public before you go.
         <br><a href="${directions(w.near.lat, w.near.lng)}" target="_blank" rel="noopener">Directions to the nearest edge</a>`;
    return `<b>${i + 1}. ${esc(w.name)}</b>${facts.length ? `<br>${esc(facts.join(" · "))}` : ""}
      ${w.species.length ? `<br>${esc(selected().name)} recorded in Ontario fish surveys` : ""}
      ${w.stocking ? `<br>Stocked in ${esc(w.stocking.years.join(", "))}: ${Math.round(w.stocking.fish).toLocaleString()} fish (${esc(w.stocking.stages.join(", ").toLowerCase())})` : ""}
      ${others.length ? `<br>Also here: ${esc(others.join(", "))}` : ""}
      ${w.access.length ? `<br>Access: ${esc(accessSummary(w.access))}` : ""}
      <br>${near}`;
  }

  function accessPopup(p, w) {
    const facts = [];
    if (p.owner) facts.push(`${p.owner.toLowerCase()} site`);
    if (p.parking === true) facts.push("parking");
    if (p.fee === true) facts.push("may charge a fee");
    if (p.fee === false) facts.push("free");
    const src = p.source === "osm"
      ? `<a href="${p.osmUrl}" target="_blank" rel="noopener">OpenStreetMap</a>`
      : "Ontario Fishing Access Points";
    return `<b>${esc(ACCESS_LABELS[p.kind])}${p.name ? `: ${esc(p.name)}` : ""}</b>
      <br>On ${esc(w.name)}
      ${facts.length ? `<br>${esc(facts.join(" · "))}` : ""}
      ${p.notes ? `<br>${esc(p.notes)}` : ""}
      ${p.owner === "Private" ? "<br>Private: may be members or customers only." : ""}
      <br><span class="tip-note">From ${src}. Can be out of date.</span>
      <br><a href="${directions(p.lat, p.lng)}" target="_blank" rel="noopener">Directions</a>`;
  }

  function focus(id) {
    const l = layersById[id];
    if (!l) return;
    document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
    map.fitBounds(l.group.getBounds(), { padding: [24, 24], maxZoom: 14 });
    l.label.openPopup();
  }

  function status(msg) { $("mapStatus").textContent = msg; }

  return { show };
})();
