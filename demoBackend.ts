// PREVIEW MODE ONLY. Loads the real migrations + security rules into PGlite (Postgres compiled to
// WebAssembly) inside this browser. Data is saved in this browser only (IndexedDB) and never leaves it.
// Sample sign-ins are created so you can try every role. Live chat updates only within this tab.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import shim from "../../supabase/sim/shim.sql?raw";
import m1 from "../../supabase/migrations/0001_schema.sql?raw";
import m2 from "../../supabase/migrations/0002_security.sql?raw";
import m3 from "../../supabase/migrations/0003_functions.sql?raw";
import m4 from "../../supabase/migrations/0004_storage.sql?raw";
import seed from "../../supabase/seed.sql?raw";
import type { AuthUser, Backend } from "./backend";
import { PREVIEW_ACCOUNTS } from "./previewAccounts";

const SQL = [shim, m1, m2, m3, m4, seed];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const DB_NAME = `ch-preview-${hash(SQL.join(""))}`;
const SESSION_KEY = "ch-preview-session";
const LIVE_FNS = new Set(["send_message", "start_support_conversation", "start_peer_conversation", "moderate_content", "close_conversation", "mark_conversation_read"]);

function readSession(): AuthUser | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"); } catch { return null; }
}

export async function createDemoBackend(): Promise<Backend & { resetPreview(): Promise<void> }> {
  let db: PGlite;
  try { db = await PGlite.create(`idb://${DB_NAME}`, { extensions: { pgcrypto } }); }
  catch { db = await PGlite.create({ extensions: { pgcrypto } }); }  // private browsing: memory only

  const ready = (await db.query<{ t: string | null }>("select to_regclass('public.site_settings')::text as t")).rows[0]?.t;
  if (!ready) {
    for (const sql of SQL) await db.exec(sql);
    for (const a of PREVIEW_ACCOUNTS) {
      await db.query("insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, crypt($2, gen_salt('bf', 6)), $3)",
        [a.email, a.password, JSON.stringify({ display_name: a.name })]);
      await db.query("update public.profiles p set role = $2, allow_peer_messages = true from auth.users u where u.id = p.id and u.email = $1", [a.email, a.role]);
    }
    await db.exec("update public.site_settings set peer_chat_enabled = true, contact_email = 'hello@example.com' where id = 1;");
  }

  let user = readSession();
  const listeners = new Set<(u: AuthUser | null) => void>();
  const live = new EventTarget();
  const setUser = (u: AuthUser | null) => {
    user = u;
    try { if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u)); else localStorage.removeItem(SESSION_KEY); } catch { /* storage off */ }
    listeners.forEach((cb) => cb(u));
  };
  // A stored session for an account that no longer exists (e.g. after deleting it) is cleared.
  if (user && !(await db.query("select 1 from auth.users where id = $1", [user.id])).rows.length) setUser(null);

  const toParam = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);
  // PGlite's syncToFs() returns early when another save is already scheduled, so also call the
  // file system's save directly and wait for it. Preview mode only.
  const flush = async () => {
    await db.syncToFs();
    const fs = (db as unknown as { fs?: { syncToFs(relaxed: boolean): Promise<void> } }).fs;
    if (fs) await fs.syncToFs(false);
  };
  // One database call at a time, so saving to IndexedDB never overlaps another write.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };

  return {
    mode: "demo",
    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      if (!/^[a-z_]+$/.test(fn)) throw new Error("Invalid function");
      const keys = Object.keys(args).filter((k) => args[k] !== undefined && /^[a-z_]+$/.test(k));
      const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
      const uid = user?.id ?? "";
      const out = await serial(async () => {
        const r = await db.transaction(async (tx) => {
          await tx.exec(`set local role ${uid ? "authenticated" : "anon"}`);
          await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
          const res = await tx.query<{ r: T }>(sql, keys.map((k) => toParam(args[k])));
          return res.rows[0]?.r as T;
        });
        // Transactions don't flush to IndexedDB on commit; do it now so a page reload can't lose the write.
        if (!/^(list_|get_|my_|me$|mod_|admin_stats|support_inbox|export_)/.test(fn)) await flush();
        return r;
      });
      if (LIVE_FNS.has(fn)) setTimeout(() => live.dispatchEvent(new Event("change")), 0);
      if (fn === "delete_my_account") setUser(null);
      return out;
    },
    async getUser() { return user; },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async signIn(email, password) {
      const r = await db.query<{ id: string; email: string }>(
        "select id, email from auth.users where email = lower($1) and encrypted_password = crypt($2, encrypted_password)", [email.trim(), password]);
      if (!r.rows[0]) throw new Error("Invalid login credentials");
      setUser({ id: r.rows[0].id, email: r.rows[0].email });
    },
    async signUp(email, password, displayName) {
      if (password.length < 8) throw new Error("Password should be at least 8 characters");
      const exists = await db.query("select 1 from auth.users where email = lower($1)", [email.trim()]);
      if (exists.rows.length) throw new Error("User already registered");
      const r = await db.query<{ id: string; email: string }>(
        "insert into auth.users (email, encrypted_password, raw_user_meta_data) values (lower($1), crypt($2, gen_salt('bf', 6)), $3) returning id, email",
        [email.trim(), password, JSON.stringify({ display_name: displayName })]);
      await flush();
      setUser({ id: r.rows[0].id, email: r.rows[0].email });
      return { needsConfirmation: false };
    },
    async signOut() { setUser(null); },
    async sendPasswordReset() {
      throw new Error("PREVIEW|Password reset emails can't be sent in preview mode. On the live site, Supabase emails a secure reset link.");
    },
    async updatePassword(password) {
      if (!user) throw new Error("AUTH|Please sign in first.");
      if (password.length < 8) throw new Error("Password should be at least 8 characters");
      await db.query("update auth.users set encrypted_password = crypt($2, gen_salt('bf', 6)) where id = $1", [user.id, password]);
      await flush();
    },
    async uploadMedia(file) {
      if (file.size > 2_000_000) throw new Error("TOO_LARGE|In preview mode, images must be under 2 MB.");
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file);
      });
    },
    subscribeConversation(_id, onChange) {
      const h = () => onChange();
      live.addEventListener("change", h);
      return () => live.removeEventListener("change", h);
    },
    async resetPreview() {
      await db.close();
      setUser(null);
      await new Promise<void>((res) => { const r = indexedDB.deleteDatabase(`/pglite/${DB_NAME}`); r.onsuccess = r.onerror = r.onblocked = () => res(); });
      location.reload();
    },
  };
}
