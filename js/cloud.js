// Accounts, cloud sync and friends, using Supabase (database rules in supabase/setup.sql).
// The app still works fully without an account. A catch is always saved on the phone first,
// then copied to the account whenever there's a connection, so it keeps working offline.
// Depends on config.js, data.js, game.js, db.js and tackle.js, plus the Supabase library.

const SYNC_KEY = "creeked-up:sync";
const PROFILE_KEY = "creeked-up:profile";
const AGE_BLOCK_KEY = "creeked-up:age-block";
const AUTH_KEY = "creeked-up:auth";
const CLOUD_PHOTO_PX = 1024; // photos are shrunk a bit more for the account to fit the free storage
const PULL_OVERLAP_MS = 60 * 1000; // re-read the last minute each pull, in case two saves landed at once
const MIN_AGE = 13;

// ---------- Pure helpers (tested in tests/cloud.test.js) ----------

// Fields starting with "_" are this phone's sync notes and are never uploaded.
function cloudCatch(c) {
  const out = {};
  for (const k of Object.keys(c)) if (!k.startsWith("_")) out[k] = c[k];
  return out;
}

function needsUpload(c) {
  return c._synced !== true;
}

// What to do with a catch that came down from the account.
function pulledAction(local, row) {
  if (row.deleted) return local ? "delete" : "skip";
  if (local && needsUpload(local)) return "skip"; // this phone has a newer change still to send
  return "put";
}

// Same catch data, ignoring key order (the database stores keys in its own order).
function sameData(a, b) {
  const norm = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  return norm(a) === norm(b);
}

function fromCloudRow(row) {
  return { ...row.data, id: row.id, _synced: true, _photoUp: row.data.hasPhoto ? true : undefined };
}

// A friend's catch as the app's scoring code expects it. Friends never get the location,
// only whether there was one, so it still counts as proof when working out EXP.
function fromFriendRow(row) {
  return { createdAt: row.data.caughtAt, ...row.data, id: row.id, lat: null, lng: null };
}

function cleanUsername(s) {
  return String(s || "").trim().toLowerCase();
}

function validUsername(s) {
  return /^[a-z0-9_]{3,20}$/.test(cleanUsername(s));
}

// Age in whole years from a birth year and month (1 to 12). Day isn't asked, so this assumes
// the 1st of the month, which can make someone look up to a month older on their birthday month.
function ageFrom(year, month, now = new Date()) {
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) age -= 1;
  return age;
}

// The stats friends see. The owner's phone works these out and uploads them.
function buildSummary(scored, total) {
  const lv = levelFromExp(total);
  const biggest = scored.filter((c) => c.lengthCm).sort((a, b) => b.lengthCm - a.lengthCm)[0];
  const released = scored.filter((c) => c.released).length;
  const methods = {};
  scored.forEach((c) => { if (c.method) methods[c.method] = (methods[c.method] || 0) + 1; });
  const top = Object.entries(methods).sort((a, b) => b[1] - a[1])[0];
  return {
    level: lv.level,
    title: lv.title,
    totalExp: total,
    catches: scored.length,
    species: new Set(scored.filter((c) => c.speciesId !== "other").map((c) => c.speciesId)).size,
    releasedPct: scored.length ? Math.round((released / scored.length) * 100) : null,
    biggest: biggest ? { speciesId: biggest.speciesId, lengthCm: biggest.lengthCm } : null,
    topMethod: top ? { id: top[0], n: top[1] } : null,
    badges: earnedBadges(scored),
  };
}

const FRIEND_RESULT_TEXT = {
  sent: "Friend request sent.",
  accepted: "They'd already asked you, so you're now friends.",
  already_friends: "You're already friends.",
  already_sent: "You've already sent them a request.",
  not_found: "No one found with that username or friend code.",
  self: "That's you!",
  too_many: "You have 20 requests waiting. Wait for some answers first.",
};

// Turns Supabase's error messages into plain words.
function friendlyAuthError(err) {
  const m = String((err && err.message) || err || "");
  if (/invalid login credentials/i.test(m)) return "That email and password don't match an account.";
  if (/already registered|already been registered|user_already_exists/i.test(m)) return "There's already an account with that email. Try logging in.";
  if (/database error saving new user/i.test(m)) return "That username was just taken, or the account couldn't be made. Try another username.";
  if (/password should be|weak password|at least/i.test(m)) return "Pick a longer password: at least 8 characters.";
  if (/email not confirmed/i.test(m)) return "Check your email for a confirmation link first.";
  if (/not authorized|email address .*invalid/i.test(m)) return "Email isn't set up for this app yet, so this can't be sent. Ask the app owner.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a few minutes and try again.";
  if (/fetch|network|load failed/i.test(m)) return "No connection. Try again when you have signal.";
  return m || "Something went wrong. Try again.";
}

