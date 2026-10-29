// Account and Friends screens. The account and sync logic is in cloud.js.
// Depends on app.js (for $, esc, toast, state and the render helpers) and cloud.js.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let friendsCache = null;

function setupAccount() {
  $("suMonth").innerHTML = `<option value="" disabled selected>Month</option>` +
    MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  const year = new Date().getFullYear();
  const years = [];
  for (let y = year; y >= year - 100; y--) years.push(`<option value="${y}">${y}</option>`);
  $("suYear").innerHTML = `<option value="" disabled selected>Year</option>${years.join("")}`;

  document.querySelectorAll("[data-auth]").forEach((b) => b.addEventListener("click", () => authMode(b.dataset.auth)));
  $("authClose").addEventListener("click", () => $("authDlg").close());
  $("signupForm").addEventListener("submit", onSignUp);
  $("signinForm").addEventListener("submit", onSignIn);
  $("forgotBtn").addEventListener("click", onForgot);
  $("suName").addEventListener("change", checkUsername);
  $("addFriendForm").addEventListener("submit", onAddFriend);
  $("copyCode").addEventListener("click", copyCode);
  renderAccount();
}

// ---------- Sign up and log in ----------

function openAuth(mode) {
  $("authMsg").hidden = true;
  authMode(mode);
  $("authDlg").showModal();
}

function authMode(mode) {
  const blocked = mode === "signup" && Cloud.ageBlocked();
  document.querySelectorAll("[data-auth]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.auth === mode)));
  $("signupForm").hidden = mode !== "signup" || blocked;
  $("signinForm").hidden = mode !== "signin";
  $("ageBlock").hidden = !blocked;
  $("authMsg").hidden = true;
}

function authError(msg) {
  $("authMsg").textContent = msg;
  $("authMsg").hidden = false;
}

async function withBusy(form, fn) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  try { await fn(); } finally { btn.disabled = false; }
}

async function checkUsername() {
  const name = $("suName").value;
  const hint = $("suNameHint");
  if (!validUsername(name)) {
    hint.textContent = "Use 3 to 20 letters, numbers or _ (no spaces).";
    return false;
  }
  try {
    const ok = await Cloud.usernameAvailable(name);
    hint.textContent = ok ? `@${cleanUsername(name)} is free.` : `@${cleanUsername(name)} is taken. Try another.`;
    return ok;
  } catch {
    hint.textContent = "Couldn't check that name. Are you online?";
    return null;
  }
}

async function onSignUp(e) {
  e.preventDefault();
  const age = ageFrom(Number($("suYear").value), Number($("suMonth").value));
  if (age < MIN_AGE) {
    Cloud.blockAge();
    authMode("signup");
    return;
  }
  await withBusy($("signupForm"), async () => {
    if ((await checkUsername()) === false) return authError("Pick a different username.");
    try {
      const result = await Cloud.signUp({ username: $("suName").value, email: $("suEmail").value, password: $("suPass").value });
      if (result === "confirm") return authError("Check your email and tap the link to finish, then log in here.");
      finishAuth(result, "Account made. Your catches will now save to it.");
    } catch (err) {
      authError(friendlyAuthError(err));
    }
  });
}

async function onSignIn(e) {
  e.preventDefault();
  await withBusy($("signinForm"), async () => {
    try {
      const result = await Cloud.signIn($("siEmail").value, $("siPass").value);
      finishAuth(result, "Logged in. Your catches are syncing.");
    } catch (err) {
      authError(friendlyAuthError(err));
    }
  });
}

function finishAuth(result, msg) {
  if (result === "cancelled") return authError("You're still signed out. Nothing changed.");
  $("signupForm").reset();
  $("signinForm").reset();
  $("authDlg").close();
  toast(msg);
  renderAccount();
  if ($("view-friends").classList.contains("active")) renderFriends();
}

async function onForgot() {
  const email = $("siEmail").value.trim();
  if (!email) return authError("Type your email above first.");
  try {
    await Cloud.resetPassword(email);
    authError("If that email has an account, a reset link is on its way.");
  } catch (err) {
    authError(friendlyAuthError(err));
  }
}

// ---------- Account card on Profile ----------

