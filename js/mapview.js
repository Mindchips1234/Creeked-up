// The Map tab: suggested spots from stocking records, plus your own catches.
// Depends on Leaflet (vendor/leaflet), spots.js and app.js (state, $, esc, toast, speciesById).

const ONTARIO_CENTER = [45.0, -79.4];
const MAX_SPOTS = 25;
const YEARS_BACK = 5;

const MapView = (() => {
  let map = null;
  let spotLayer = null;
  let catchLayer = null;
  let hereMarker = null;
  let markersById = {};

  function init() {
    const sel = $("mapSpecies");
    sel.innerHTML = STOCKED.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("");
    $("mapSearch").addEventListener("click", search);
    sel.addEventListener("change", () => { showTip(); drawCatches(); });

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
    return STOCKED.find((s) => s.name === $("mapSpecies").value) || STOCKED[0];
  }

  function showTip() {
    const s = selected();
    $("mapTip").hidden = false;
    $("mapTip").innerHTML = `<div class="badge-name">How to start with ${esc(s.name)}</div>
      <div class="badge-desc">${esc(s.tip)}</div>
      ${(() => {
        const best = bestBaits(state.catches, s.id)[0];
        return best ? `<div class="badge-desc"><b>Your best so far:</b> ${esc(best.name)} (${best.n} fish)</div>` : "";
      })()}
      <div class="tip-note">General tips, not expert or official advice.</div>`;
  }

  // Your own catches, as orange dots. Only catches of the selected fish are shown.
  function drawCatches() {
    if (!catchLayer) return;
    catchLayer.clearLayers();
    const s = selected();
    state.scored
      .filter((c) => c.lat != null && c.speciesId === s.id)
      .forEach((c) => {
        L.circleMarker([c.lat, c.lng], { radius: 7, color: "#b85e12", fillColor: "#e07a1f", fillOpacity: 0.9, weight: 2 })
          .bindPopup(`<b>Your ${esc(speciesById(c.speciesId).name)}</b><br>${fmtDate(c.caughtAt)}${c.lengthCm ? `<br>${c.lengthCm} cm` : ""}`)
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

    status(`Looking for stocked ${s.name}...`);
    try {
      const thisYear = new Date().getFullYear();
      const records = await fetchStocking(s.name, here, radius, thisYear - YEARS_BACK);
      const waters = rankWaters(records, here, radius, thisYear).slice(0, MAX_SPOTS);
      draw(waters, here);
      const where = usedCenter ? "the middle of the map (location is off)" : "you";
      status(waters.length
        ? `${waters.length} ${waters.length === 1 ? "spot" : "spots"} within ${radius} km of ${where}, stocked with ${s.name} since ${thisYear - YEARS_BACK}.`
        : `No ${s.name} stocked within ${radius} km of ${where} since ${thisYear - YEARS_BACK}. Try a bigger distance or another fish.`);
    } catch (err) {
      status("Couldn't load Ontario's stocking data. Check your connection and try again.");
    } finally {
      btn.disabled = false;
    }
  }

  function draw(waters, here) {
    spotLayer.clearLayers();
    markersById = {};
    if (hereMarker) hereMarker.remove();
    hereMarker = L.circleMarker([here.lat, here.lng], { radius: 8, color: "#fff", fillColor: "#2a7de1", fillOpacity: 1, weight: 3 })
      .bindPopup("You are here").addTo(map);

    waters.forEach((w, i) => {
      markersById[w.id] = L.circleMarker([w.lat, w.lng], { radius: 9, color: "#0b2c2d", fillColor: "#3fa79b", fillOpacity: 0.9, weight: 2 })
        .bindPopup(popupHtml(w, i))
        .addTo(spotLayer);
    });

    const pts = waters.map((w) => [w.lat, w.lng]).concat([[here.lat, here.lng]]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [24, 24], maxZoom: 12 });
    else map.setView([here.lat, here.lng], 10);

    $("spotList").innerHTML = waters.map((w, i) => `
      <li><button class="spot-row" data-id="${esc(w.id)}">
        <span class="spot-rank">${i + 1}</span>
        <span class="catch-main">
          <span class="catch-name">${esc(w.name)}</span>
          <span class="catch-meta">${w.km.toFixed(1)} km · last stocked ${w.lastYear} · ${Math.round(w.fish).toLocaleString()} fish</span>
        </span>
      </button></li>`).join("");
    $("spotList").querySelectorAll(".spot-row").forEach((b) => b.addEventListener("click", () => focus(b.dataset.id)));
  }

  function popupHtml(w, i) {
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}`;
    return `<b>${i + 1}. ${esc(w.name)}</b>${w.township ? `<br>${esc(titleCase(w.township))} township` : ""}
      <br>Stocked in ${w.years.join(", ")}<br>${Math.round(w.fish).toLocaleString()} fish (${esc(w.stages.join(", ").toLowerCase())})
      <br><a href="${dir}" target="_blank" rel="noopener">Directions</a>`;
  }

  function focus(id) {
    const m = markersById[id];
    if (!m) return;
    document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 12));
    m.openPopup();
  }

  function titleCase(t) {
    return t.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function status(msg) { $("mapStatus").textContent = msg; }

  return { show };
})();
