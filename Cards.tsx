import { Link } from "react-router-dom";
import { ArrowRight, Clock, PenLine } from "lucide-react";
import type { ArticleCard, Topic } from "../lib/types";
import { Badge, TopicIcon } from "./ui";

export const articleHref = (a: Pick<ArticleCard, "kind" | "slug">) => (a.kind === "exercise" ? `/exercises/${a.slug}` : `/articles/${a.slug}`);

export function ArticleTile({ a, topicIcon }: { a: ArticleCard; topicIcon?: string }) {
  return (
    <Link to={articleHref(a)} className="card group flex h-full flex-col p-5 transition-colors hover:border-sage/60 hover:bg-white">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {a.kind === "exercise" ? <Badge tone="clay"><PenLine className="mr-1 h-3 w-3" aria-hidden="true" />Guided exercise</Badge> : <Badge tone={a.pillar === "perspective" ? "mist" : "sage"}>{a.pillar === "perspective" ? "Perspective" : "Mental wellness"}</Badge>}
        {a.sensitive && <Badge tone="warn">Content note</Badge>}
        {!a.published && <Badge tone="warn">Draft</Badge>}
      </div>
      <h3 className="flex items-start gap-2 text-xl leading-snug group-hover:text-sage-dark">
        {topicIcon && <TopicIcon name={topicIcon} className="mt-0.5 h-5 w-5 flex-none text-sage" />}{a.title}
      </h3>
      <p className="mt-2 flex-1 text-[0.97rem] text-muted">{a.summary}</p>
      <p className="mt-4 flex items-center gap-1.5 text-sm text-muted"><Clock className="h-4 w-4" aria-hidden="true" />{a.reading_minutes} min</p>
    </Link>
  );
}

export function TopicTile({ t }: { t: Topic }) {
  return (
    <Link to={`/topics/${t.slug}`} className="card group flex h-full items-start gap-4 p-5 transition-colors hover:border-sage/60 hover:bg-white">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-sage-50 text-sage-dark"><TopicIcon name={t.icon} /></span>
      <span className="min-w-0">
        <span className="block font-serif text-lg text-evergreen group-hover:text-sage-dark">{t.title}</span>
        <span className="mt-1 block text-[0.95rem] text-muted">{t.summary}</span>
      </span>
    </Link>
  );
}

export function MoreLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="inline-flex items-center gap-1.5 font-semibold text-sage-dark hover:underline">{children}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>;
}
