import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { ArticleCard, Journey, SavedItem } from "../lib/types";
import { ArticleTile } from "../components/Cards";
import { EmptyState, PageHeader, Spinner, fmtDate } from "../components/ui";

export default function Library() {
  useSeo({ title: "My library | #ChooseHappiness", path: "/library", noindex: true });
  const { me } = useApp();
  const { data: saved, loading } = useRpc<SavedItem[]>("my_saved");
  const { data: all } = useRpc<ArticleCard[]>("list_articles");
  const { data: journeys } = useRpc<Journey[]>("list_journeys");
  if (loading || !me) return <Spinner />;
  const by = (status: string) => (saved ?? []).filter((s) => s.status === status);
  const card = (s: SavedItem) => all?.find((a) => a.slug === s.item_ref);
  const label = (s: SavedItem) => s.item_type === "journey" ? journeys?.find((j) => j.slug === s.item_ref)?.title : s.item_type === "thread" ? "Saved discussion" : card(s)?.title;
  const href = (s: SavedItem) => s.item_type === "journey" ? `/journey/${s.item_ref}` : s.item_type === "thread" ? `/community/t/${s.item_ref}` : s.item_type === "exercise" ? `/exercises/${s.item_ref}` : `/articles/${s.item_ref}`;
  const savedItems = by("saved");
  const done = by("completed");
  return (
    <>
      <PageHeader kicker="Your space" title="My library" intro="Things you've saved and activities you've finished, at your own pace. There are no streaks or scores here." />
      <div className="container-page mt-10 space-y-14">
        <section aria-labelledby="sv">
          <h2 id="sv" className="mb-4 text-2xl">Saved for later</h2>
          {savedItems.length === 0 ? <EmptyState title="Nothing saved yet" action={<Link to="/resources" className="btn-primary">Browse resources</Link>}>Use “Save for later” on any article, exercise or discussion.</EmptyState> : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedItems.map((s) => { const c = card(s); return <li key={s.item_type + s.item_ref}>{c ? <ArticleTile a={c} /> : <Link to={href(s)} className="card block p-5 hover:border-sage"><span className="font-serif text-lg text-evergreen">{label(s) ?? "Saved item"}</span></Link>}</li>; })}
            </ul>
          )}
        </section>
        <section aria-labelledby="dn">
          <h2 id="dn" className="mb-4 text-2xl">Completed</h2>
          {done.length === 0 ? <p className="text-muted">When you finish an exercise or journey, you can mark it done and it'll appear here.</p> : (
            <ul className="card divide-y divide-line">
              {done.map((s) => (
                <li key={s.item_type + s.item_ref}><Link to={href(s)} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-sage-50">
                  <span className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-sage-dark" aria-hidden="true" />{label(s) ?? s.item_ref}</span>
                  <span className="text-sm text-muted">{fmtDate(s.created_at)}</span></Link></li>
              ))}
            </ul>
          )}
        </section>
        <p><Link to="/journal" className="link">Go to my private journal</Link></p>
      </div>
    </>
  );
}