const STATUS_TEXT = {
  "signed-out": "",
  "needs-login": "Log in again to keep syncing. Your catches are safe on this phone.",
  offline: "Offline. New catches will upload when you're back online.",
  syncing: "Syncing...",
  error: "",
  synced: "All catches saved to your account.",
};

function renderAccount() {
  const card = $("accountCard");
  if (!card) return;
  const status = Cloud.status();
  const acct = Cloud.account();
  $("dataHint").textContent = acct
    ? "Your catches are saved on this phone and in your account."
    : "Your catches are saved only on this phone. Export a backup now and then so you don't lose them.";

  if (status === "off") {
    card.innerHTML = `<div class="badge-name">Accounts are coming soon</div>
      <div class="catch-meta">For now everything is saved on this phone only.</div>`;
  } else if (!acct) {
    card.innerHTML = `<div class="badge-name">Save your catches to an account</div>
      <div class="catch-meta">Keep your catches, badges and stats on every phone, and add friends.</div>
      <div class="data-btns account-btns">
        <button type="button" class="primary" id="acctSignup">Make an account</button>
        <button type="button" class="ghost" id="acctSignin">Log in</button>
      </div>`;
    $("acctSignup").onclick = () => openAuth("signup");
    $("acctSignin").onclick = () => openAuth("signin");
  } else {
    const msg = status === "error" ? `Couldn't sync: ${Cloud.lastError}` : STATUS_TEXT[status];
    card.innerHTML = `<div class="badge-name">@${esc(acct.username || "you")}</div>
      <div class="catch-meta ${status === "error" ? "bad-text" : ""}" id="syncStatus">${esc(msg)}</div>
      <div class="data-btns account-btns">
        ${status === "needs-login" ? `<button type="button" class="primary" id="acctSignin">Log in</button>` : ""}
        ${status === "error" || status === "synced" ? `<button type="button" class="ghost" id="acctSync">Sync now</button>` : ""}
        <button type="button" class="ghost" id="acctSignout">Sign out</button>
        <button type="button" class="danger" id="acctDelete">Delete account</button>
      </div>`;
    if ($("acctSignin")) $("acctSignin").onclick = () => openAuth("signin");
    if ($("acctSync")) $("acctSync").onclick = () => Cloud.sync();
    $("acctSignout").onclick = onSignOut;
    $("acctDelete").onclick = onDeleteAccount;
  }
  if ($("view-friends").classList.contains("active")) renderFriendsGate();
}

async function onSignOut() {
  const waiting = await Cloud.pendingCount();
  const warn = waiting
    ? `${waiting} change${waiting === 1 ? " hasn't" : "s haven't"} uploaded yet and will be lost. Get online and wait for "All catches saved" to avoid this.\n\nSign out anyway?`
    : "Sign out? Your catches will be removed from this phone, and come back when you log in again.";
  if (!confirm(warn)) return;
  await Cloud.signOut();
  friendsCache = null;
  toast("Signed out.");
}

async function onDeleteAccount() {
  if (!Cloud.session) return toast("Log in first, then you can delete your account.");
  const name = Cloud.account().username;
  const typed = prompt(`This deletes @${name}, its photos and everything saved in it, for good. Friends lose you too. Your catches stay on this phone.\n\nType your username to confirm:`);
  if (typed == null) return;
  if (cleanUsername(typed) !== name) return toast("That doesn't match, so nothing was deleted.");
  try {
    await Cloud.deleteAccount();
    friendsCache = null;
    toast("Account deleted. Your catches are still on this phone.");
  } catch (err) {
    toast(`Couldn't delete the account: ${friendlyAuthError(err)}`);
  }
}

// ---------- Friends tab ----------