// ---------- Saved notes on this phone ----------

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

// ---------- The account ----------

const Cloud = {
  client: null,
  session: null,
  busy: false,
  again: false,
  lastError: "",
  lastSynced: null,
  hooks: { onData() {}, onStatus() {}, summary: () => null },

  configured() {
    return !!(CLOUD_CONFIG.url && CLOUD_CONFIG.key && typeof supabase !== "undefined");
  },

  // The account this phone is signed in to, even when offline. Null when signed out.
  account() {
    const s = loadJson(SYNC_KEY, null);
    return s && s.userId ? { userId: s.userId, ...loadJson(PROFILE_KEY, {}) } : null;
  },

  ageBlocked() {
    try { return localStorage.getItem(AGE_BLOCK_KEY) === "1"; } catch { return false; }
  },
  blockAge() {
    try { localStorage.setItem(AGE_BLOCK_KEY, "1"); } catch { /* storage blocked */ }
  },

  async init(hooks) {
    Object.assign(Cloud.hooks, hooks);
    if (!Cloud.configured()) return;
    Cloud.client = supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_KEY },
    });
    Cloud.client.auth.onAuthStateChange((event, session) => {
      Cloud.session = session;
      // Don't call Supabase from inside this callback; it can lock up. Run it next.
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") setTimeout(() => Cloud.requestSync(), 0);
      setTimeout(() => Cloud.hooks.onStatus(), 0);
    });
    try {
      const { data } = await Cloud.client.auth.getSession();
      Cloud.session = data.session;
    } catch { /* offline: the account is still remembered */ }
    window.addEventListener("online", () => Cloud.requestSync());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") Cloud.requestSync(); });
    Cloud.requestSync();
  },

  // "off", "signed-out", "needs-login" (remembered account but no session), "offline", "syncing", "error", "synced"
  status() {
    if (!Cloud.configured()) return "off";
    if (!Cloud.account()) return "signed-out";
    if (!navigator.onLine) return "offline";
    if (!Cloud.session) return "needs-login";
    if (Cloud.busy) return "syncing";
    if (Cloud.lastError) return "error";
    return "synced";
  },

  async usernameAvailable(name) {
    const { data, error } = await Cloud.client.rpc("username_available", { name: cleanUsername(name) });
    if (error) throw error;
    return data === true;
  },

  async signUp({ username, email, password }) {
    const { data, error } = await Cloud.client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: cleanUsername(username), age_13_plus: true } },
    });
    if (error) throw error;
    if (!data.session) return "confirm"; // the project asks people to confirm their email first
    Cloud.session = data.session;
    return Cloud.afterSignIn();
  },

  async signIn(email, password) {
    const { data, error } = await Cloud.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    Cloud.session = data.session;
    return Cloud.afterSignIn();
  },

  async resetPassword(email) {
    const { error } = await Cloud.client.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.href.split("#")[0] });
    if (error) throw error;
  },

  // Links this phone to the account. Catches made before signing in are added to it,
  // after asking. Returns "ok" or "cancelled".
  async afterSignIn() {
    const uid = Cloud.session.user.id;
    const prev = loadJson(SYNC_KEY, null);
    if (prev && prev.userId && prev.userId !== uid) {
      // Catches from a different account that are already saved there: take them off this phone.
      for (const c of await Store.allCatches()) if (!needsUpload(c)) await Store.deleteCatch(c.id);
    }
    if (!prev || prev.userId !== uid) {
      const waiting = (await Store.allCatches()).filter(needsUpload).length;
      const profile = await Cloud.fetchProfile(uid);
      if (waiting && !confirm(`This phone has ${waiting} catch${waiting === 1 ? "" : "es"} that ${waiting === 1 ? "isn't" : "aren't"} in an account yet. Add ${waiting === 1 ? "it" : "them"} to @${profile.username}'s account?\n\nPick Cancel to stay signed out. Nothing on this phone will change.`)) {
        await Cloud.client.auth.signOut({ scope: "local" }).catch(() => {});
        localStorage.removeItem(AUTH_KEY);
        Cloud.session = null;
        Cloud.hooks.onStatus();
        return "cancelled";
      }
      // Tackle from before signing in is merged with the account's, not replaced.
      const merged = [...(profile.tackle || [])];
      Tackle.all().forEach((t) => { if (!merged.some((m) => m.name.toLowerCase() === t.name.toLowerCase())) merged.push(t); });
      Tackle.replace(merged, merged.length ? new Date().toISOString() : null);
      saveJson(SYNC_KEY, { userId: uid, cursor: null, deletes: [] });
    }
    await Cloud.sync();
    return "ok";
  },

  async fetchProfile(uid) {
    const { data, error } = await Cloud.client.from("profiles")
      .select("username, friend_code, tackle, tackle_updated_at").eq("id", uid).single();
    if (error) throw error;
    saveJson(PROFILE_KEY, { username: data.username, friendCode: data.friend_code });
    return data;
  },

  // Changes that haven't reached the account yet.
  async pendingCount() {
    const s = loadJson(SYNC_KEY, { deletes: [] });
    return (await Store.allCatches()).filter(needsUpload).length + (s.deletes || []).length;
  },

  // Signs out and clears this phone. Everything saved to the account comes back on sign in.
  async signOut() {
    if (Cloud.client) {
      const { error } = await Cloud.client.auth.signOut({ scope: "local" }).catch((e) => ({ error: e }));
      if (error) localStorage.removeItem(AUTH_KEY);
    }
    Cloud.session = null;
    Cloud.lastError = "";
    await Store.clearAll();
    Tackle.replace([], null);
    localStorage.removeItem(SYNC_KEY);
    localStorage.removeItem(PROFILE_KEY);
    Cloud.hooks.onData();
    Cloud.hooks.onStatus();
  },

  // Deletes the account, its photos and everything in it. Catches stay on this phone.
  async deleteAccount() {
    const uid = Cloud.session.user.id;
    const bucket = Cloud.client.storage.from("photos");
    for (;;) {
      const { data, error } = await bucket.list(uid, { limit: 100 });
      if (error) throw error;
      if (!data.length) break;
      const { error: rmErr } = await bucket.remove(data.map((f) => `${uid}/${f.name}`));
      if (rmErr) throw rmErr;
    }
    const { error } = await Cloud.client.rpc("delete_my_account");
    if (error) throw error;
    for (const c of await Store.allCatches()) {
      delete c._synced;
      delete c._photoUp;
      await Store.putCatch(c);
    }
    await Cloud.client.auth.signOut({ scope: "local" }).catch(() => {});
    localStorage.removeItem(AUTH_KEY);
    Cloud.session = null;
    localStorage.removeItem(SYNC_KEY);
    localStorage.removeItem(PROFILE_KEY);
    Cloud.hooks.onData();
    Cloud.hooks.onStatus();
  },

  // Call after a catch is deleted on this phone, so it's deleted from the account too.
  noteDeleted(id) {
    const s = loadJson(SYNC_KEY, null);
    if (!s || !s.userId) return;
    s.deletes = [...new Set([...(s.deletes || []), id])];
    saveJson(SYNC_KEY, s);
  },

  // Runs a sync soon. Safe to call often: only one runs at a time.
  requestSync() {
    clearTimeout(Cloud.timer);
    Cloud.timer = setTimeout(() => Cloud.sync().catch(() => {}), 300);
  },

  async sync() {
    if (!Cloud.configured() || !Cloud.session || !Cloud.account() || !navigator.onLine) {
      Cloud.hooks.onStatus();
      return;
    }
    if (Cloud.busy) { Cloud.again = true; return; }
    Cloud.busy = true;
    Cloud.hooks.onStatus();
    try {
      const changed = await Cloud.runSync();
      Cloud.lastError = "";
      Cloud.lastSynced = new Date();
      if (changed) await Cloud.hooks.onData();
      await Cloud.pushSummary();
    } catch (e) {
      Cloud.lastError = friendlyAuthError(e);
    } finally {
      Cloud.busy = false;
      Cloud.hooks.onStatus();
    }
    if (Cloud.again) { Cloud.again = false; Cloud.requestSync(); }
  },

  // Returns true if anything on this phone changed.
  async runSync() {
    const uid = Cloud.session.user.id;
    const s = loadJson(SYNC_KEY, null);
    if (!s || s.userId !== uid) return false;
    const table = Cloud.client.from("catches");
    const bucket = Cloud.client.storage.from("photos");
    let changed = false;

    // 1. Deletes made on this phone.
    const deletes = [...(s.deletes || [])];
    if (deletes.length) {
      await bucket.remove(deletes.map((id) => `${uid}/${id}.jpg`)); // fine if there was no photo
      const { error } = await table.upsert(deletes.map((id) => ({ user_id: uid, id, data: {}, deleted: true })), { onConflict: "user_id,id" });
      if (error) throw error;
      const now = loadJson(SYNC_KEY, s);
      now.deletes = (now.deletes || []).filter((id) => !deletes.includes(id));
      saveJson(SYNC_KEY, now);
    }

    // 2. New catches from this phone, photo first so a friend never sees a catch with a missing photo.
    const toSend = (await Store.allCatches()).filter(needsUpload);
    for (const c of toSend) {
      if (c.hasPhoto && !c._photoUp) {
        const blob = await Store.getPhoto(c.id);
        if (blob) {
          const small = await shrinkImage(blob, CLOUD_PHOTO_PX);
          const { error } = await bucket.upload(`${uid}/${c.id}.jpg`, small, { upsert: true, contentType: "image/jpeg" });
          if (error) throw error;
        }
        c._photoUp = true;
        await Store.putCatch(c);
      }
    }
    for (let i = 0; i < toSend.length; i += 100) {
      const part = toSend.slice(i, i + 100);
      const { error } = await table.upsert(part.map((c) => ({ user_id: uid, id: c.id, data: cloudCatch(c), deleted: false })), { onConflict: "user_id,id" });
      if (error) throw error;
      for (const c of part) {
        c._synced = true;
        await Store.putCatch(c);
      }
    }

    // 3. Changes from the account (other phones), oldest first.
    let cursor = s.cursor;
    for (;;) {
      let q = table.select("id, data, deleted, updated_at").order("updated_at").limit(1000);
      if (cursor) q = q.gt("updated_at", new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      const local = new Map((await Store.allCatches()).map((c) => [c.id, c]));
      let newest = cursor;
      for (const row of data) {
        const action = pulledAction(local.get(row.id), row);
        const old = local.get(row.id);
        if (action === "delete") { await Store.deleteCatch(row.id); changed = true; }
        if (action === "put" && (!old || !sameData(cloudCatch(old), row.data))) {
          await Store.putCatch(fromCloudRow(row));
          changed = true;
        }
        if (!newest || row.updated_at > newest) newest = row.updated_at;
      }
      const now = loadJson(SYNC_KEY, s);
      now.cursor = newest;
      saveJson(SYNC_KEY, now);
      if (data.length < 1000 || newest === cursor) break;
      cursor = newest;
    }

    // 4. Tackle box: the most recent change wins.
    const profile = await Cloud.fetchProfile(uid);
    const localAt = Tackle.updatedAt();
    const serverAt = profile.tackle_updated_at;
    if (localAt && (!serverAt || new Date(localAt) > new Date(serverAt))) {
      const { error } = await Cloud.client.from("profiles").update({ tackle: Tackle.all(), tackle_updated_at: localAt }).eq("id", uid);
      if (error) throw error;
    } else if (serverAt && (!localAt || new Date(serverAt) > new Date(localAt))) {
      Tackle.replace(profile.tackle || [], serverAt);
      changed = true;
    }
    return changed;
  },

  async pushSummary() {
    const summary = Cloud.hooks.summary();
    if (!summary) return;
    const json = JSON.stringify(summary);
    if ((loadJson(SYNC_KEY, {}) || {}).summary === json) return;
    const { error } = await Cloud.client.from("profiles").update({ summary }).eq("id", Cloud.session.user.id);
    if (error) throw error;
    saveJson(SYNC_KEY, { ...loadJson(SYNC_KEY, {}), summary: json });
  },

  // A photo that's in the account but not on this phone yet (logged on another phone).
  missingPhotos: new Set(),
  async photo(id) {
    if (!Cloud.session || Cloud.missingPhotos.has(id) || !navigator.onLine) return null;
    const { data, error } = await Cloud.client.storage.from("photos").download(`${Cloud.session.user.id}/${id}.jpg`);
    if (error || !data) { Cloud.missingPhotos.add(id); return null; }
    await Store.putPhoto(id, data);
    return data;
  },

  // ---------- Friends ----------

  async rpc(name, args) {
    const { data, error } = await Cloud.client.rpc(name, args);
    if (error) throw error;
    return data;
  },
  listFriends: () => Cloud.rpc("list_friends"),
  sendRequest: (target) => Cloud.rpc("send_friend_request", { target: target.trim() }),
  respond: (id, accept) => Cloud.rpc("respond_friend_request", { other: id, accept }),
  removeFriend: (id) => Cloud.rpc("remove_friend", { other: id }),
  block: (id) => Cloud.rpc("block_user", { other: id }),
  async friendCatches(id) {
    return (await Cloud.rpc("friend_catches", { friend: id })).map(fromFriendRow);
  },
  // Short-lived links to a friend's photos. Only works while you're friends.
  async friendPhotoUrls(friendId, catchIds) {
    if (!catchIds.length) return {};
    const { data, error } = await Cloud.client.storage.from("photos")
      .createSignedUrls(catchIds.map((id) => `${friendId}/${id}.jpg`), 3600);
    if (error) return {};
    const out = {};
    data.forEach((d, i) => { if (d.signedUrl) out[catchIds[i]] = d.signedUrl; });
    return out;
  },
};

if (typeof module !== "undefined") {
  module.exports = { cloudCatch, needsUpload, pulledAction, sameData, fromCloudRow, fromFriendRow, cleanUsername, validUsername, ageFrom, buildSummary, friendlyAuthError };
}
