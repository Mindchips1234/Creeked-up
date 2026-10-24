// Checks the database rules in supabase/setup.sql against a real Supabase.
// Skipped unless SUPABASE_TEST_URL and SUPABASE_TEST_KEY are set. Use a local test copy
// (see supabase/local/README.md), never the real project: this makes and deletes accounts.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const URL_ = process.env.SUPABASE_TEST_URL;
const KEY = process.env.SUPABASE_TEST_KEY;
const skip = !(URL_ && KEY) && "set SUPABASE_TEST_URL and SUPABASE_TEST_KEY to run";

const lib = skip ? null : new Function(`${fs.readFileSync(path.join(__dirname, "..", "vendor", "supabase", "supabase.js"), "utf8")}; return supabase;`)();
const client = () => lib.createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Date.now().toString(36);
const name = (n) => `${n}_${run}`.slice(0, 20);

async function signUp(n, meta = { age_13_plus: true }) {
  const c = client();
  const { data, error } = await c.auth.signUp({ email: `${n}-${run}@example.com`, password: "test-password-123", options: { data: { username: name(n), ...meta } } });
  return { c, data, error, id: data && data.user && data.user.id };
}
const rpc = async (c, fn, args) => {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  return data;
};

test("database rules", { skip }, async (t) => {
  let alice, bob, carol;

  await t.test("sign up needs the 13+ confirmation and a valid, free username", async () => {
    const kid = await signUp("kid", { age_13_plus: false });
    assert.ok(kid.error, "under-13 sign up should fail");
    const bad = await signUp("x", { age_13_plus: true, username: "no spaces!" });
    assert.ok(bad.error, "bad username should fail");
    alice = await signUp("alice");
    bob = await signUp("bob");
    carol = await signUp("carol");
    for (const u of [alice, bob, carol]) assert.ifError(u.error);
    assert.strictEqual(await rpc(client(), "username_available", { name: name("alice") }), false);
    assert.strictEqual(await rpc(client(), "username_available", { name: name("ALICE") }), false);
    const dupe = await client().auth.signUp({ email: `dupe-${run}@example.com`, password: "test-password-123", options: { data: { username: name("alice"), age_13_plus: true } } });
    assert.ok(dupe.error, "taken username should fail");
  });

  await t.test("your catches are yours alone", async () => {
    const { error } = await alice.c.from("catches").upsert([
      { user_id: alice.id, id: "c1", data: { id: "c1", speciesId: "walleye", lengthCm: 50, caughtAt: "2026-10-20T12:00:00.000Z", lat: 44.123456, lng: -79.654321, accuracyM: 5, notes: "the secret rock pile", photoHash: "abc", hasPhoto: true, released: true, method: "lure", bait: "jig" } },
      { user_id: alice.id, id: "c2", data: { id: "c2", speciesId: "pike", caughtAt: "2026-10-21T12:00:00.000Z", lat: null, lng: null } },
    ], { onConflict: "user_id,id" });
    assert.ifError(error);
    const mine = await alice.c.from("catches").select("id, updated_at");
    assert.strictEqual(mine.data.length, 2);
    assert.ok(mine.data[0].updated_at, "server sets updated_at");
    const peek = await bob.c.from("catches").select("*").eq("user_id", alice.id);
    assert.strictEqual(peek.data.length, 0);
    const sneak = await bob.c.from("catches").insert({ user_id: alice.id, id: "fake", data: {} });
    assert.ok(sneak.error, "can't add catches to someone else");
    const edit = await bob.c.from("catches").update({ data: {} }).eq("user_id", alice.id).select();
    assert.strictEqual((edit.data || []).length, 0);
    const anon = await client().from("catches").select("*");
    assert.ok(anon.error || anon.data.length === 0);
  });

  await t.test("profiles are private, and usernames can't be changed", async () => {
    const peek = await bob.c.from("profiles").select("*").eq("id", alice.id);
    assert.strictEqual(peek.data.length, 0);
    const own = await alice.c.from("profiles").select("username, friend_code").eq("id", alice.id).single();
    assert.strictEqual(own.data.username, name("alice"));
    assert.match(own.data.friend_code, /^[A-Z2-9]{8}$/);
    alice.code = own.data.friend_code;
    const rename = await alice.c.from("profiles").update({ username: "hacker" }).eq("id", alice.id);
    assert.ok(rename.error, "username update should be refused");
    const sum = await alice.c.from("profiles").update({ summary: { level: 3, catches: 2 } }).eq("id", alice.id);
    assert.ifError(sum.error);
  });

  await t.test("no catches or stats until a request is accepted", async () => {
    assert.strictEqual((await rpc(bob.c, "friend_catches", { friend: alice.id })).length, 0);
    assert.strictEqual(await rpc(bob.c, "send_friend_request", { target: name("ALICE") }), "sent");
    assert.strictEqual(await rpc(bob.c, "send_friend_request", { target: name("alice") }), "already_sent");
    assert.strictEqual(await rpc(bob.c, "send_friend_request", { target: name("bob") }), "self");
    assert.strictEqual(await rpc(bob.c, "send_friend_request", { target: "nobody_here_xyz" }), "not_found");
    const aliceView = await rpc(alice.c, "list_friends");
    assert.deepStrictEqual(aliceView.map((f) => [f.username, f.kind]), [[name("bob"), "incoming"]]);
    const bobView = await rpc(bob.c, "list_friends");
    assert.strictEqual(bobView[0].kind, "outgoing");
    assert.deepStrictEqual(bobView[0].summary, {});
    assert.strictEqual((await rpc(bob.c, "friend_catches", { friend: alice.id })).length, 0);
    // Bob can't accept his own request.
    await rpc(bob.c, "respond_friend_request", { other: alice.id, accept: true });
    assert.strictEqual((await rpc(bob.c, "list_friends"))[0].kind, "outgoing");
  });

  await t.test("friends see catches and stats, never location or notes", async () => {
    await rpc(alice.c, "respond_friend_request", { other: bob.id, accept: true });
    const view = await rpc(bob.c, "list_friends");
    assert.strictEqual(view[0].kind, "friend");
    assert.strictEqual(view[0].summary.level, 3);
    const rows = await rpc(bob.c, "friend_catches", { friend: alice.id });
    assert.strictEqual(rows.length, 2);
    const walleye = rows.find((r) => r.id === "c1").data;
    assert.strictEqual(walleye.speciesId, "walleye");
    assert.strictEqual(walleye.lengthCm, 50);
    assert.strictEqual(walleye.bait, "jig");
    assert.strictEqual(walleye.hasLocation, true);
    assert.strictEqual(rows.find((r) => r.id === "c2").data.hasLocation, false);
    const all = JSON.stringify(rows);
    for (const secret of ["44.12", "79.65", "accuracyM", "rock pile", "notes", "photoHash", "\"lat\"", "\"lng\""]) {
      assert.ok(!all.includes(secret), `friend saw ${secret}`);
    }
    assert.strictEqual((await rpc(carol.c, "friend_catches", { friend: alice.id })).length, 0, "non-friend sees nothing");
  });

  await t.test("photos: friends can look, others can't, nobody can write into your folder", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const up = await alice.c.storage.from("photos").upload(`${alice.id}/c1.jpg`, jpeg, { contentType: "image/jpeg", upsert: true });
    assert.ifError(up.error);
    const bobGet = await bob.c.storage.from("photos").download(`${alice.id}/c1.jpg`);
    assert.ifError(bobGet.error);
    const urls = await bob.c.storage.from("photos").createSignedUrls([`${alice.id}/c1.jpg`], 60);
    assert.ok(urls.data[0].signedUrl, "friend gets a link");
    const carolGet = await carol.c.storage.from("photos").download(`${alice.id}/c1.jpg`);
    assert.ok(carolGet.error, "stranger can't download");
    const bobPut = await bob.c.storage.from("photos").upload(`${alice.id}/evil.jpg`, jpeg, { contentType: "image/jpeg" });
    assert.ok(bobPut.error, "can't upload into someone else's folder");
    const bobDel = await bob.c.storage.from("photos").remove([`${alice.id}/c1.jpg`]);
    assert.strictEqual((bobDel.data || []).length, 0, "can't delete someone else's photo");
    const notJpeg = await alice.c.storage.from("photos").upload(`${alice.id}/x.png`, Buffer.from("hi"), { contentType: "text/html" });
    assert.ok(notJpeg.error, "only JPEG photos");
  });

  await t.test("friend codes work, and blocking hides you", async () => {
    assert.strictEqual(await rpc(carol.c, "send_friend_request", { target: alice.code.toLowerCase() }), "sent");
    await rpc(alice.c, "block_user", { other: carol.id });
    assert.ok(!(await rpc(alice.c, "list_friends")).some((f) => f.id === carol.id), "request removed");
    assert.strictEqual(await rpc(carol.c, "send_friend_request", { target: name("alice") }), "not_found");
  });

  await t.test("unfriending removes access", async () => {
    await rpc(alice.c, "remove_friend", { other: bob.id });
    assert.strictEqual((await rpc(bob.c, "friend_catches", { friend: alice.id })).length, 0);
    const photo = await bob.c.storage.from("photos").download(`${alice.id}/c1.jpg`);
    assert.ok(photo.error, "photo access ends too");
  });

  await t.test("signed-out visitors can't use friend features", async () => {
    const { error } = await client().rpc("list_friends");
    assert.ok(error);
  });

  await t.test("deleting an account deletes its data", async () => {
    assert.strictEqual(await rpc(bob.c, "send_friend_request", { target: name("alice") }), "sent");
    await rpc(alice.c, "delete_my_account");
    // Alice's session is now for an account that doesn't exist; Bob's request to her is gone.
    assert.strictEqual((await rpc(bob.c, "list_friends")).length, 0);
    assert.strictEqual(await rpc(client(), "username_available", { name: name("alice") }), true);
    await rpc(bob.c, "delete_my_account");
    await rpc(carol.c, "delete_my_account");
  });
});
