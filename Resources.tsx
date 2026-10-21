import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink, Printer, Search } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { ArticleCard, Topic } from "../lib/types";
import { ArticleTile } from "../components/Cards";
import { CRISIS } from "../data/crisis";
import { EmptyState, PageHeader, Spinner } from "../components/ui";

export default function Resources() {
  useSeo({ title: "Resources library | #ChooseHappiness", description: "Search articles, guided exercises, printable worksheets, research summaries and support directories.", path: "/resources" });
  const { site } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const pillar = params.get("pillar") || null;
  const kind = params.get("kind") || null;
  const topic = params.get("topic") || null;
  const { data: topics } = useRpc<Topic[]>("list_topics");
  const { data: items, loading } = useRpc<ArticleCard[]>("list_articles", { p_q: q, p_pillar: pillar, p_kind: kind, p_topic: topic });
  const { data: exercises } = useRpc<ArticleCard[]>("list_articles", { p_kind: "exercise" });
  // Read the live URL so quick successive changes (e.g. clear search, then pick a type) never overwrite each other.
  const set = (k: string, v: string) => { const n = new URLSearchParams(window.location.search); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  const icon = useMemo(() => (slug: string | null) => topics?.find((t) => t.slug === slug)?.icon, [topics]);
  const filtered = Boolean(q || pillar || kind || topic);

  return (
    <>
      <PageHeader kicker="Resources & research library" title="Find what you need" intro="Articles, guided exercises, printable worksheets, research summaries and trusted outside support, all in one place." />
      <div className="container-page mt-10">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="card grid gap-4 p-5 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <label htmlFor="r-q" className="label">Search</label>
            <Search className="pointer-events-none absolute bottom-3.5 left-4 h-5 w-5 text-muted" aria-hidden="true" />
            <input id="r-q" type="search" className="input pl-12" value={q} onChange={(e) => set("q", e.target.value)} placeholder="e.g. sleep, boundaries, gratitude" />
          </div>
          <div><label htmlFor="r-p" className="label">Area</label>
            <select id="r-p" className="input" value={pillar ?? ""} onChange={(e) => set("pillar", e.target.value)}><option value="">All areas</option><option value="wellness">Mental wellness</option><option value="perspective">Perspective</option></select></div>
          <div><label htmlFor="r-k" className="label">Type</label>
            <select id="r-k" className="input" value={kind ?? ""} onChange={(e) => set("kind", e.target.value)}><option value="">All types</option><option value="article">Articles</option><option value="exercise">Guided exercises</option></select></div>
          <div><label htmlFor="r-t" className="label">Topic</label>
            <select id="r-t" className="input" value={topic ?? ""} onChange={(e) => set("topic", e.target.value)}><option value="">All topics</option>{(topics ?? []).map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}</select></div>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <p className="text-muted">{loading ? "Searching…" : `${items?.length ?? 0} ${items?.length === 1 ? "result" : "results"}`}</p>
          {filtered && <button type="button" className="btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
        </div>
        {loading && !items ? <Spinner /> : items && items.length === 0 ? <div className="mt-4"><EmptyState title="Nothing matched those filters">Try fewer words or clear the filters.</EmptyState></div> : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(items ?? []).map((a) => <li key={a.slug}><ArticleTile a={a} topicIcon={icon(a.topic_slug)} /></li>)}</ul>
        )}

        <section aria-labelledby="ws" className="mt-16">
          <h2 id="ws" className="text-3xl">Printable worksheets</h2>
          <p className="mt-2 text-muted">Each guided exercise is also available as a worksheet you can print or save as a PDF (use your browser's Print, then “Save as PDF”).</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {(exercises ?? []).map((a) => <li key={a.slug}><Link to={`/exercises/${a.slug}?worksheet=1`} className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-paper px-4 hover:border-sage"><Printer className="h-4 w-4 text-sage-dark" aria-hidden="true" />{a.title}</Link></li>)}
          </ul>
        </section>

        <section aria-labelledby="dir" className="mt-16">
          <h2 id="dir" className="text-3xl">Outside support directories</h2>
          <p className="mt-2 text-muted">Trusted services run by other organizations. #ChooseHappiness isn't affiliated with them.</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              [CRISIS.lifeline.name, "Call, text or chat 988 (U.S.), free and confidential, 24/7.", CRISIS.lifeline.site],
              [CRISIS.samhsa.name, CRISIS.samhsa.detail, CRISIS.samhsa.site],
              ["FindTreatment.gov", "Search for mental health and substance use treatment in the U.S. (from SAMHSA).", CRISIS.findTreatment],
              [CRISIS.textLine.name, `${CRISIS.textLine.detail} (U.S.).`, CRISIS.textLine.site],
              ["Find A Helpline", "Free directory of helplines in many countries. Not an emergency service.", CRISIS.international],
              ...(site?.external_links ?? []).map((l) => [l.label, "", l.url]),
            ].map(([n, d, u]) => (
              <li key={u} className="card p-5">
                <a href={u} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5 text-lg">{n}<ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
                {d && <p className="mt-1 text-[0.95rem] text-muted">{d}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-6"><Link to="/research" className="link">Research & evidence: how we choose and label sources</Link></p>
        </section>
      </div>
    </>
  );
}
