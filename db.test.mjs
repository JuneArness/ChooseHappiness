// Database security tests. Runs every migration + the seed in PGlite (real Postgres compiled to
// WebAssembly) with a stand-in for Supabase's auth schema, then checks the privacy, moderation,
// messaging and admin rules as different users. Run: npm run test:db
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = new URL("../supabase/", import.meta.url);
const U = { admin: "a0000000-0000-4000-8000-000000000001", mod: "a0000000-0000-4000-8000-000000000002",
  alex: "a0000000-0000-4000-8000-000000000003", sam: "a0000000-0000-4000-8000-000000000004", jo: "a0000000-0000-4000-8000-000000000005" };
let db;

async function as(uid, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => Object.values((await rows(sql, params))[0] ?? {})[0];
const call = (uid, fn, args = []) => as(uid, () => one(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args));
const code = async (p) => { try { await p; return "NO_ERROR"; } catch (e) { return String(e.message).split("|")[0]; } };

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync(new URL("sim/shim.sql", root), "utf8"));
  for (const f of readdirSync(new URL("migrations/", root)).sort()) await db.exec(readFileSync(new URL(`migrations/${f}`, root), "utf8"));
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8")); // idempotent
  for (const [k, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, `${k}@example.com`, JSON.stringify({ display_name: k[0].toUpperCase() + k.slice(1) })]);
  }
  await db.exec(`update public.profiles set role = 'admin' where id = '${U.admin}'; update public.profiles set role = 'moderator' where id = '${U.mod}';`);
});

test("seed: launch content library loaded", async () => {
  assert.equal(await one("select count(*)::int from public.articles where kind = 'article' and pillar = 'wellness'"), 15);
  assert.equal(await one("select count(*)::int from public.articles where kind = 'article' and pillar = 'perspective'"), 8);
  assert.equal(await one("select count(*)::int from public.articles where kind = 'exercise'"), 7);
  assert.equal(await one("select count(*)::int from public.reflection_prompts"), 7);
  assert.equal(await one("select count(*)::int from public.forum_categories"), 5);
  assert.equal(await one("select count(*)::int from public.journeys"), 3);
  for (const s of ["manifesto", "about", "get-help", "research", "privacy", "terms", "guidelines"]) assert.ok(await one("select count(*)::int from public.pages where slug = $1", [s]), s);
  assert.equal(await one("select count(*)::int from public.articles where jsonb_array_length(sources) = 0"), 0, "every article cites sources");
});

test("sign-up creates a member profile; peer chat is off by default", async () => {
  const p = await rows(`select display_name, role, status from public.profiles where id = '${U.alex}'`);
  assert.deepEqual(p[0], { display_name: "Alex", role: "member", status: "active" });
  assert.equal(await one("select peer_chat_enabled from public.site_settings"), false);
  assert.equal(await one("select support_status from public.site_settings"), "offline");
});

test("signed-out visitors read published content but no member data", async () => {
  const arts = await call(null, "list_articles");
  assert.equal(arts.length, 30);
  assert.ok(await call(null, "get_page", ["get-help"]));
  assert.ok((await call(null, "list_categories")).length === 5);
  for (const t of ["journal_entries", "threads", "messages", "profiles", "reports"]) {
    assert.equal(await code(as(null, () => rows(`select * from public.${t}`))), "permission denied for table " + t, t);
  }
  assert.equal(await code(call(null, "list_threads")), "AUTH");
  assert.equal(await code(call(null, "my_journal")), "AUTH");
});

test("drafts are hidden from the public but previewable by staff", async () => {
  await db.exec("update public.articles set published = false where slug = 'burnout-signs-and-recovery'");
  assert.equal(await call(null, "get_article", ["burnout-signs-and-recovery"]), null);
  assert.equal(await call(U.alex, "get_article", ["burnout-signs-and-recovery"]), null);
  assert.ok(await call(U.admin, "get_article", ["burnout-signs-and-recovery"]));
  assert.equal((await call(U.admin, "list_articles", ["", null, null, null, null, true])).length, 30);
  assert.equal((await call(U.admin, "list_articles")).length, 29);
  await db.exec("update public.articles set published = true where slug = 'burnout-signs-and-recovery'");
});

