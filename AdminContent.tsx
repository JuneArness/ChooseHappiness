import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp, useRpc } from "../lib/app";
import { friendlyError } from "../lib/backend";
import type { Article, ArticleCard, Category, Page, Prompt, Site, Source, Topic } from "../lib/types";
import { Markdown } from "../components/Markdown";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, Field, Notice, Spinner, fmtDate } from "../components/ui";
import { AdminHeader } from "./AdminApp";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

async function pickImage(upload: (f: Blob, n: string) => Promise<string>, f?: File) {
  if (!f) return "";
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error("INVALID|Please choose a JPG, PNG or WebP image.");
  if (f.size > 5 * 1024 * 1024) throw new Error("TOO_LARGE|Images must be under 5 MB.");
  return upload(f, f.name);
}

export function ArticlesAdmin() {
  const [q, setQ] = useState("");
  const { data, loading } = useRpc<ArticleCard[]>("list_articles", { p_q: q, p_include_drafts: true });
  return (
    <>
      <AdminHeader title="Articles & exercises"><Link to="/admin/content/new" className="btn-primary btn-sm">New article</Link></AdminHeader>
      <div className="mb-4 max-w-sm"><label htmlFor="ac-q" className="label">Search</label><input id="ac-q" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {loading ? <Spinner /> : (
        <ul className="card divide-y divide-line">
          {(data ?? []).map((a) => (
            <li key={a.id}><Link to={`/admin/content/${a.slug}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-sage-50">
              <span className="font-semibold">{a.title}</span>
              <span className="flex flex-wrap gap-1.5">
                <Badge tone={a.kind === "exercise" ? "clay" : "mist"}>{a.kind}</Badge>
                {a.published ? <Badge>Published</Badge> : <Badge tone="warn">Draft</Badge>}
                {!a.reviewed_by_professional && <Badge tone="warn">Not clinically reviewed</Badge>}
              </span>
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}

type Form = Omit<Article, "topic" | "related_cards" | "sources" | "takeaways" | "prompts" | "related" | "tags" | "steps"> & { sources: string; takeaways: string; prompts: string; related: string; tags: string; steps: string };

export function ArticleEditor() {
  const { slug } = useParams();
  const { call, backend } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: a, loading } = useRpc<Article | null>(slug ? "get_article" : null, { p_slug: slug ?? "" });
  const { data: topics } = useRpc<Topic[]>("list_topics");
  const [f, setF] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (slug && !a) return;
    const src = a ?? ({ id: "", slug: "", title: "", summary: "", pillar: "wellness", kind: "article", topic_slug: "", body: "", intro: "", example: "", closing: "", exercise: "",
      content_note: "", professional_note: "", evidence_note: "", author: "#ChooseHappiness Editorial", reviewed_by_professional: false, reading_minutes: 5, image_url: "",
      featured: false, published: false, sensitive: false, sources: [], takeaways: [], prompts: [], related: [], tags: [], steps: [] } as unknown as Article);
    setF({ ...src, topic_slug: src.topic_slug ?? "",
      sources: src.sources.map((s: Source) => [s.title, s.publisher ?? "", s.year ?? "", s.url].join(" | ")).join("\n"),
      takeaways: src.takeaways.join("\n"), prompts: src.prompts.join("\n"), related: src.related.join(", "), tags: src.tags.join(", "),
      steps: src.steps.length ? JSON.stringify(src.steps, null, 2) : "" });
  }, [a, slug]);
  if ((slug && loading) || !f) return <Spinner />;
  if (slug && !a) return <EmptyState h1 title="Article not found" />;

  async function save(e: FormEvent) {
    e.preventDefault(); if (!f) return; setError("");
    let steps: unknown = [];
    if (f.steps.trim()) { try { steps = JSON.parse(f.steps); } catch { return setError("The exercise steps aren't valid JSON. Check commas and quotes."); } }
    const sources = lines(f.sources).map((l) => { const [title, publisher, year, url] = l.split("|").map((x) => x.trim()); return { title, publisher, year, url }; });
    if (sources.some((s) => !/^https:\/\//.test(s.url ?? ""))) return setError("Each source line needs: Title | Publisher | Year | https://link");
    setBusy(true);
    try {
      const saved = await call<Article>("admin_save_article", { p: { ...f, steps, sources, takeaways: lines(f.takeaways), prompts: lines(f.prompts),
        related: f.related.split(",").map((x) => x.trim()).filter(Boolean), tags: f.tags.split(",").map((x) => x.trim()).filter(Boolean) } });
      toast(saved.published ? "Saved and published." : "Saved as draft.");
      if (saved.slug !== slug) navigate(`/admin/content/${saved.slug}`, { replace: true });
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const text = (k: keyof Form, label: string, opts: { area?: boolean; rows?: string; hint?: string } = {}) => (
    <Field id={`ae-${String(k)}`} label={label} hint={opts.hint}>
      {opts.area ? <textarea id={`ae-${String(k)}`} className={`input ${opts.rows ?? "min-h-24"} font-mono text-[0.9rem]`} value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />
        : <input id={`ae-${String(k)}`} className="input" value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />}
    </Field>
  );

  return (
    <>
      <AdminHeader title={slug ? "Edit article" : "New article"}>
        <div className="flex gap-2">{f.slug && <Link to={`/${f.kind === "exercise" ? "exercises" : "articles"}/${f.slug}`} className="btn-secondary btn-sm" target="_blank">Preview page</Link>}<Link to="/admin/content" className="btn-ghost btn-sm">All articles</Link></div>
      </AdminHeader>
      <form onSubmit={save} className="space-y-6">
        {error && <Notice tone="error">{error}</Notice>}
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <Field id="ae-title" label="Title"><input id="ae-title" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: slug ? f.slug : slugify(e.target.value) })} /></Field>
          {text("slug", "URL name", { hint: "Lowercase letters, numbers and dashes." })}
          <Field id="ae-pillar" label="Area"><select id="ae-pillar" className="input" value={f.pillar} onChange={(e) => set("pillar", e.target.value as Form["pillar"])}><option value="wellness">Mental wellness</option><option value="perspective">Perspective</option></select></Field>
          <Field id="ae-kind" label="Type"><select id="ae-kind" className="input" value={f.kind} onChange={(e) => set("kind", e.target.value as Form["kind"])}><option value="article">Article</option><option value="exercise">Guided exercise</option></select></Field>
          <Field id="ae-topic" label="Topic"><select id="ae-topic" className="input" value={f.topic_slug ?? ""} onChange={(e) => set("topic_slug", e.target.value)}><option value="">None</option>{(topics ?? []).map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}</select></Field>
          <Field id="ae-min" label="Minutes to read or complete"><input id="ae-min" type="number" min={1} className="input" value={f.reading_minutes} onChange={(e) => set("reading_minutes", Number(e.target.value))} /></Field>
          <div className="sm:col-span-2">{text("summary", "Summary (1–2 sentences)", { area: true, rows: "min-h-20" })}</div>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between"><h2 className="text-xl">Content</h2><button type="button" className="btn-ghost btn-sm" onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button></div>
          {preview ? <div className="rounded-2xl border border-line p-4"><Markdown text={f.kind === "exercise" ? f.intro : f.body} /></div> : f.kind === "exercise" ? <>
            {text("intro", "Introduction (Markdown)", { area: true, rows: "min-h-32" })}
            {text("example", "Worked example (must be labeled fictional)", { area: true, rows: "min-h-32" })}
            {text("steps", "Steps (JSON)", { area: true, rows: "min-h-64", hint: 'List of steps: [{"id":"s1","prompt":"…","help":"…","type":"text"}]. Types: text, choice (with "options"), scale (min, max, label_min, label_max).' })}
            {text("closing", "Closing note", { area: true })}
          </> : <>
            {text("body", "Article body (Markdown)", { area: true, rows: "min-h-96", hint: "Use ## for section headings. Label any example as fictional." })}
            {text("takeaways", "Practical takeaways (one per line)", { area: true })}
            {text("prompts", "Reflection prompts (one per line)", { area: true })}
            {text("exercise", "Optional exercise (Markdown)", { area: true })}
          </>}
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-xl">Safety, evidence and sources</h2>
          <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={f.sensitive} onChange={(e) => set("sensitive", e.target.checked)} /><span><b>Sensitive topic</b> (shows a content note and crisis resources)</span></label>
          {f.sensitive && text("content_note", "Content note")}
          {text("professional_note", "When to seek professional support", { area: true })}
          {text("evidence_note", "Evidence note (limits of the research)", { area: true })}
          {text("sources", "Sources (one per line: Title | Publisher | Year | https://link)", { area: true, rows: "min-h-32", hint: "Verify every link before publishing. Never cite a study you haven't checked." })}
          <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={f.reviewed_by_professional} onChange={(e) => set("reviewed_by_professional", e.target.checked)} /><span><b>Reviewed by a licensed professional</b><span className="block text-sm text-muted">Only check this after a qualified clinician has actually reviewed this version.</span></span></label>
        </section>

        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          {text("author", "Author or responsible organization")}
          {text("tags", "Tags (comma separated)")}
          {text("related", "Related article URL names (comma separated)")}
          <Field id="ae-img" label="Image (optional)">
            <input id="ae-img" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" onChange={async (e) => { try { const url = await pickImage(backend!.uploadMedia, e.target.files?.[0]); if (url) set("image_url", url); } catch (err) { setError(friendlyError(err)); } }} />
            {f.image_url && <img src={f.image_url} alt="" className="mt-2 h-24 rounded-xl object-cover" />}
          </Field>
          <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} />Featured</label>
          <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={f.published} onChange={(e) => set("published", e.target.checked)} /><b>Published</b> (visible to everyone)</label>
        </section>

        <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-3">
          {a && <button type="button" className="btn-danger" onClick={async () => { if (confirm("Delete this article permanently?")) { await call("admin_delete_article", { p_id: a.id }); navigate("/admin/content"); } }}>Delete</button>}
          <button className="btn-primary px-10 shadow-lg" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </>
  );
}

export function PagesAdmin() {
  const { call } = useApp();
  const toast = useToast();
  const { data, reload } = useRpc<Page[]>("list_pages");
  const [sel, setSel] = useState<string>("");
  const [p, setP] = useState<Page | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (sel) call<Page>("get_page", { p_slug: sel }).then(setP); }, [sel, call]);
  return (
    <>
      <AdminHeader title="Pages"><button type="button" className="btn-secondary btn-sm" onClick={() => { setSel(""); setP({ slug: "", title: "", summary: "", body: "", needs_professional_review: false, published: false, updated_at: "" }); }}>New page</button></AdminHeader>
      <p className="mb-4 text-sm text-muted">Edit the manifesto, About, Get Help, Research, policies and guidelines. Pages marked “needs review” show a draft notice to visitors. “evidence-summary” holds the manifesto's research cards as JSON.</p>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ul className="card h-fit divide-y divide-line">
          {(data ?? []).map((x) => (
            <li key={x.slug}><button type="button" onClick={() => setSel(x.slug)} className={`w-full px-4 py-3 text-left hover:bg-sage-50 ${sel === x.slug ? "bg-sage-50 font-semibold" : ""}`}>
              {x.title}{x.needs_professional_review && <span className="block text-xs text-[#6B4A12]">Needs professional review</span>}
            </button></li>
          ))}
        </ul>
        {p ? (
          <form className="card space-y-4 p-5" onSubmit={async (e) => {
            e.preventDefault(); setError("");
            if (p.slug === "evidence-summary") { try { JSON.parse(p.body); } catch { return setError("This page must stay valid JSON."); } }
            try { await call("admin_save_page", { p }); toast("Page saved."); reload(); setSel(p.slug); } catch (err) { setError(friendlyError(err)); }
          }}>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pg-t" label="Title"><input id="pg-t" className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></Field>
              <Field id="pg-s" label="URL name" hint={p.updated_at ? `Last updated ${fmtDate(p.updated_at)}` : "New pages appear at /pages/your-url-name"}><input id="pg-s" className="input" value={p.slug} readOnly={!!sel} onChange={(e) => setP({ ...p, slug: slugify(e.target.value) })} /></Field>
            </div>
            <Field id="pg-sum" label="Summary"><input id="pg-sum" className="input" value={p.summary} onChange={(e) => setP({ ...p, summary: e.target.value })} /></Field>
            <Field id="pg-b" label="Body (Markdown)"><textarea id="pg-b" className="input min-h-[28rem] font-mono text-[0.9rem]" value={p.body} onChange={(e) => setP({ ...p, body: e.target.value })} /></Field>
            <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={p.needs_professional_review} onChange={(e) => setP({ ...p, needs_professional_review: e.target.checked })} />Needs professional or legal review (shows a draft notice)</label>
            <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={p.published} onChange={(e) => setP({ ...p, published: e.target.checked })} />Published</label>
            <button className="btn-primary">Save page</button>
          </form>
        ) : <EmptyState title="Choose a page to edit" />}
      </div>
    </>
  );
}

export function PromptsAdmin() {
  const { call } = useApp();
  const toast = useToast();
  const { data, reload } = useRpc<Prompt[]>("list_prompts");
  const { data: today } = useRpc<Prompt | null>("get_daily_prompt", undefined, [data]);
  const [n, setN] = useState({ text: "", scheduled_for: "" });
  const save = async (p: Partial<Prompt>) => { try { await call("admin_save_prompt", { p }); reload(); toast("Saved."); } catch (e) { toast(friendlyError(e)); } };
  return (
    <>
      <AdminHeader title="Daily reflections" />
      <Notice>Today visitors see: <b>“{today?.text}”</b>. A prompt scheduled for a date shows on that day; otherwise active prompts rotate daily (in the site's time zone).</Notice>
      <form className="card mt-6 grid gap-4 p-5 sm:grid-cols-[1fr_12rem_auto] sm:items-end" onSubmit={async (e) => { e.preventDefault(); await save({ text: n.text, scheduled_for: n.scheduled_for || null, active: true }); setN({ text: "", scheduled_for: "" }); }}>
        <Field id="np-t" label="New prompt"><input id="np-t" className="input" maxLength={300} value={n.text} onChange={(e) => setN({ ...n, text: e.target.value })} /></Field>
        <Field id="np-d" label="Schedule for (optional)"><input id="np-d" type="date" className="input" value={n.scheduled_for} onChange={(e) => setN({ ...n, scheduled_for: e.target.value })} /></Field>
        <button className="btn-primary" disabled={n.text.trim().length < 5}>Add</button>
      </form>
      <ul className="card mt-6 divide-y divide-line">
        {(data ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span>{p.text} {p.scheduled_for && <Badge tone="mist">{fmtDate(p.scheduled_for)}</Badge>} {!p.active && <Badge tone="warn">Hidden</Badge>}</span>
            <span className="flex gap-1">
              <button type="button" className="btn-ghost btn-sm" onClick={() => save({ ...p, active: !p.active })}>{p.active ? "Hide" : "Show"}</button>
              <button type="button" className="btn-ghost btn-sm" onClick={async () => { if (confirm("Delete this prompt?")) { await call("admin_delete_prompt", { p_id: p.id }); reload(); } }}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CategoriesAdmin() {
  const { call } = useApp();
  const toast = useToast();
  const { data, reload } = useRpc<Category[]>("list_categories");
  const [edit, setEdit] = useState<Category | null>(null);
  return (
    <>
      <AdminHeader title="Discussion spaces"><button type="button" className="btn-secondary btn-sm" onClick={() => setEdit({ slug: "", name: "", description: "", sort: (data?.length ?? 0) + 1, active: true })}>New space</button></AdminHeader>
      <ul className="card divide-y divide-line">
        {(data ?? []).map((c) => (
          <li key={c.slug} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span><b>{c.name}</b> {!c.active && <Badge tone="warn">Hidden</Badge>}<span className="block text-sm text-muted">{c.description}</span></span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setEdit(c)}>Edit</button>
          </li>
        ))}
      </ul>
      {edit && (
        <form className="card mt-6 space-y-4 p-5" onSubmit={async (e) => { e.preventDefault(); try { await call("admin_save_category", { p: edit }); toast("Saved."); setEdit(null); reload(); } catch (err) { toast(friendlyError(err)); } }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-n" label="Name"><input id="c-n" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value, slug: edit.slug && data?.some((d) => d.slug === edit.slug) ? edit.slug : slugify(e.target.value) })} /></Field>
            <Field id="c-s" label="Sort order"><input id="c-s" type="number" className="input" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></Field>
          </div>
          <Field id="c-d" label="Description"><textarea id="c-d" className="input min-h-20" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Visible to members</label>
          <div className="flex gap-3"><button className="btn-primary">Save</button><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      )}
    </>
  );
}

export function SettingsAdmin() {
  const { site, call, reloadSite, backend } = useApp();
  const toast = useToast();
  const [s, setS] = useState<Site | null>(site);
  const [terms, setTerms] = useState((site?.high_risk_terms ?? []).join("\n"));
  const [links, setLinks] = useState((site?.external_links ?? []).map((l) => `${l.label} | ${l.url}`).join("\n"));
  const [error, setError] = useState("");
  if (!s) return <Spinner />;
  const upload = async (k: "logo_url" | "hero_image_url", f?: File) => { try { const url = await pickImage(backend!.uploadMedia, f); if (url) setS({ ...s, [k]: url }); } catch (e) { setError(friendlyError(e)); } };
  async function save(e: FormEvent) {
    e.preventDefault(); if (!s) return; setError("");
    const external_links = lines(links).map((l) => { const [label, url] = l.split("|").map((x) => x.trim()); return { label, url }; });
    if (external_links.some((l) => !l.label || !/^https:\/\//.test(l.url ?? ""))) return setError("Each outside link needs: Label | https://link");
    try { await call("admin_save_settings", { p: { ...s, high_risk_terms: lines(terms), external_links } }); await reloadSite(); toast("Settings saved."); }
    catch (err) { setError(friendlyError(err)); }
  }
  const txt = (k: keyof Site, label: string, hint?: string) => <Field id={`st-${k}`} label={label} hint={hint}><input id={`st-${k}`} className="input" value={String(s[k] ?? "")} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>;
  const chk = (k: keyof Site, label: string, hint?: string) => (
    <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={Boolean(s[k])} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /><span><b>{label}</b>{hint && <span className="block text-sm text-muted">{hint}</span>}</span></label>
  );
  return (
    <>
      <AdminHeader title="Settings" />
      <form onSubmit={save} className="space-y-6">
        {error && <Notice tone="error">{error}</Notice>}
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="text-xl sm:col-span-2">Brand & contact</h2>
          {txt("site_name", "Site name")}{txt("tagline", "Tagline")}{txt("founders", "Founders")}{txt("contact_email", "Public contact email")}
          {txt("timezone", "Time zone", "Used for the daily reflection, e.g. America/New_York")}
          <Field id="st-logo" label="Header logo (optional)" hint="Leave as-is to use the #ChooseHappiness sunset logo.">
            <input id="st-logo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" onChange={(e) => upload("logo_url", e.target.files?.[0])} />
            {s.logo_url && <div className="mt-2 flex items-center gap-3"><img src={s.logo_url} alt="" className="h-10" /><button type="button" className="link text-sm" onClick={() => setS({ ...s, logo_url: "" })}>Use default logo</button></div>}
          </Field>
          <Field id="st-hero" label="Homepage hero photo (optional)" hint="A calm landscape works best. Use only photos you have the rights to.">
            <input id="st-hero" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" onChange={(e) => upload("hero_image_url", e.target.files?.[0])} />
            {s.hero_image_url && <div className="mt-2 flex items-center gap-3"><img src={s.hero_image_url} alt="" className="h-16 rounded-lg" /><button type="button" className="link text-sm" onClick={() => setS({ ...s, hero_image_url: "" })}>Use illustration</button></div>}
          </Field>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="text-xl">Live support availability</h2>
          <p className="text-sm text-muted">Visitors see exactly what you set here. Only choose “Online” when someone is actually available to reply.</p>
          <Field id="st-ss" label="Support status">
            <select id="st-ss" className="input" value={s.support_status} onChange={(e) => setS({ ...s, support_status: e.target.value as Site["support_status"] })}>
              <option value="online">Online: someone is available now</option><option value="offline">Offline: members can leave a message</option><option value="unavailable">Unavailable: support messaging paused</option>
            </select>
          </Field>
          {txt("support_hours", "Support hours", "e.g. Weekdays 10am–4pm Eastern. Leave blank if you don't keep set hours.")}
          {txt("support_response_time", "Typical reply time", "e.g. Within 2 business days. Only promise what you can keep.")}
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="text-xl">Community & safety</h2>
          {chk("community_open", "Allow new posts")}
          {chk("review_first_posts", "Review each new member's first post", "Recommended. Their first post or reply waits for a moderator.")}
          {chk("peer_chat_enabled", "Allow member-to-member messages", "Members must also opt in. Only turn on when you have moderators to handle reports.")}
          {txt("community_monitoring_note", "How the community is monitored (shown to members)", "Be accurate, e.g. “Moderators check reports daily on weekdays.” Never claim 24/7 monitoring unless it's true.")}
          <Field id="st-terms" label="Phrases that hold a post for review (one per line)" hint="Posts containing these are held for a person to review, and the writer is shown crisis resources. This is a safety net, not a way to detect risk reliably.">
            <textarea id="st-terms" className="input min-h-40" value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="text-xl">Privacy & resources</h2>
          <Field id="st-ret" label="Delete chat messages after (days)" hint="Applies when the retention job runs (see README)."><input id="st-ret" type="number" min={7} max={3650} className="input max-w-40" value={s.message_retention_days} onChange={(e) => setS({ ...s, message_retention_days: Number(e.target.value) })} /></Field>
          <button type="button" className="btn-secondary btn-sm" onClick={async () => { try { const n = await call<number>("run_retention"); toast(`${n} old messages deleted.`); } catch (e) { toast(friendlyError(e)); } }}>Run retention now</button>
          <Field id="st-links" label="Extra outside resources (one per line: Label | https://link)" hint="Shown in the Resources library. Verify each link first."><textarea id="st-links" className="input min-h-28" value={links} onChange={(e) => setLinks(e.target.value)} /></Field>
        </section>
        <div className="sticky bottom-3 z-10 flex justify-end"><button className="btn-primary px-10 shadow-lg">Save settings</button></div>
      </form>
    </>
  );
}
