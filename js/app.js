// Creeked Up: the screens and what happens when you tap things.
// Depends on data.js, game.js and db.js.

const $ = (id) => document.getElementById(id);
const IN_TO_CM = 2.54;
const LB_TO_KG = 0.45359237;
const MAX_PHOTO_PX = 1280;
const GALLERY_PHOTO_WINDOW_MS = 48 * 3600 * 1000; // a gallery photo must be this close to the catch time to count

let state = { catches: [], scored: [], location: null, photoBlob: null, photo: null, method: "" };

// ---------- Startup ----------

document.addEventListener("DOMContentLoaded", async () => {
  startIntro();
  fillSpeciesSelect();
  setupMethods();
  resetForm();
  bindEvents();
  await reload();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
});

function fillSpeciesSelect() {
  const sel = $("species");
  sel.innerHTML = '<option value="" disabled selected>Pick a species</option>' +
    [...SPECIES].sort((a, b) => (a.id === "other") - (b.id === "other") || a.name.localeCompare(b.name))
      .map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
}

function bindEvents() {
  document.querySelectorAll(".tabs button").forEach((b) =>
    b.addEventListener("click", () => showView(b.dataset.view)));

  $("photo").addEventListener("change", onPhotoChosen);
  $("photoGallery").addEventListener("change", onPhotoChosen);
  $("locBtn").addEventListener("click", getLocation);
  document.querySelectorAll('input[name="fate"]').forEach((r) =>
    r.addEventListener("change", () => { $("keptWarn").hidden = fateValue() !== "kept"; }));
  $("catchForm").addEventListener("submit", onSave);

  $("exportBtn").addEventListener("click", exportBackup);
  $("importFile").addEventListener("change", importBackup);
  $("clearBtn").addEventListener("click", clearEverything);
  $("levelUpClose").addEventListener("click", () => $("levelUp").close());
  $("replayIntro").addEventListener("click", playIntro);
  $("scanBtn").addEventListener("click", openScan);
  $("idClose").addEventListener("click", () => $("idDlg").close());
  $("weatherBtn").addEventListener("click", loadWeather);
  $("tackleType").innerHTML = TACKLE_TYPES.map((t) => `<option>${t}</option>`).join("");
  $("tackleForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("tackleName").value.trim();
    if (!name) return;
    Tackle.add(name, $("tackleType").value, $("tackleMethod").value);
    $("tackleName").value = "";
    renderTackle();
  });
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => showView(b.dataset.go)));
}

// ---------- Intro ----------
// "Vanderholst Studios presents", then the app name. Plays on every launch; tap to skip.

const INTRO_MS = 3700;
let introTimer = 0;

function startIntro() {
  $("intro").addEventListener("click", endIntro);
  introTimer = setTimeout(endIntro, introLength());
}

function introLength() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : INTRO_MS;
}

function endIntro() {
  const intro = $("intro");
  if (intro.classList.contains("out")) return;
  clearTimeout(introTimer);
  intro.classList.add("out");
  setTimeout(() => { intro.hidden = true; }, 450);
}

function playIntro() {
  const intro = $("intro");
  intro.hidden = false;
  intro.classList.remove("out", "play");
  void intro.offsetWidth; // restart the CSS animation
  intro.classList.add("play");
  clearTimeout(introTimer);
  introTimer = setTimeout(endIntro, introLength());
}

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  window.scrollTo(0, 0);
  if (name === "map") MapView.show();
}

async function reload() {
  state.catches = await Store.allCatches();
  state.scored = scoreCatches(state.catches);
  renderAll();
}

// ---------- Log form ----------

function resetForm() {
  $("catchForm").reset();
  $("caughtAt").value = toLocalInput(new Date());
  $("photoPreview").hidden = true;
  $("photoHint").hidden = false;
  $("photoNote").hidden = true;
  $("keptWarn").hidden = true;
  state.photoBlob = null;
  state.photo = null;
  state.location = null;
  pickMethod(MethodPref.get());
  $("locStatus").textContent = "Location not added";
  $("locBtn").textContent = "Add my location";
}

function fateValue() {
  return document.querySelector('input[name="fate"]:checked').value;
}