test("journal entries are private: not even administrators can read them", async () => {
  const e = await call(U.alex, "save_journal_entry", [JSON.stringify({ title: "Tuesday", body: "A private thought" })]);
  assert.equal((await call(U.alex, "my_journal")).length, 1);
  assert.equal((await call(U.alex, "my_journal", ["private"])).length, 1);
  assert.equal((await call(U.sam, "my_journal")).length, 0);
  assert.equal((await call(U.admin, "my_journal")).length, 0);
  assert.equal((await as(U.admin, () => rows("select * from public.journal_entries"))).length, 0);
  assert.equal((await as(U.mod, () => rows("select * from public.journal_entries"))).length, 0);
  // Others can't edit or delete it, even by guessing the id.
  assert.equal(await code(call(U.sam, "save_journal_entry", [JSON.stringify({ id: e.id, title: "x", body: "hijack" })])), "NOT_FOUND");
  assert.equal(await code(call(U.admin, "delete_journal_entry", [e.id])), "NOT_FOUND");
  assert.equal((await as(U.sam, () => rows(`update public.journal_entries set body = 'x' where id = '${e.id}' returning id`))).length, 0);
  // Nobody can plant an entry in someone else's journal.
  assert.notEqual(await code(as(U.sam, () => rows(`insert into public.journal_entries (user_id, body) values ('${U.alex}', 'planted')`))), "NO_ERROR");
  // Admin dashboard numbers never include journals.
  assert.ok(!JSON.stringify(await call(U.admin, "admin_stats")).includes("journal"));
  await call(U.alex, "delete_journal_entry", [e.id]);
  assert.equal(await one(`select count(*)::int from public.journal_entries where id = '${e.id}'`), 0, "deleted permanently");
});

test("members can't promote themselves or write tables directly", async () => {
  assert.equal((await as(U.alex, () => rows(`update public.profiles set role = 'admin' where id = '${U.alex}' returning id`))).length, 0);
  const me = await call(U.alex, "update_my_profile", [JSON.stringify({ display_name: "Alex R", role: "admin", status: "active" })]);
  assert.equal(me.role, "member");
  assert.equal(me.display_name, "Alex R");
  assert.notEqual(await code(as(U.alex, () => rows("insert into public.threads (category_slug, author_id, title, body) values ('everyday-encouragement', null, 'sneaky', 'skip review')"))), "NO_ERROR");
  assert.notEqual(await code(as(U.alex, () => rows("insert into public.moderation_log (action) values ('fake')"))), "NO_ERROR");
  assert.equal(await code(call(U.alex, "set_user_role", [U.alex, "admin"])), "FORBIDDEN");
  assert.equal(await code(call(U.mod, "set_user_role", [U.mod, "admin"])), "FORBIDDEN");
  assert.equal(await code(call(U.mod, "admin_save_settings", [JSON.stringify({ peer_chat_enabled: true })])), "FORBIDDEN");
  assert.equal(await code(call(U.alex, "mod_queue")), "FORBIDDEN");
  assert.equal(await code(call(U.alex, "admin_stats")), "FORBIDDEN");
  assert.equal(await code(as(U.alex, () => rows("select public._log('x','y','z','w')"))), "permission denied for function _log");
});

let threadId;
test("a new member's first post waits for review; staff approval publishes it", async () => {
  const r = await call(U.alex, "create_thread", ["everyday-encouragement", "Small wins this week", "I finally went for a walk every day."]);
  assert.equal(r.status, "pending"); assert.equal(r.hold_reason, "first_post");
  threadId = r.id;
  assert.equal(await call(U.sam, "get_thread", [threadId]), null, "others can't see a pending post");
  assert.equal((await call(U.alex, "get_thread", [threadId])).status, "pending", "author sees it waiting");
  assert.equal((await call(U.mod, "mod_queue")).pending_threads.length, 1);
  assert.ok((await call(U.mod, "my_notifications")).some((n) => n.kind === "review"));
  await call(U.mod, "moderate_content", ["thread", threadId, "approve", ""]);
  assert.equal((await call(U.sam, "get_thread", [threadId])).title, "Small wins this week");
  assert.ok((await call(U.alex, "my_notifications")).some((n) => n.text.includes("now visible")));
  // Later posts from an approved member publish straight away.
  const r2 = await call(U.alex, "create_thread", ["gratitude-reflection", "Morning light", "Grateful for coffee on the porch."]);
  assert.equal(r2.status, "published");
});

