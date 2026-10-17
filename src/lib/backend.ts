// One small interface for everything the app needs from a server. Two implementations:
//  - supabaseBackend: the real thing (Supabase Auth + Postgres + Storage + Realtime).
//  - demoBackend: preview mode. Runs the SAME database migrations and security rules inside
//    the browser (PGlite), so the preview behaves like production but stores data only locally.
// All data access goes through rpc(), i.e. the database functions in supabase/migrations/0003.

export interface AuthUser { id: string; email: string; }

export interface Backend {
  mode: "supabase" | "demo";
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (u: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  uploadMedia(file: Blob, name: string): Promise<string>;
  /** Live updates for one conversation. Returns an unsubscribe function. */
  subscribeConversation(id: string, onChange: () => void): () => void;
}

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
export const SUPABASE_URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "").trim();
export const SUPABASE_ANON_KEY = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "").trim();
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "").replace(/\/+$/, "");
export const CONFIGURED = DEMO_MODE || (/^https:\/\/.+/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20);

let pending: Promise<Backend> | null = null;
export function getBackend(): Promise<Backend> {
  if (!pending) {
    pending = DEMO_MODE
      ? import("./demoBackend").then((m) => m.createDemoBackend())
      : import("./supabaseBackend").then((m) => m.createSupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY));
  }
  return pending;
}

/** Turns "CODE|Friendly message" database errors into the friendly message. */
export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  const i = raw.indexOf("|");
  if (i > 0 && /^[A-Z_]+$/.test(raw.slice(0, i))) return raw.slice(i + 1);
  if (/invalid login credentials/i.test(raw)) return "That email and password don't match. Please try again.";
  if (/email not confirmed/i.test(raw)) return "Please confirm your email first. Check your inbox for the link.";
  if (/user already registered/i.test(raw)) return "An account with that email already exists. Try signing in instead.";
  if (/password should be at least/i.test(raw)) return "Please use a password with at least 8 characters.";
  if (/failed to fetch|network/i.test(raw)) return "We couldn't reach the server. Check your connection and try again.";
  return fallback;
}
export const errorCode = (e: unknown) => {
  const raw = e instanceof Error ? e.message : "";
  const i = raw.indexOf("|");
  return i > 0 ? raw.slice(0, i) : "";
};