// Camera photos are taken right now, so they always count as proof.
// Gallery photos could be old or someone else's, so we read the date and place saved
// inside the photo, fill those in, and only count the photo if its date fits the catch.
async function onPhotoChosen(e) {
  const file = e.target.files[0];
  const fromGallery = e.target.id === "photoGallery";
  e.target.value = ""; // lets the same photo be picked again after a reset
  if (!file) return;
  try {
    const bytes = await file.arrayBuffer();
    state.photoBlob = await shrinkImage(file);
    state.photo = { source: fromGallery ? "gallery" : "camera", takenAt: null, hash: await hashBytes(bytes) };
    $("photoPreview").src = URL.createObjectURL(state.photoBlob);
    $("photoPreview").hidden = false;
    $("photoHint").hidden = true;
    $("photoNote").hidden = !fromGallery;
    if (!fromGallery) {
      if (!state.location) getLocation();
      return;
    }
    const exif = readExif(bytes);
    state.photo.takenAt = exif.takenAt;
    const notes = [];
    if (exif.takenAt) {
      $("caughtAt").value = toLocalInput(exif.takenAt);
      notes.push(`Photo taken ${exif.takenAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}, so the catch time is set to match.`);
    } else {
      notes.push("This photo has no date saved in it (screenshots and photos sent through chat apps usually don't), so it won't add photo EXP. It will still be saved with your catch.");
    }
    if (exif.lat != null) {
      state.location = { lat: exif.lat, lng: exif.lng, accuracy: null, fromPhoto: true };
      $("locStatus").textContent = "Location added from the photo";
      $("locBtn").textContent = "Use where I am now";
      notes.push("The place was filled in from the photo.");
    } else {
      if (state.location && state.location.fromPhoto) {
        // The place came from a photo that was swapped out, so it no longer applies.
        state.location = null;
        $("locStatus").textContent = "Location not added";
        $("locBtn").textContent = "Add my location";
      }
      notes.push("No place is saved in this photo. Only tap \"Add my location\" if you're still where you caught it.");
    }
    $("photoNote").textContent = notes.join(" ");
  } catch {
    toast("Couldn't read that photo. Try again.");
  }
}