test("posts mentioning self-harm are held for human review and flagged urgent", async () => {
  const r = await call(U.alex, "create_thread", ["stress-life-challenges", "Rough night", "Some days I think about self-harm."]);
  assert.equal(r.status, "pending"); assert.equal(r.hold_reason, "safety");
  assert.ok((await call(U.admin, "my_notifications")).some((n) => n.kind === "review_urgent"));
  assert.ok((await call(U.admin, "admin_stats")).urgent_reports >= 1);
  assert.equal(await call(U.sam, "get_thread", [r.id]), null);
  // Editing a published post to add such language also sends it back for review.
  const t = await call(U.alex, "create_thread", ["everyday-encouragement", "Checking in", "Hello all"]);
  const e = await call(U.alex, "edit_thread", [t.id, "Checking in", "Honestly I want to die some days", ""]);
  assert.equal(e.status, "pending");
});

test("replies notify the author; members can only edit or delete their own", async () => {
  await call(U.mod, "moderate_content", ["thread", (await call(U.sam, "create_thread", ["everyday-encouragement", "Hi all", "First post from Sam"])).id, "approve", ""]);
  const r = await call(U.sam, "create_reply", [threadId, "Love this, well done!"]);
  assert.equal(r.status, "published");
  assert.ok((await call(U.alex, "my_notifications")).some((n) => n.kind === "reply"));
  assert.equal((await call(U.alex, "get_thread", [threadId])).reply_count, 1);
  assert.equal(await code(call(U.alex, "edit_reply", [r.id, "edited by someone else"])), "FORBIDDEN");
  assert.equal(await code(call(U.alex, "delete_my_reply", [r.id])), "FORBIDDEN");
  assert.equal(await code(call(U.sam, "edit_thread", [threadId, "x", "y"])), "FORBIDDEN");
  assert.equal(await call(U.sam, "toggle_reaction", ["thread", threadId, "support"]), true);
  assert.equal((await call(U.alex, "get_thread", [threadId])).reactions.counts.support, 1);
});

test("rate limits stop rapid-fire posting", async () => {
  const before = await one(`select count(*)::int from public.threads where author_id = '${U.alex}' and created_at > now() - interval '1 hour'`);
  let last = "NO_ERROR";
  for (let i = before; i < 6; i++) last = await code(call(U.alex, "create_thread", ["everyday-encouragement", `Post ${i}`, "Hello"]));
  assert.equal(last, "RATE_LIMIT");
});

test("blocking hides content and stops replies and messages", async () => {
  await call(U.alex, "set_block", [U.sam, "block"]);
  const t = await call(U.alex, "get_thread", [threadId]);
  assert.equal(t.replies.length, 0, "Sam's reply is hidden from Alex");
  assert.ok(!(await call(U.alex, "list_threads")).some((x) => x.author.id === U.sam));
  assert.equal(await code(call(U.sam, "create_reply", [threadId, "can I still reply?"])), "FORBIDDEN");
  await db.exec("update public.site_settings set peer_chat_enabled = true; update public.profiles set allow_peer_messages = true;");
  assert.equal(await code(call(U.sam, "start_peer_conversation", [U.alex, "hey"])), "UNAVAILABLE");
  assert.equal(await code(call(U.alex, "set_block", [U.mod, "block"])), "INVALID", "moderators can be muted, not blocked");
  await call(U.alex, "set_block", [U.sam, ""]);
  assert.equal((await call(U.alex, "get_thread", [threadId])).replies.length, 1);
});

test("reports: private to the reporter and staff; resolving is logged", async () => {
  const thr = await call(U.alex, "get_thread", [threadId]);
  const rid = await call(U.jo, "report_content", ["reply", thr.replies[0].id, "harassment", "unkind"]);
  assert.equal(await call(U.jo, "report_content", ["reply", thr.replies[0].id, "harassment", "again"]), rid, "duplicate report reuses the open one");
  assert.equal((await as(U.alex, () => rows("select * from public.reports"))).length, 0);
  assert.equal((await as(U.jo, () => rows("select * from public.reports"))).length, 1);
  assert.equal((await call(U.mod, "mod_queue")).reports.length, 1);
  const safety = await call(U.jo, "report_content", ["thread", threadId, "safety", "worried about them"]);
  assert.equal(await one(`select priority from public.reports where id = '${safety}'`), "high");
  await call(U.mod, "resolve_report", [rid, "dismissed", "Friendly banter"]);
  const log = await call(U.mod, "mod_log");
  assert.ok(log.some((l) => l.action === "report_dismissed"));
  assert.equal((await as(U.alex, () => rows("select * from public.moderation_log"))).length, 0, "members can't read the audit log");
  assert.equal(await code(call(U.alex, "resolve_report", [safety, "resolved", ""])), "FORBIDDEN");
});

