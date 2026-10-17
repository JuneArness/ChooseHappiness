import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { ArticleCard, Topic } from "../lib/types";
import { ArticleTile, MoreLink, TopicTile } from "../components/Cards";
import { EmptyState, Notice, PageHeader, Spinner, TopicIcon } from "../components/ui";
import { Landscape } from "../components/Landscape";

export function WellnessCenter() {
  useSeo({ title: "Mental Wellness Center | #ChooseHappiness", description: "Plain-language education on emotions, stress, anxiety, depression, sleep, grief, relationships, burnout, resilience and seeking help.", path: "/wellness" });
  const { data: topics, loading } = useRpc<Topic[]>("list_topics", { p_pillar: "wellness" });
  const [q, setQ] = useState("");
  const { data: results } = useRpc<ArticleCard[]>(q.trim().length > 1 ? "list_articles" : null, { p_q: q.trim(), p_pillar: "wellness" });
  return (
    <>
      <PageHeader kicker="Mental Wellness Center" title="Understand. Support. Grow." intro="Clear, compassionate education about mental health and everyday well-being. This is general information, not a diagnosis or a replacement for professional care." />
      <div className="container-page mt-10">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="relative max-w-xl">
          <label htmlFor="w-search" className="sr-only">Search mental wellness topics</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="w-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mental wellness topics…" className="input rounded-full pl-12" />
        </form>
        {q.trim().length > 1 ? (
          <section aria-live="polite" className="mt-8">
            <h2 className="mb-4 text-2xl">Results for “{q.trim()}”</h2>
            {results && results.length === 0 ? <EmptyState title="Nothing matched">Try a different word, or browse the topics below.</EmptyState>
              : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(results ?? []).map((a) => <li key={a.slug}><ArticleTile a={a} /></li>)}</ul>}
          </section>
        ) : loading ? <Spinner /> : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(topics ?? []).map((t) => <li key={t.slug}><TopicTile t={t} /></li>)}</ul>
        )}
        <div className="mt-12"><Notice title="When to reach out for professional help">If difficult feelings last for weeks, get in the way of daily life, or you have thoughts of harming yourself, please talk with a doctor or licensed mental health professional. <Link className="link" to="/topics/seeking-help">How to find help</Link> · <Link className="link" to="/get-help">Get help now</Link></Notice></div>
      </div>
    </>
  );
}

export function PerspectiveCenter() {
  useSeo({ title: "The Power of Perspective | #ChooseHappiness", description: "Learn how interpretations, assumptions and attention shape experience, with interactive reflection exercises.", path: "/perspective" });
  const { data: topics } = useRpc<Topic[]>("list_topics", { p_pillar: "perspective" });
  const { data: exercises } = useRpc<ArticleCard[]>("list_articles", { p_kind: "exercise" });
  const icon = (slug: string | null) => topics?.find((t) => t.slug === slug)?.icon;
  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-line">
        <Landscape variant="path" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ivory/95 via-ivory/85 to-ivory/30" aria-hidden="true" />
        <div className="container-page py-16 sm:py-24">
          <p className="kicker mb-3">The Power of Perspective</p>
          <h1 className="max-w-2xl text-4xl sm:text-5xl">How we see a moment can shape how we meet it</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink/90">Interpretations, expectations, assumptions and attention all influence how we experience a situation. These modules invite you to look again, gently. They are not about blaming yourself, forcing positivity, or pretending a harmful situation is acceptable.</p>
          <div className="mt-6"><MoreLink to="/manifesto">Read: The Choice That Changes the View</MoreLink></div>
        </div>
      </header>
      <section aria-labelledby="mods" className="container-page mt-12">
        <h2 id="mods" className="mb-5 text-3xl">Modules</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{(topics ?? []).map((t) => <li key={t.slug}><TopicTile t={t} /></li>)}</ul>
      </section>
      <section aria-labelledby="exs" className="container-page mt-16">
        <h2 id="exs" className="text-3xl">Interactive exercises</h2>
        <p className="mb-5 mt-2 text-muted">Step-by-step reflections with fictional examples. If you're signed in, you can save your answers privately to your journal.</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{(exercises ?? []).map((a) => <li key={a.slug}><ArticleTile a={a} topicIcon={icon(a.topic_slug)} /></li>)}</ul>
      </section>
      <div className="container-page mt-12"><Notice>Changing how you look at a situation can help, but it doesn't cure a mental health condition and it doesn't make harm acceptable. If you're struggling, a licensed professional can help. <Link className="link" to="/get-help">Support options</Link></Notice></div>
    </>
  );
}

export function TopicPage() {
  const { slug = "" } = useParams();
  const { data: topic, loading } = useRpc<(Topic & { articles: ArticleCard[] }) | null>("get_topic", { p_slug: slug });
  useSeo({ title: `${topic?.title ?? "Topic"} | #ChooseHappiness`, description: topic?.summary, path: `/topics/${slug}` });
  if (loading) return <Spinner />;
  if (!topic) return <div className="container-page py-16"><EmptyState h1 title="Topic not found" action={<Link className="btn-primary" to="/wellness">Browse topics</Link>} /></div>;
  const articles = topic.articles.filter((a) => a.kind !== "exercise");
  const exercises = topic.articles.filter((a) => a.kind === "exercise");
  return (
    <>
      <PageHeader kicker={topic.pillar === "wellness" ? "Mental Wellness" : "The Power of Perspective"} title={topic.title} intro={topic.summary}>
        <div className="mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-paper text-sage-dark shadow-sm"><TopicIcon name={topic.icon} className="h-7 w-7" /></div>
      </PageHeader>
      <div className="container-page mt-10 space-y-12">
        <section aria-labelledby="ta">
          <h2 id="ta" className="mb-4 text-2xl">Articles</h2>
          {articles.length ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.map((a) => <li key={a.slug}><ArticleTile a={a} /></li>)}</ul>
            : <EmptyState title="More on this topic is coming soon" />}
        </section>
        {exercises.length > 0 && (
          <section aria-labelledby="te">
            <h2 id="te" className="mb-4 text-2xl">Guided exercises</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{exercises.map((a) => <li key={a.slug}><ArticleTile a={a} /></li>)}</ul>
          </section>
        )}
        <MoreLink to={topic.pillar === "wellness" ? "/wellness" : "/perspective"}>Back to all {topic.pillar === "wellness" ? "wellness topics" : "perspective modules"}</MoreLink>
      </div>
    </>
  );
}