// A fingerprint of the original photo file, used to stop one photo being logged twice.
async function hashBytes(bytes) {
  if (!(window.crypto && crypto.subtle)) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function photoFitsCatch(photo, caughtAt) {
  if (!photo) return false;
  if (photo.source === "camera") return true;
  return !!photo.takenAt && Math.abs(photo.takenAt - caughtAt) <= GALLERY_PHOTO_WINDOW_MS;
}

// Photos are resized so they don't fill up the phone's storage.
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function getLocation() {
  if (!("geolocation" in navigator)) {
    $("locStatus").textContent = "This browser can't share location";
    return;
  }
  $("locStatus").textContent = "Finding you...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
      $("locStatus").textContent = `Location added (within ${state.location.accuracy} m)`;
      $("locBtn").textContent = "Update";
    },
    () => { $("locStatus").textContent = "Location not added (permission off or no signal)"; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

async function onSave(e) {
  e.preventDefault();
  const speciesId = $("species").value;
  if (!speciesId) return toast("Pick a species first.");
  const p = state.photo;
  if (p && p.hash && state.catches.some((x) => x.photoHash === p.hash)) {
    return toast("You've already logged a catch with this photo. Use a different photo for each fish.");
  }

  const len = parseFloat($("length").value);
  const wt = parseFloat($("weight").value);
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const c = {
    id,
    speciesId,
    lengthCm: isNaN(len) ? null : round1($("lengthUnit").value === "in" ? len * IN_TO_CM : len),
    weightKg: isNaN(wt) ? null : round2($("weightUnit").value === "lb" ? wt * LB_TO_KG : wt),
    caughtAt: new Date($("caughtAt").value).toISOString(),
    createdAt: new Date().toISOString(),
    lat: state.location ? state.location.lat : null,
    lng: state.location ? state.location.lng : null,
    accuracyM: state.location ? state.location.accuracy : null,
    bait: $("bait").value.trim(),
    method: state.method,
    released: fateValue() === "released",
    notes: $("notes").value.trim(),
    hasPhoto: !!state.photoBlob,
  };
  if (p) {
    c.photoSource = p.source;
    c.photoProof = photoFitsCatch(p, new Date(c.caughtAt));
    c.photoHash = p.hash;
  }

  const before = levelFromExp(totalExp(state.scored)).level;
  const badgesBefore = new Set(earnedBadges(state.catches));
  const questsBefore = new Set(weekQuests(state.catches, new Date(c.caughtAt)).filter((q) => q.done).map((q) => q.id));

  if (c.method) MethodPref.set(c.method);
  if (state.photoBlob) await Store.putPhoto(id, state.photoBlob);
  await Store.putCatch(c);
  await reload();

  const saved = state.scored.find((x) => x.id === id);
  const after = levelFromExp(totalExp(state.scored));
  const newBadges = earnedBadges(state.catches).filter((b) => !badgesBefore.has(b));

  let msg = `+${saved.exp} EXP`;
  if (saved.expParts.firstSpecies > 1) msg += " · New species!";
  if (newBadges.length) msg += ` · Badge: ${BADGES.find((b) => b.id === newBadges[0]).name}`;
  const newQuest = weekQuests(state.catches, new Date(c.caughtAt)).find((q) => q.done && !questsBefore.has(q.id));
  if (newQuest) msg += ` · Quest done: +${newQuest.reward} EXP`;
  if (c.photoProof === false) msg += " · Photo added no EXP: it has no date, or its date is over 2 days from the catch";
  toast(msg);

  resetForm();
  if (after.level > before) {
    $("levelUpNum").textContent = `Level ${after.level}`;
    $("levelUpTitle").textContent = after.title;
    $("levelUp").showModal();
  }
}

// ---------- Rendering ----------

// Catch EXP plus bonus EXP from finished weekly quests.
function totalExp(scored) {
  return scored.reduce((sum, c) => sum + c.exp, 0) + questExp(scored);
}

function renderAll() {
  const lv = levelFromExp(totalExp(state.scored));
  $("miniLevel").textContent = `Lv ${lv.level}`;
  ["", "home"].forEach((p) => {
    const id = (k) => (p ? p + k : k.charAt(0).toLowerCase() + k.slice(1));
    $(id("LevelNum")).textContent = lv.level;
    $(id("LevelTitle")).textContent = lv.title;
    $(id("LevelFill")).style.width = `${Math.round(lv.progress * 100)}%`;
    $(id("LevelExp")).textContent = `${lv.intoLevel} / ${lv.need} EXP to level ${lv.level + 1}`;
  });
  renderHome();
  renderQuests();
  renderMoon();
  renderTackle();
  renderCatchList();
  renderStats();
  renderBadges();
  renderCollection();
}

function renderHome() {
  const hour = new Date().getHours();
  $("home-h").textContent = hour < 12 ? "Morning bite's on." : hour < 18 ? "Tight lines, angler." : "Evening bite's on.";

  const latest = state.scored[state.scored.length - 1];
  $("homeLatest").innerHTML = latest
    ? `<button class="catch-row" data-id="${latest.id}">
        <span class="catch-main">
          <span class="catch-name">${esc(speciesById(latest.speciesId).name)}</span>
          <span class="catch-meta">${fmtDate(latest.caughtAt)}${latest.lengthCm ? " · " + latest.lengthCm + " cm" : ""}</span>
        </span>
        <span class="catch-exp">+${latest.exp}</span></button>`
    : `<p class="empty small">Nothing yet. Your first catch earns the First Fish badge.</p>`;
  const row = $("homeLatest").querySelector(".catch-row");
  if (row) row.addEventListener("click", () => openDetail(row.dataset.id));

  const earned = new Set(earnedBadges(state.catches));
  const next = BADGES.find((b) => !earned.has(b.id));
  $("homeGoal").innerHTML = next
    ? `<div class="badge-name">${next.name}</div><div class="badge-desc">${next.desc}</div>`
    : `<div class="badge-name">Every badge earned</div><div class="badge-desc">More are coming.</div>`;
}

function renderQuests() {
  const quests = weekQuests(state.catches, new Date());
  $("quests").innerHTML = quests.map((q) => `
    <li class="quest ${q.done ? "done" : ""}">
      <div class="quest-top"><span class="quest-text">${esc(q.text)}</span><span class="quest-reward">${q.done ? "Done" : `+${q.reward} EXP`}</span></div>
      <div class="bar"><div class="fill" style="width:${Math.round((q.progress / q.goal) * 100)}%"></div></div>
      <div class="quest-prog">${q.progress} / ${q.goal}</div>
    </li>`).join("");
}

function renderMoon() {
  const m = moonPhase(new Date());
  $("condMoon").innerHTML = `<span class="moon" style="--lit:${m.lit}%"></span>
    <span><b>${m.name}</b><br><span class="catch-meta">${m.lit}% lit</span></span>`;
}

function loadWeather() {
  const box = $("condWeather");
  box.textContent = "Finding you...";
  if (!("geolocation" in navigator)) { box.textContent = "This browser can't share location."; return; }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const w = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
      const t = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      box.innerHTML = `<div class="cond-grid">
        <div><b>${Math.round(w.tempC)}°C</b><span>${esc(w.text)}</span></div>
        <div><b>${Math.round(w.windKmh)} km/h</b><span>Wind</span></div>
        <div><b>${Math.round(w.pressureHpa)} hPa</b><span>Pressure</span></div>
        <div><b>${t(w.sunrise)}</b><span>Sunrise</span></div>
        <div><b>${t(w.sunset)}</b><span>Sunset</span></div>
      </div>`;
    } catch {
      box.innerHTML = `Couldn't load the weather. <button type="button" class="ghost" id="weatherBtn">Try again</button>`;
      $("weatherBtn").addEventListener("click", loadWeather);
    }
  }, () => {
    box.innerHTML = `Location is off, so weather can't load. <button type="button" class="ghost" id="weatherBtn">Try again</button>`;
    $("weatherBtn").addEventListener("click", loadWeather);
  }, { timeout: 15000, maximumAge: 600000 });
}