test("removing content hides it, notifies the author, and can be appealed", async () => {
  const t = await call(U.sam, "create_thread", ["everyday-encouragement", "Buy my stuff", "spam spam"]);
  await call(U.mod, "moderate_content", ["thread", t.id, "remove", "Selling is not allowed"]);
  assert.equal(await call(U.alex, "get_thread", [t.id]), null);
  assert.ok((await call(U.sam, "my_notifications")).some((n) => n.kind === "moderation" && n.text.includes("Selling")));
  assert.equal(await code(call(U.alex, "moderate_content", ["thread", t.id, "restore", ""])), "FORBIDDEN");
  const ap = await call(U.sam, "submit_appeal", ["Removed post", "I was sharing a free resource, not selling."]);
  assert.equal((await call(U.mod, "mod_queue")).appeals.length, 1);
  await call(U.mod, "handle_appeal", [ap, "reversed", "Thanks for explaining"]);
  assert.ok((await call(U.sam, "my_appeals"))[0].status === "reversed");
});

test("suspensions stop posting but not reading or journaling; only admins ban", async () => {
  await call(U.mod, "set_user_status", [U.jo, "suspended", 3, "Cooling off"]);
  assert.equal(await code(call(U.jo, "create_thread", ["everyday-encouragement", "Hello", "Hi"])), "SUSPENDED");
  assert.ok(Array.isArray(await call(U.jo, "list_threads")));
  assert.ok(await call(U.jo, "save_journal_entry", [JSON.stringify({ body: "still mine" })]));
  assert.equal(await code(call(U.mod, "set_user_status", [U.jo, "banned", null, "x"])), "FORBIDDEN");
  assert.equal(await code(call(U.mod, "set_user_status", [U.admin, "suspended", 1, "x"])), "FORBIDDEN");
  // Suspension ends automatically.
  await db.exec(`update public.profiles set suspended_until = now() - interval '1 minute' where id = '${U.jo}'`);
  assert.equal(await code(call(U.jo, "create_reply", [threadId, "back again"])), "NO_ERROR");
  assert.equal(await one(`select status from public.profiles where id = '${U.jo}'`), "active");
});

test("support chat: member and staff only; respects owner availability", async () => {
  const c = await call(U.alex, "start_support_conversation", ["Login help", "I can't reset my password"]);
  assert.equal((await call(U.admin, "support_inbox")).length, 1);
  assert.equal(await call(U.sam, "get_conversation", [c.id]), null, "other members can't read it");
  await call(U.mod, "send_message", [c.id, "Happy to help. Try the reset link on the sign-in page."]);
  const conv = await call(U.alex, "get_conversation", [c.id]);
  assert.equal(conv.messages.length, 2);
  assert.equal(conv.messages[1].from_staff, true);
  assert.ok((await call(U.alex, "my_notifications")).some((n) => n.kind === "message"));
  assert.equal(await code(call(U.sam, "send_message", [c.id, "butting in"])), "FORBIDDEN");
  await db.exec("update public.site_settings set support_status = 'unavailable'");
  assert.equal(await code(call(U.alex, "start_support_conversation", ["x", "y"])), "UNAVAILABLE");
  await db.exec("update public.site_settings set support_status = 'offline'");
  const risky = await call(U.alex, "start_support_conversation", ["", "I want to end my life"]);
  assert.equal(risky.high_risk, true, "the app shows crisis resources right away");
});

