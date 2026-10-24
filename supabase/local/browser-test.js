// End-to-end check of accounts, sync and friends in a real browser against the local test copy
// of Supabase (see README.md here). Needs Playwright and a photo file:
//   python3 -m http.server 8000   (from the repo root, in another terminal)
//   SUPABASE_TEST_KEY=<local anon key> PHOTO=/path/to/any.jpg node supabase/local/browser-test.js
const { chromium } = require("playwright");
const assert = require("assert");

const APP = process.env.APP_URL || "http://localhost:8000/";
const KEY = process.env.SUPABASE_TEST_KEY;
const PHOTO = process.env.PHOTO;
const run = Date.now().toString(36).slice(-6);
const errors = [];

async function device(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, geolocation: { latitude: 44.5, longitude: -78.3 }, permissions: ["geolocation"], serviceWorkers: "block" });
  await ctx.route("**/js/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: `const CLOUD_CONFIG = { url: "http://localhost:54321", key: "${KEY}" };` }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
  page.on("dialog", (d) => (d.type() === "prompt" ? d.accept(page.promptAnswer || "") : d.accept()));
  await page.goto(APP);
  await page.click("#intro");
  return { ctx, page };
}

const tab = (page, name) => page.click(`.tabs button[data-view="${name}"]`);
const syncText = (page) => page.textContent("#syncStatus");
async function waitSynced(page) {
  await page.waitForFunction(async () => !Cloud.busy && (await Cloud.pendingCount()) === 0, null, { timeout: 15000 });
  await tab(page, "profile");
  await page.waitForFunction(() => /All catches saved/.test((document.getElementById("syncStatus") || {}).textContent || ""), null, { timeout: 15000 });
}

async function logCatch(page, species, length, withPhoto) {
  await tab(page, "log");
  if (withPhoto) await page.setInputFiles("#photo", PHOTO);
  await page.selectOption("#species", species);
  await page.fill("#length", String(length));
  await page.fill("#notes", "secret spot behind the island");
  await page.click("#locBtn");
  await page.waitForFunction(() => /Location added/.test(document.getElementById("locStatus").textContent));
  await page.click('#catchForm button[type="submit"]');
  await page.waitForSelector("#toast:not([hidden])");
  await page.waitForTimeout(200);
  if (await page.isVisible("#levelUp")) await page.click("#levelUpClose");
}

async function signUp(page, user, year = "1990") {
  await tab(page, "profile");
  await page.click("#acctSignup");
  await page.fill("#suName", user);
  await page.fill("#suEmail", `${user}@example.com`);
  await page.fill("#suPass", "test-password-123");
  await page.selectOption("#suMonth", "5");
  await page.selectOption("#suYear", year);
  await page.click('#signupForm button[type="submit"]');
}

async function logIn(page, user) {
  await tab(page, "profile");
  await page.click("#acctSignin");
  await page.fill("#siEmail", `${user}@example.com`);
  await page.fill("#siPass", "test-password-123");
  await page.click('#signinForm button[type="submit"]');
}