// Shows a message instead of the friends screen when friends can't be used yet. Returns true if usable.
function renderFriendsGate() {
  const gate = $("friendsGate");
  const status = Cloud.status();
  let html = "";
  if (status === "off") html = `<div class="card"><div class="badge-name">Friends are coming soon</div><div class="catch-meta">They need accounts, which aren't switched on yet.</div></div>`;
  else if (status === "signed-out") html = `<div class="card"><div class="badge-name">Make an account to add friends</div>
      <div class="catch-meta">See your friends' levels, badges and catches. They never see where you fish.</div>
      <div class="data-btns account-btns"><button type="button" class="primary" data-open-auth="signup">Make an account</button>
      <button type="button" class="ghost" data-open-auth="signin">Log in</button></div></div>`;
  else if (status === "needs-login") html = `<div class="card"><div class="badge-name">Log in again to see friends</div>
      <div class="data-btns account-btns"><button type="button" class="primary" data-open-auth="signin">Log in</button></div></div>`;
  else if (status === "offline") html = `<div class="card"><div class="badge-name">You're offline</div><div class="catch-meta">Friends need a connection.</div></div>`;
  gate.innerHTML = html;
  gate.querySelectorAll("[data-open-auth]").forEach((b) => b.addEventListener("click", () => openAuth(b.dataset.openAuth)));
  $("friendsMain").hidden = !!html;
  return !html;
}

async function renderFriends() {
  if (!renderFriendsGate()) return;
  const acct = Cloud.account();
  $("myCode").textContent = acct.friendCode || "";
  $("myName").textContent = acct.username ? `Your username is @${acct.username}. Share it or your code with friends.` : "";
  try {
    friendsCache = await Cloud.listFriends();
  } catch (err) {
    $("friendMsg").textContent = `Couldn't load friends: ${friendlyAuthError(err)}`;
    return;
  }
  const incoming = friendsCache.filter((f) => f.kind === "incoming");
  const outgoing = friendsCache.filter((f) => f.kind === "outgoing");
  const friends = friendsCache.filter((f) => f.kind === "friend");

  $("requestsBox").hidden = !incoming.length && !outgoing.length;
  $("requestList").innerHTML = [
    ...incoming.map((f) => `<li class="friend-row"><span class="catch-main"><span class="catch-name">@${esc(f.username)}</span>
        <span class="catch-meta">wants to be friends</span></span>
        <button type="button" class="primary small-btn" data-accept="${f.id}">Accept</button>
        <button type="button" class="ghost small-btn" data-decline="${f.id}">No</button></li>`),
    ...outgoing.map((f) => `<li class="friend-row"><span class="catch-main"><span class="catch-name">@${esc(f.username)}</span>
        <span class="catch-meta">request sent</span></span>
        <button type="button" class="ghost small-btn" data-cancel="${f.id}">Cancel</button></li>`),
  ].join("");

  $("friendList").innerHTML = friends.length
    ? friends.map((f) => {
      const s = f.summary || {};
      return `<li><button type="button" class="catch-row" data-friend="${f.id}">
        <span class="level-num small">${s.level || 1}</span>
        <span class="catch-main"><span class="catch-name">@${esc(f.username)}</span>
        <span class="catch-meta">${esc(s.title || LEVEL_TITLES[0])} · ${s.catches || 0} catches · ${s.species || 0} species</span></span>
      </button></li>`;
    }).join("")
    : `<li class="catch-meta">No friends yet. Add someone by their username or friend code.</li>`;

  const act = (sel, fn, done) => $("view-friends").querySelectorAll(sel).forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { await fn(b.dataset[Object.keys(b.dataset)[0]]); if (done) toast(done); } catch (err) { toast(friendlyAuthError(err)); }
    renderFriends();
  }));
  act("[data-accept]", (id) => Cloud.respond(id, true), "You're now friends.");
  act("[data-decline]", (id) => Cloud.respond(id, false));
  act("[data-cancel]", (id) => Cloud.removeFriend(id));
  $("friendList").querySelectorAll("[data-friend]").forEach((b) => b.addEventListener("click", () =>
    openFriend(friends.find((f) => f.id === b.dataset.friend))));
}

async function onAddFriend(e) {
  e.preventDefault();
  const target = $("friendTarget").value.trim();
  if (!target) return;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    const result = await Cloud.sendRequest(target);
    $("friendMsg").textContent = FRIEND_RESULT_TEXT[result] || "Done.";
    if (result === "sent" || result === "accepted") $("friendTarget").value = "";
  } catch (err) {
    $("friendMsg").textContent = friendlyAuthError(err);
  }
  btn.disabled = false;
  renderFriends();
}

async function copyCode() {
  const code = $("myCode").textContent;
  try {
    await navigator.clipboard.writeText(code);
    toast("Friend code copied.");
  } catch {
    toast(`Your friend code is ${code}`);
  }
}

