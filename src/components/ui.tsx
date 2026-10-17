import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BatteryLow, BookOpen, Brain, Cloud, Compass, Feather, Frame, GitBranch, HandHeart, Heart, Leaf, Link2, MessageCircle,
  Moon, Mountain, Scale, Sprout, Sun, Sunrise, Users, Waves, Wind, Route, LoaderCircle, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  heart: Heart, leaf: Leaf, wind: Wind, cloud: Cloud, waves: Waves, hands: HandHeart, sun: Sun, moon: Moon, feather: Feather,
  people: Users, chat: MessageCircle, link: Link2, battery: BatteryLow, sprout: Sprout, compass: Compass, frame: Frame,
  scale: Scale, sunrise: Sunrise, path: Route, branch: GitBranch, brain: Brain, book: BookOpen, mountain: Mountain,
};
export function TopicIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Leaf;
  return <I className={className} aria-hidden="true" strokeWidth={1.6} />;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <LoaderCircle className="h-6 w-6 animate-spin text-sage" aria-hidden="true" /><span>{label}…</span>
    </div>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "success" | "warn" | "error"; title?: string; children: ReactNode }) {
  const styles = {
    info: "border-mist bg-mist-50 text-ink",
    success: "border-sage/50 bg-sage-50 text-ink",
    warn: "border-[#E2C08A] bg-[#FBF3E3] text-ink",
    error: "border-[#D9A3A3] bg-[#FBEDED] text-[#6E2323]",
  }[tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles}`} role={tone === "error" ? "alert" : undefined}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="text-[0.97rem]">{children}</div>
    </div>
  );
}

export function PageHeader({ kicker, title, intro, children }: { kicker?: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <header className="border-b border-line bg-gradient-to-b from-sage-50 to-ivory">
      <div className="container-page py-12 sm:py-16">
        {kicker && <p className="kicker mb-3">{kicker}</p>}
        <h1 className="max-w-3xl text-4xl sm:text-5xl">{title}</h1>
        {intro && <div className="mt-4 max-w-2xl text-lg text-muted">{intro}</div>}
        {children}
      </div>
    </header>
  );
}

export function EmptyState({ title, children, action, h1 }: { title: string; children?: ReactNode; action?: ReactNode; h1?: boolean }) {
  return (
    <div className="card px-6 py-12 text-center">
      <Sprout className="mx-auto mb-3 h-8 w-8 text-sage" aria-hidden="true" />
      {h1 ? <h1 className="font-serif text-2xl text-evergreen">{title}</h1> : <p className="font-serif text-xl text-evergreen">{title}</p>}
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p className="mt-1 text-sm font-semibold text-[#8C2F2F]">{error}</p>}
    </div>
  );
}

/** Accessible modal built on <dialog>. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={titleId}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-3xl bg-paper p-0 text-ink backdrop:bg-evergreen/40`}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-2xl">{title}</h2>
            <button type="button" onClick={onClose} className="grid h-10 w-10 flex-none place-items-center rounded-full text-2xl leading-none text-muted hover:bg-sage-50" aria-label="Close">×</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Badge({ children, tone = "sage" }: { children: ReactNode; tone?: "sage" | "clay" | "mist" | "warn" }) {
  const t = { sage: "bg-sage-100 text-evergreen", clay: "bg-clay-50 text-terracotta-dark", mist: "bg-mist-50 text-[#28485A]", warn: "bg-[#FBF3E3] text-[#6B4A12]" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export function SignInPrompt({ what, h1 }: { what: string; h1?: boolean }) {
  return (
    <EmptyState h1={h1} title={`Sign in to ${what}`} action={
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/signin" className="btn-primary">Sign in</Link>
        <Link to="/signup" className="btn-secondary">Create a free account</Link>
      </div>}>
      Your account keeps your reflections private and lets you take part in the community.
    </EmptyState>
  );
}

export const fmtDate = (s: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("en-US", opts) : "";
export const fmtTime = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export function timeAgo(s: string) {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} hr ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} days ago`;
  return fmtDate(s);
}