function renderTackle() {
  const items = Tackle.all();
  const counts = {};
  bestBaits(state.catches).forEach((b) => { counts[b.name.toLowerCase()] = b.n; });
  // Only suggest gear for the method picked on the log form (gear with no method always shows).
  $("tackleList").innerHTML = items.filter((t) => ["Lure", "Bait", "Fly", "Jig"].includes(t.type))
    .filter((t) => !t.method || !state.method || t.method === state.method)
    .map((t) => `<option value="${esc(t.name)}"></option>`).join("");
  $("tackleListUi").innerHTML = items.length
    ? items.map((t) => `<li><span><b>${esc(t.name)}</b> <span class="catch-meta">${esc(t.type)}${methodById(t.method) ? ` · ${esc(methodById(t.method).name)}` : ""}${counts[t.name.toLowerCase()] ? ` · ${counts[t.name.toLowerCase()]} fish` : ""}</span></span>
        <button type="button" class="ghost small-btn" data-del="${esc(t.id)}" aria-label="Remove ${esc(t.name)}">Remove</button></li>`).join("")
    : `<li class="catch-meta">Nothing in your tackle box yet.</li>`;
  $("tackleListUi").querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    Tackle.remove(b.dataset.del);
    renderTackle();
  }));
}

// ---------- Fishing methods ----------

function setupMethods() {
  const opts = METHODS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
  $("tackleMethod").innerHTML = `<option value="">Any method</option>${opts}`;
  $("catchMethod").innerHTML = `<option value="">All methods</option>${opts}`;
  $("catchMethod").addEventListener("change", renderCatchList);
  $("methodChips").innerHTML = METHODS.map((m) =>
    `<button type="button" class="chip" data-method="${m.id}" aria-pressed="false" title="${esc(m.short)}">${esc(m.name)}</button>`).join("");
  $("methodChips").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () =>
    pickMethod(state.method === b.dataset.method ? "" : b.dataset.method)));
  document.querySelectorAll("[data-guide]").forEach((b) => b.addEventListener("click", openMethodGuide));
  $("methodClose").addEventListener("click", () => $("methodDlg").close());
}

// Tap a method to pick it, tap it again to clear it. It's optional.
function pickMethod(id) {
  state.method = methodById(id) ? id : "";
  $("methodChips").querySelectorAll(".chip").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.method === state.method)));
  renderTackle();
}

function methodSourceLinks(m) {
  return m.sources.map((k) => `<a href="${METHOD_SOURCES[k].url}" target="_blank" rel="noopener">${esc(METHOD_SOURCES[k].name)}</a>`).join(" · ");
}

function openMethodGuide() {
  $("methodGuide").innerHTML = `<ul class="method-guide">${METHODS.filter((m) => m.id !== "other").map((m) => `
    <li><div class="badge-name">${esc(m.name)}</div>
      <p>${esc(m.how)}</p>
      ${m.gear ? `<p><b>Gear:</b> ${esc(m.gear)}</p>` : ""}
      ${m.rule ? `<p><b>Rules and safety:</b> ${esc(m.rule)}</p>` : ""}
      ${m.goodFor.length ? `<p><b>Good for:</b> ${m.goodFor.map((id) => esc(speciesById(id).name)).join(", ")}</p>` : ""}
      <div class="tip-note">Source: ${methodSourceLinks(m)}</div>
    </li>`).join("")}</ul>`;
  $("methodDlg").showModal();
}

