// Production backend. Every call is checked again by the database (row-level security and the
// permission checks inside each function), so this file cannot grant more access than the database allows.
import { createClient } from "@supabase/supabase-js";
import type { AuthUser, Backend } from "./backend";

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "ch-auth" } });
  const toUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email ?? "" } : null);

  return {
    mode: "supabase",
    async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
      const { data, error } = await sb.rpc(fn, args);
      if (error) throw new Error(error.message);
      return data as T;
    },
    async getUser() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signUp(email, password, displayName) {
      const { data, error } = await sb.auth.signUp({
        email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/signin` },
      });
      if (error) throw new Error(error.message);
      return { needsConfirmation: !data.session };
    },
    async signOut() { await sb.auth.signOut(); },
    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw new Error(error.message);
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    async uploadMedia(file, name) {
      const path = `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60)}`;
      const { error } = await sb.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(/row-level|policy/i.test(error.message) ? "FORBIDDEN|Only administrators can upload images." : error.message);
      return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
    },
    subscribeConversation(id, onChange) {
      // Supabase Realtime only delivers rows this user is allowed to read (row-level security).
      const ch = sb.channel(`conv-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, () => onChange())
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };
}