(async () => {
  assert.ok(KEY && PHOTO, "set SUPABASE_TEST_KEY and PHOTO");
  const browser = await chromium.launch();
  const alice = `alice_${run}`, bob = `bob_${run}`;
  const step = (s) => console.log(`✓ ${s}`);

  // Phone 1: catches logged before there's an account get added to it.
  const p1 = await device(browser, "phone1");
  await logCatch(p1.page, "walleye", 50, true);
  await logCatch(p1.page, "northern-pike", 70, false);
  await signUp(p1.page, alice);
  await waitSynced(p1.page);
  step("sign up moves the 2 catches already on the phone into the account");

  // Under-13 is turned away, and the form stays blocked on that phone.
  const kid = await device(browser, "kid");
  await signUp(kid.page, `kid_${run}`, String(new Date().getFullYear() - 10));
  assert.ok(await kid.page.isVisible("#ageBlock"));
  assert.ok(await kid.page.isHidden("#signupForm"));
  await kid.ctx.close();
  step("under-13 sign up is blocked");

  // Phone 2: logging in brings the catches and the photo.
  const p2 = await device(browser, "phone2");
  await logIn(p2.page, alice);
  await waitSynced(p2.page);
  await tab(p2.page, "catches");
  await p2.page.waitForFunction(() => document.querySelectorAll("#catchList .catch-row").length === 2);
  await p2.page.waitForFunction(() => [...document.querySelectorAll("#catchList .thumb")].some((t) => t.style.backgroundImage.startsWith("url(")), null, { timeout: 10000 });
  const lvl1 = await p1.page.textContent("#miniLevel"), lvl2 = await p2.page.textContent("#miniLevel");
  assert.strictEqual(lvl2, lvl1, "same level on both phones");
  step(`log in on a second phone shows both catches, the photo, and the same level (${lvl2})`);

  // Offline on phone 2: still works, then uploads when back online.
  await p2.ctx.setOffline(true);
  await logCatch(p2.page, "smallmouth-bass", 40, false);
  await tab(p2.page, "profile");
  assert.match(await syncText(p2.page), /Offline/);
  await p2.ctx.setOffline(false);
  await p2.page.evaluate(() => window.dispatchEvent(new Event("online")));
  await waitSynced(p2.page);
  await p1.page.evaluate(() => Cloud.sync());
  await tab(p1.page, "catches");
  await p1.page.waitForFunction(() => document.querySelectorAll("#catchList .catch-row").length === 3);
  step("a catch logged offline uploads later and shows up on the other phone");

  // Delete on phone 1 reaches phone 2.
  await p1.page.click("#catchList .catch-row");
  await p1.page.click("#delBtn");
  await p1.page.waitForFunction(() => document.querySelectorAll("#catchList .catch-row").length === 2);
  await waitSynced(p1.page);
  await p2.page.evaluate(() => Cloud.sync());
  await p2.page.waitForTimeout(2000);
  console.log(await p2.page.evaluate(async () => JSON.stringify({ sync: JSON.parse(localStorage.getItem("creeked-up:sync")).cursor, busy: Cloud.busy, err: Cloud.lastError, local: (await Store.allCatches()).map((c) => [c.id, c._synced]) })));
  await tab(p2.page, "catches");
  await p2.page.waitForFunction(() => document.querySelectorAll("#catchList .catch-row").length === 2);
  step("deleting a catch on one phone deletes it on the other");

  // Bob adds Alice; Alice accepts; Bob sees her catches but not where or her notes.
  const p3 = await device(browser, "bob");
  await signUp(p3.page, bob);
  await waitSynced(p3.page);
  await tab(p3.page, "friends");
  await p3.page.fill("#friendTarget", alice.toUpperCase());
  await p3.page.click('#addFriendForm button[type="submit"]');
  await p3.page.waitForFunction(() => /request sent/i.test(document.getElementById("friendMsg").textContent));
  await tab(p1.page, "friends");
  await p1.page.waitForSelector("[data-accept]");
  await p1.page.click("[data-accept]");
  await p1.page.waitForFunction((b) => document.getElementById("friendList").textContent.includes(b), bob);
  step("friend request by username, accepted");

  await tab(p3.page, "profile");
  await tab(p3.page, "friends");
  await p3.page.waitForSelector("[data-friend]");
  await p3.page.click("[data-friend]");
  await p3.page.waitForFunction(() => document.querySelectorAll("#friendCatches .friend-catch").length === 2);
  const dlg = await p3.page.textContent("#friendDlg");
  assert.ok(!/secret spot|island|44\.5|78\.3/.test(dlg), "no notes or location shown");
  const leaked = await p3.page.evaluate(async (id) => JSON.stringify(await Cloud.friendCatches(id)), (await p3.page.getAttribute("[data-friend]", "data-friend")));
  assert.ok(!/secret|island|44\.5|-78\.3/.test(leaked), "no notes or location in the data either");
  assert.match(dlg, /Badges \([1-9]/);
  await p3.page.waitForFunction(() => [...document.querySelectorAll("#friendCatches .thumb")].some((t) => t.style.backgroundImage.startsWith("url(")), null, { timeout: 10000 });
  await p3.page.click("#friendClose");
  step("friend's profile shows level, stats, badges, catches and photo, with no location or notes");

  // Sign out clears the phone; logging back in restores it.
  await tab(p2.page, "profile");
  await p2.page.click("#acctSignout");
  await tab(p2.page, "catches");
  await p2.page.waitForFunction(() => document.querySelectorAll("#catchList .catch-row").length === 0);
  await logIn(p2.page, alice);
  await waitSynced(p2.page);
  await tab(p2.page, "catches");
  await p2.page.waitForFunction(() => document.querySelectorAll("#catchList .catch-row").length === 2);
  step("sign out clears the phone, logging back in restores everything");

  // Delete Bob's account.
  p3.page.promptAnswer = bob;
  await tab(p3.page, "profile");
  await p3.page.click("#acctDelete");
  await p3.page.waitForSelector("#acctSignup");
  await tab(p1.page, "home");
  await tab(p1.page, "friends");
  await p1.page.waitForFunction(() => /No friends yet/.test(document.getElementById("friendList").textContent));
  step("deleting an account removes it from friends' lists");

  await p1.page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/friends.png` : "/dev/null" });
  await browser.close();
  if (errors.length) { console.error("Browser errors:\n" + errors.join("\n")); process.exit(1); }
  console.log("All browser checks passed.");
})().catch((e) => { console.error(e); console.error(errors.join("\n")); process.exit(1); });