// ---------- Fish scan ----------

let scanChosen = [];

function openScan() {
  scanChosen = [];
  $("idChips").innerHTML = ID_TRAITS.map((t) =>
    `<button type="button" class="chip" data-trait="${t.id}" aria-pressed="false">${esc(t.label)}</button>`).join("");
  $("idChips").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    scanChosen = on ? [...scanChosen, b.dataset.trait] : scanChosen.filter((x) => x !== b.dataset.trait);
    renderScanResults();
  }));
  renderScanResults();
  $("idDlg").showModal();
}

function renderScanResults() {
  const results = identify(scanChosen);
  $("idResults").innerHTML = results.length
    ? results.map((r) => `<li><button type="button" class="spot-row" data-pick="${r.id}">
        <span class="catch-main"><span class="catch-name">${esc(speciesById(r.id).name)}</span>
        <span class="catch-meta">${esc(r.check)}</span></span>
        <span class="catch-exp">Pick</span></button></li>`).join("")
    : `<li class="catch-meta">Tap a few things you can see to get matches.</li>`;
  $("idResults").querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
    $("species").value = b.dataset.pick;
    $("idDlg").close();
    toast(`Picked ${speciesById(b.dataset.pick).name}. Double-check it before saving.`);
  }));
}

async function renderCatchList() {
  const list = $("catchList");
  const only = $("catchMethod").value;
  const items = [...state.scored].reverse().filter((c) => !only || c.method === only);
  $("catchEmpty").hidden = items.length > 0;
  $("catchEmpty").textContent = only && state.scored.length ? "No catches with this method yet." : "No catches yet. Go fishing!";
  list.innerHTML = items.map((c) => `
    <li><button class="catch-row" data-id="${c.id}">
      <span class="thumb" data-photo="${c.hasPhoto ? c.id : ""}"></span>
      <span class="catch-main">
        <span class="catch-name">${esc(speciesById(c.speciesId).name)}</span>
        <span class="catch-meta">${fmtDate(c.caughtAt)}${c.lengthCm ? " · " + c.lengthCm + " cm" : ""}${methodById(c.method) ? " · " + esc(methodById(c.method).name) : ""}</span>
      </span>
      <span class="catch-exp">+${c.exp}</span>
    </button></li>`).join("");

  list.querySelectorAll(".catch-row").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.id)));
  for (const el of list.querySelectorAll(".thumb[data-photo]")) {
    if (!el.dataset.photo) continue;
    const blob = await Store.getPhoto(el.dataset.photo);
    if (blob) el.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }
}

function renderStats() {
  const s = state.scored;
  const caught = speciesCaught(s);
  const biggest = s.filter((c) => c.lengthCm).sort((a, b) => b.lengthCm - a.lengthCm)[0];
  const released = s.filter((c) => c.released).length;
  const topMethod = methodCounts(s)[0];
  const cells = [
    ["Catches", s.length],
    ["Species", caught.size],
    ["Total EXP", totalExp(s)],
    ["Released", s.length ? `${Math.round((released / s.length) * 100)}%` : "–"],
    ["Top method", topMethod ? `${methodById(topMethod.id).name} (${topMethod.n})` : "–"],
    ["Biggest", biggest ? `${biggest.lengthCm} cm ${speciesById(biggest.speciesId).name}` : "–"],
  ];
  $("stats").innerHTML = cells.map(([k, v]) =>
    `<div class="stat"><div class="stat-v">${esc(String(v))}</div><div class="stat-k">${k}</div></div>`).join("");
}

function renderBadges() {
  const earned = new Set(earnedBadges(state.catches));
  $("badges").innerHTML = BADGES.map((b) => `
    <li class="badge ${earned.has(b.id) ? "earned" : ""}">
      <div class="badge-name">${b.name}</div><div class="badge-desc">${b.desc}</div>
    </li>`).join("");
}