test("peer chat: private between members; staff see a message only when reported, and that view is logged", async () => {
  await db.exec("update public.site_settings set peer_chat_enabled = true; update public.profiles set allow_peer_messages = true;");
  const c = await call(U.alex, "start_peer_conversation", [U.sam, "Hi Sam, thanks for the reply"]);
  assert.equal((await call(U.sam, "get_conversation", [c.id])).messages.length, 1);
  assert.equal(await call(U.admin, "get_conversation", [c.id]), null, "admins can't browse private messages");
  assert.equal((await as(U.mod, () => rows(`select * from public.messages where conversation_id = '${c.id}'`))).length, 0);
  assert.equal(await code(call(U.jo, "send_message", [c.id, "hi"])), "FORBIDDEN");
  const msg = (await call(U.sam, "get_conversation", [c.id])).messages[0];
  const rid = await call(U.sam, "report_content", ["message", msg.id, "harassment", ""]);
  assert.equal(await code(call(U.jo, "report_content", ["message", msg.id, "spam", ""])), "NOT_FOUND", "non-members can't report (or probe) it");
  const view = await call(U.mod, "get_reported_target", [rid]);
  assert.equal(view.body, "Hi Sam, thanks for the reply");
  assert.ok((await call(U.mod, "mod_log")).some((l) => l.action === "view_reported_message"));
  await call(U.mod, "moderate_content", ["message", msg.id, "remove", "test"]);
  assert.equal((await call(U.sam, "get_conversation", [c.id])).messages[0].body, "", "removed text is hidden");
  await db.exec("update public.site_settings set peer_chat_enabled = false");
  assert.equal(await code(call(U.alex, "start_peer_conversation", [U.sam, "hi"])), "UNAVAILABLE");
  await db.exec(`update public.profiles set allow_peer_messages = false where id = '${U.jo}'`);
});

test("admin can manage content, settings and roles; partial settings saves keep other values", async () => {
  const s = await call(U.admin, "admin_save_settings", [JSON.stringify({ support_hours: "Weekdays 9-5 ET" })]);
  assert.equal(s.support_hours, "Weekdays 9-5 ET");
  assert.equal(s.site_name, "#ChooseHappiness");
  const a = await call(U.admin, "admin_save_article", [JSON.stringify({ slug: "test-draft", title: "A draft", pillar: "wellness", published: false })]);
  assert.equal(a.published, false);
  assert.equal(await call(null, "get_article", ["test-draft"]), null);
  assert.equal(await code(call(U.admin, "admin_save_article", [JSON.stringify({ slug: "grief-and-loss", title: "Dup", pillar: "wellness" })])), "DUPLICATE");
  await call(U.admin, "admin_delete_article", [a.id]);
  const p = await call(U.admin, "admin_save_prompt", [JSON.stringify({ text: "What would feel like enough today?", scheduled_for: await one("select public.site_today()::text") })]);
  assert.equal((await call(null, "get_daily_prompt")).id, p.id, "scheduled prompt shows today");
  await call(U.admin, "set_user_role", [U.jo, "moderator"]);
  assert.equal(await one(`select role from public.profiles where id = '${U.jo}'`), "moderator");
  await call(U.admin, "set_user_role", [U.jo, "member"]);
  assert.equal(await code(call(U.admin, "set_user_role", [U.admin, "member"])), "FORBIDDEN", "last admin can't demote themselves");
});

test("export and permanent account deletion", async () => {
  await call(U.sam, "save_journal_entry", [JSON.stringify({ body: "Sam's private note" })]);
  const ex = await call(U.sam, "export_my_data");
  assert.equal(ex.journal_entries.length, 1);
  assert.ok(ex.replies.length >= 1);
  assert.equal(await code(call(U.sam, "delete_my_account", ["nope"])), "INVALID");
  await call(U.sam, "delete_my_account", ["DELETE"]);
  assert.equal(await one(`select count(*)::int from auth.users where id = '${U.sam}'`), 0);
  assert.equal(await one(`select count(*)::int from public.journal_entries where user_id = '${U.sam}'`), 0);
  assert.equal(await one(`select count(*)::int from public.messages where sender_id = '${U.sam}'`), 0);
  const t = await call(U.alex, "get_thread", [threadId]);
  assert.equal(t.replies.length, 0, "deleted member's reply is removed");
  assert.equal(await code(call(U.admin, "delete_my_account", ["DELETE"])), "FORBIDDEN", "only admin can't delete themselves");
});

test("message retention removes old chat messages", async () => {
  await db.exec("update public.messages set created_at = now() - interval '400 days' where body like 'Happy to help%'");
  assert.equal(await call(U.admin, "run_retention"), 1);
  assert.equal(await code(call(U.alex, "run_retention")), "FORBIDDEN");
});