// ---------- A friend's profile ----------

async function openFriend(f) {
  const d = $("friendDlg");
  const s = f.summary || {};
  const lv = levelFromExp(s.totalExp || 0);
  const badges = BADGES.filter((b) => (s.badges || []).includes(b.id));
  const top = s.topMethod && methodById(s.topMethod.id);
  const cells = [
    ["Catches", s.catches || 0],
    ["Species", s.species || 0],
    ["Total EXP", s.totalExp || 0],
    ["Released", s.releasedPct == null ? "–" : `${s.releasedPct}%`],
    ["Top method", top ? `${top.name} (${s.topMethod.n})` : "–"],
    ["Biggest", s.biggest ? `${s.biggest.lengthCm} cm ${speciesById(s.biggest.speciesId).name}` : "–"],
  ];
  d.innerHTML = `<div class="detail-inner">
      <div class="level-card friend-head">
        <div class="level-num">${s.level || lv.level}</div>
        <div class="level-info"><div class="level-title">@${esc(f.username)}</div><div class="catch-meta">${esc(s.title || lv.title)}</div></div>
      </div>
      <div class="stats">${cells.map(([k, v]) => `<div class="stat"><div class="stat-v">${esc(String(v))}</div><div class="stat-k">${k}</div></div>`).join("")}</div>
      <h3>Badges (${badges.length} of ${BADGES.length})</h3>
      <div class="chips">${badges.length ? badges.map((b) => `<span class="chip" title="${esc(b.desc)}">${esc(b.name)}</span>`).join("") : `<span class="catch-meta">No badges yet.</span>`}</div>
      <h3>Catches</h3>
      <ul class="catch-list" id="friendCatches"><li class="catch-meta">Loading...</li></ul>
      <div class="detail-btns friend-btns">
        <button type="button" class="danger small-btn" id="friendBlock">Block</button>
        <button type="button" class="ghost small-btn" id="friendRemove">Unfriend</button>
        <button type="button" class="primary" id="friendClose">Close</button>
      </div>
    </div>`;
  d.showModal();
  $("friendClose").onclick = () => d.close();
  $("friendRemove").onclick = async () => {
    if (!confirm(`Unfriend @${f.username}? You'll stop seeing each other's catches.`)) return;
    try { await Cloud.removeFriend(f.id); d.close(); renderFriends(); } catch (err) { toast(friendlyAuthError(err)); }
  };
  $("friendBlock").onclick = async () => {
    if (!confirm(`Block @${f.username}? You'll be unfriended and they won't be able to find you or send you requests.`)) return;
    try { await Cloud.block(f.id); d.close(); renderFriends(); toast(`@${f.username} is blocked.`); } catch (err) { toast(friendlyAuthError(err)); }
  };

  let catches;
  try {
    catches = scoreCatches(await Cloud.friendCatches(f.id)).reverse();
  } catch (err) {
    $("friendCatches").innerHTML = `<li class="catch-meta">Couldn't load catches: ${esc(friendlyAuthError(err))}</li>`;
    return;
  }
  const urls = await Cloud.friendPhotoUrls(f.id, catches.filter((c) => c.hasPhoto).slice(0, 50).map((c) => c.id));
  $("friendCatches").innerHTML = catches.length
    ? catches.map((c) => `<li class="catch-row friend-catch">
        <span class="thumb"${urls[c.id] ? ` style="background-image:url('${esc(urls[c.id])}')"` : ""}></span>
        <span class="catch-main">
          <span class="catch-name">${esc(speciesById(c.speciesId).name)}</span>
          <span class="catch-meta">${fmtDate(c.caughtAt)}${okLength(c) ? ` · ${c.lengthCm} cm` : ""}${okWeight(c) ? ` · ${c.weightKg} kg` : ""}</span>
          <span class="catch-meta">${[methodById(c.method) && methodById(c.method).name, c.bait, c.released ? "Released" : "Kept"].filter(Boolean).map(esc).join(" · ")}</span>
        </span>
        <span class="catch-exp">+${c.exp}</span>
      </li>`).join("")
    : `<li class="catch-meta">No catches yet.</li>`;
}
