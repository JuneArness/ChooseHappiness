// App-wide state: the backend, site settings, and the signed-in member.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getBackend, type AuthUser, type Backend } from "./backend";
import type { Me, Site } from "./types";

interface AppState {
  backend: Backend | null;
  site: Site | null;
  user: AuthUser | null;
  me: Me | null;
  ready: boolean;
  loadError: string;
  call<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
  refreshMe(): Promise<void>;
  reloadSite(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const beRef = useRef<Backend | null>(null);

  const call = useCallback(async <T,>(fn: string, args?: Record<string, unknown>) => {
    const be = beRef.current ?? (await getBackend());
    return be.rpc<T>(fn, args);
  }, []);

  const refreshMe = useCallback(async () => {
    const be = beRef.current; if (!be) return;
    const u = await be.getUser();
    setUser(u);
    setMe(u ? await be.rpc<Me | null>("me") : null);
  }, []);

  const reloadSite = useCallback(async () => {
    const be = beRef.current; if (!be) return;
    setSite(await be.rpc<Site>("get_site"));
  }, []);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const be = await getBackend();
        beRef.current = be; setBackend(be);
        const [s, u] = await Promise.all([be.rpc<Site>("get_site"), be.getUser()]);
        setSite(s); setUser(u);
        if (u) setMe(await be.rpc<Me | null>("me"));
        unsub = be.onAuthChange(async (nu) => { setUser(nu); setMe(nu ? await be.rpc<Me | null>("me").catch(() => null) : null); });
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load");
      } finally { setReady(true); }
    })();
    return () => unsub();
  }, []);

  return <Ctx.Provider value={{ backend, site, user, me, ready, loadError, call, refreshMe, reloadSite }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

/** Loads data from a database function and reloads when deps change. */
export function useRpc<T>(fn: string | null, args?: Record<string, unknown>, deps: unknown[] = []) {
  const { call, ready } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(args ?? {});
  useEffect(() => {
    if (!ready || !fn) return;
    let live = true;
    setLoading(true);
    call<T>(fn, args).then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, key, ready, tick, ...deps]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}
