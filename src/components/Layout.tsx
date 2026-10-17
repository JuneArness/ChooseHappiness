import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LifeBuoy, Menu, X } from "lucide-react";
import { useApp } from "../lib/app";
import { CRISIS } from "../data/crisis";

export const NAV: [string, string][] = [
  ["/", "Home"], ["/wellness", "Mental Wellness"], ["/perspective", "Perspective"], ["/journey", "The Journey"],
  ["/community", "Community"], ["/resources", "Resources"], ["/about", "About"], ["/support", "Get Support"],
];

export function Logo({ className = "h-11 w-auto" }: { className?: string }) {
  const { site } = useApp();
  const custom = site?.logo_url && /^(https:|data:image\/)/.test(site.logo_url) ? site.logo_url : "";
  return <img src={custom || "/brand/choosehappiness-logo.webp"} alt="#ChooseHappiness" width={800} height={180} className={className} />;
}

function AccountMenu() {
  const { me, backend } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", h);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", h); };
  }, [open]);
  if (!me) return (
    <div className="flex items-center gap-1">
      <Link to="/signin" className="btn-ghost btn-sm whitespace-nowrap">Sign in</Link>
      <Link to="/signup" className="btn-primary btn-sm hidden whitespace-nowrap sm:inline-flex">Join</Link>
    </div>
  );
  const items: [string, string][] = [["/journal", "My journal"], ["/library", "My library"], ["/messages", "Messages"], ["/account", "Account & privacy"]];
  if (me.is_staff) items.push(["/admin", me.role === "admin" ? "Admin" : "Moderation"]);
  return (
    <div className="flex items-center gap-0.5 sm:gap-1" ref={ref}>
      <Link to="/notifications" className="relative grid h-11 w-11 place-items-center rounded-full text-evergreen hover:bg-sage-50" aria-label={`Notifications${me.unread ? `, ${me.unread} unread` : ""}`}>
        <Bell className="h-5 w-5" aria-hidden="true" />
        {me.unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-terracotta-dark px-1 text-[0.7rem] font-bold text-white" aria-hidden="true">{me.unread > 9 ? "9+" : me.unread}</span>}
      </Link>
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true"
          className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper p-1 hover:border-sage sm:pr-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-sage-100 font-semibold text-evergreen" aria-hidden="true">{me.display_name.slice(0, 1).toUpperCase()}</span>
          <span className="hidden max-w-[8rem] truncate text-sm font-semibold sm:inline xl:hidden 2xl:inline">{me.display_name}</span>
          <ChevronDown className="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" /><span className="sr-only">Account menu</span>
        </button>
        {open && (
          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-paper py-2 shadow-xl">
            {items.map(([to, label]) => <Link key={to} to={to} className="block px-4 py-2.5 hover:bg-sage-50">{label}</Link>)}
            <button type="button" className="block w-full border-t border-line px-4 py-2.5 text-left hover:bg-sage-50"
              onClick={async () => { await backend?.signOut(); navigate("/"); }}>Sign out</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label="Main menu" onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-0 ml-auto h-full max-h-none w-[min(22rem,90vw)] max-w-none bg-ivory p-0 text-ink backdrop:bg-evergreen/40">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Logo className="h-9 w-auto" />
        <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sage-50" aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav aria-label="Main" className="p-2">
        <ul>
          {NAV.map(([to, label]) => <li key={to}><Link to={to} onClick={onClose} className="flex min-h-12 items-center rounded-xl px-3 font-semibold hover:bg-sage-50">{label}</Link></li>)}
          <li><Link to="/get-help" onClick={onClose} className="flex min-h-12 items-center gap-2 rounded-xl px-3 font-semibold text-terracotta-dark hover:bg-clay-50"><LifeBuoy className="h-5 w-5" aria-hidden="true" />Get help now</Link></li>
        </ul>
      </nav>
    </dialog>
  );
}

export function Layout() {
  const { backend, site } = useApp();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); document.getElementById("main")?.focus({ preventScroll: true }); }, [loc.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-evergreen focus:px-4 focus:py-2 focus:text-white">Skip to main content</a>
      {backend?.mode === "demo" && <PreviewBar />}
      <div className="bg-evergreen text-[0.85rem] text-[#E8EFE9] print:hidden">
        <div className="container-page flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5">
          <p>Not an emergency service. In crisis in the U.S.? <a className="font-semibold text-white underline" href={CRISIS.lifeline.call}>Call</a> or <a className="font-semibold text-white underline" href={CRISIS.lifeline.text}>text 988</a>.</p>
          <Link to="/get-help" className="font-semibold text-white underline">Get help now</Link>
        </div>
      </div>
      <header className="sticky top-0 z-30 print:hidden border-b border-line bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
        <div className="container-page flex min-h-[4.5rem] items-center gap-1.5 sm:gap-3">
          <button type="button" className="grid h-11 w-11 flex-none place-items-center rounded-full hover:bg-sage-50 xl:hidden" onClick={() => setMenu(true)} aria-label="Open menu" aria-haspopup="dialog">
            <Menu className="h-6 w-6" />
          </button>
          <Link to="/" className="min-w-0 flex-none" aria-label={`${site?.site_name ?? "#ChooseHappiness"} home`}><Logo className="h-8 w-auto min-[400px]:h-9 sm:h-11" /></Link>
          <nav aria-label="Main" className="ml-2 hidden xl:block">
            <ul className="flex items-center gap-0.5 whitespace-nowrap text-[0.92rem] font-semibold">
              {NAV.map(([to, label]) => (
                <li key={to}><NavLink to={to} end={to === "/"} className={({ isActive }) => `block rounded-full px-2.5 py-2 ${isActive ? "bg-sage-100 text-evergreen" : "text-ink hover:bg-sage-50"}`}>{label}</NavLink></li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <AccountMenu />
          </div>
        </div>
      </header>
      <MobileNav open={menu} onClose={() => setMenu(false)} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none"><Outlet /></main>
      <Footer />
    </div>
  );
}

function PreviewBar() {
  const { backend } = useApp();
  const reset = (backend as unknown as { resetPreview?: () => Promise<void> })?.resetPreview;
  return (
    <div className="bg-[#FBF3E3] px-4 py-1.5 print:hidden text-center text-xs font-semibold text-[#5C4A12]">
      Preview mode: sample sign-ins, data saved in this browser only. Nothing is sent to a server.
      {reset && <button type="button" className="ml-2 underline" onClick={() => { if (confirm("Erase all preview data in this browser and start fresh?")) void reset(); }}>Reset preview</button>}
    </div>
  );
}

function Footer() {
  const { site } = useApp();
  return (
    <footer className="mt-20 bg-evergreen print:hidden text-[#DCE6DE]">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <img src="/brand/choosehappiness-badge.webp" alt="#ChooseHappiness badge" width={480} height={480} loading="lazy" className="h-24 w-24" />
          <p className="mt-4 font-serif text-lg italic text-white">{site?.tagline ?? "Begin the journey when the paths are before you."}</p>
          <p className="mt-3 text-sm">A mental wellness education and peer-support community. Not a substitute for professional care, and not an emergency service.</p>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-white">Explore</h2>
          <ul className="space-y-2 text-sm">
            {[["/wellness", "Mental Wellness"], ["/perspective", "The Power of Perspective"], ["/manifesto", "The Choice That Changes the View"], ["/journey", "The Journey"], ["/reflection", "Daily reflection"], ["/resources", "Resources library"], ["/research", "Research & evidence"]].map(([to, l]) => <li key={to}><Link className="hover:underline" to={to}>{l}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-white">Community</h2>
          <ul className="space-y-2 text-sm">
            {[["/community", "Discussions"], ["/guidelines", "Community guidelines"], ["/support", "Live chat & support"], ["/about", "About & mission"]].map(([to, l]) => <li key={to}><Link className="hover:underline" to={to}>{l}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-white">Support & policies</h2>
          <ul className="space-y-2 text-sm">
            {[["/get-help", "Get help now"], ["/privacy", "Privacy policy"], ["/terms", "Terms of use"]].map(([to, l]) => <li key={to}><Link className="hover:underline" to={to}>{l}</Link></li>)}
            {site?.contact_email && <li><a className="hover:underline" href={`mailto:${site.contact_email}`}>{site.contact_email}</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-[#B9C9BD] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {site?.site_name ?? "#ChooseHappiness"}. Founded by {site?.founders ?? "Stephen A. Parks Jr. & Gina P. McCoy"}.</p>
          <p>In crisis in the U.S.? Call or text 988. Emergency: 911.</p>
        </div>
      </div>
    </footer>
  );
}