function renderCollection() {
  const best = {};
  state.scored.forEach((c) => {
    if (!best[c.speciesId] || (c.lengthCm || 0) > (best[c.speciesId].lengthCm || 0)) best[c.speciesId] = c;
  });
  $("collection").innerHTML = SPECIES.filter((s) => s.id !== "other").map((s) => {
    const b = best[s.id];
    return `<li class="${b ? "got" : ""}"><span>${b ? s.name : "???"}</span>
      <span class="pb">${b ? (b.lengthCm ? `PB ${b.lengthCm} cm` : "Caught") : `${s.base} base EXP`}</span></li>`;
  }).join("");
}

async function openDetail(id) {
  const c = state.scored.find((x) => x.id === id);
  if (!c) return;
  const p = c.expParts;
  const blob = c.hasPhoto ? await Store.getPhoto(id) : null;
  const d = $("detail");
  d.innerHTML = `
    <div class="detail-inner">
      ${blob ? `<img class="detail-photo" src="${URL.createObjectURL(blob)}" alt="Photo of the catch">` : ""}
      <h2>${esc(speciesById(c.speciesId).name)}</h2>
      <dl>
        <dt>When</dt><dd>${fmtDate(c.caughtAt)}</dd>
        ${c.lengthCm ? `<dt>Length</dt><dd>${c.lengthCm} cm (${round1(c.lengthCm / IN_TO_CM)} in)</dd>` : ""}
        ${c.weightKg ? `<dt>Weight</dt><dd>${c.weightKg} kg (${round2(c.weightKg / LB_TO_KG)} lb)</dd>` : ""}
        ${methodById(c.method) ? `<dt>Method</dt><dd>${esc(methodById(c.method).name)}</dd>` : ""}
        ${c.bait ? `<dt>Bait or lure</dt><dd>${esc(c.bait)}</dd>` : ""}
        <dt>Kept or released</dt><dd>${c.released ? "Released" : "Kept"}</dd>
        ${c.lat != null ? `<dt>Location</dt><dd>Saved privately on this phone</dd>` : ""}
        ${c.notes ? `<dt>Notes</dt><dd>${esc(c.notes)}</dd>` : ""}
      </dl>
      <h3>+${c.exp} EXP</h3>
      <ul class="breakdown">
        <li>Species base: ${p.base}</li>
        <li>Size: ×${p.size.toFixed(2)}</li>
        ${p.firstSpecies > 1 ? "<li>First of this species: ×2</li>" : ""}
        ${p.release > 1 ? "<li>Released: ×1.1</li>" : ""}
        <li>Proof (photo and GPS): ×${p.trust}</li>
      </ul>
      <div class="detail-btns">
        <button type="button" class="danger" id="delBtn">Delete</button>
        <button type="button" class="ghost" id="shareBtn">Share</button>
        <button type="button" class="primary" id="closeBtn">Close</button>
      </div>
    </div>`;
  d.showModal();
  $("closeBtn").onclick = () => d.close();
  $("shareBtn").onclick = async () => {
    const result = await shareCatch(c, blob, levelFromExp(totalExp(state.scored)));
    if (result === "downloaded") toast("Catch card saved as a picture.");
  };
  $("delBtn").onclick = async () => {
    if (!confirm("Delete this catch? Its EXP will be removed.")) return;
    await Store.deleteCatch(id);
    d.close();
    await reload();
  };
}

// ---------- Backup ----------

async function exportBackup() {
  const photos = {};
  for (const c of state.catches) {
    if (!c.hasPhoto) continue;
    const blob = await Store.getPhoto(c.id);
    if (blob) photos[c.id] = await blobToDataUrl(blob);
  }
  const data = { app: "creeked-up", version: 1, exportedAt: new Date().toISOString(), catches: state.catches, photos, tackle: Tackle.all() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `creeked-up-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "creeked-up" || !Array.isArray(data.catches)) throw new Error("not a backup");
    for (const c of data.catches) {
      await Store.putCatch(c);
      if (data.photos && data.photos[c.id]) await Store.putPhoto(c.id, await (await fetch(data.photos[c.id])).blob());
    }
    if (Array.isArray(data.tackle)) data.tackle.forEach((t) => Tackle.add(t.name, t.type, t.method || ""));
    await reload();
    toast(`Imported ${data.catches.length} catches.`);
  } catch {
    toast("That file isn't a Creeked Up backup.");
  }
}

async function clearEverything() {
  if (!confirm("Delete ALL catches and photos from this phone? This can't be undone unless you have a backup.")) return;
  await Store.clearAll();
  await reload();
  toast("Everything deleted.");
}

// ---------- Helpers ----------

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3500);
}

function toLocalInput(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
}

function esc(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
