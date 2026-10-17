import { Link, useParams } from "react-router-dom";
import { useApp, useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { Page } from "../lib/types";
import { Markdown } from "../components/Markdown";
import { CrisisPanel } from "../components/CrisisPanel";
import { CRISIS_VERIFIED_ON } from "../data/crisis";
import { EmptyState, Notice, PageHeader, Spinner, fmtDate } from "../components/ui";

function usePage(slug: string) {
  return useRpc<Page | null>("get_page", { p_slug: slug });
}

function ReviewNote({ page }: { page: Page }) {
  if (!page.needs_professional_review) return null;
  return <Notice tone="warn" title="Draft for professional review">This page is a working draft. It will be reviewed by qualified professionals before launch. Last updated {fmtDate(page.updated_at)}.</Notice>;
}

export function About() {
  const { site } = useApp();
  const { data: page, loading } = usePage("about");
  useSeo({ title: "About & mission | #ChooseHappiness", description: page?.summary, path: "/about" });
  if (loading) return <Spinner />;
  return (
    <>
      <PageHeader kicker="About & mission" title={page?.title ?? "About #ChooseHappiness"} intro={page?.summary} />
      <div className="container-page mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="max-w-3xl">{page && <Markdown text={page.body} />}</div>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="card p-6 text-center">
            <img src="/brand/choosehappiness-badge-photo.webp" alt="#ChooseHappiness sunset badge" width={480} height={480} className="mx-auto h-40 w-40" />
            <p className="kicker mt-4">Founded by</p>
            <p className="mt-1 font-serif text-xl text-evergreen">{site?.founders}</p>
          </div>
          <Link to="/manifesto" className="btn-secondary w-full">Read our manifesto</Link>
        </aside>
      </div>
    </>
  );
}

export function Research() {
  const { data: page, loading } = usePage("research");
  useSeo({ title: "Research & evidence | #ChooseHappiness", description: page?.summary, path: "/research" });
  if (loading) return <Spinner />;
  if (!page) return <NotFound />;
  return (
    <>
      <PageHeader kicker="Research & evidence" title={page.title} intro={page.summary} />
      <div className="container-read mt-10 space-y-6"><ReviewNote page={page} /><Markdown text={page.body} /></div>
    </>
  );
}

export function GetHelp() {
  const { data: page, loading } = usePage("get-help");
  useSeo({ title: "Get help now | #ChooseHappiness", description: "Crisis and support contacts, including the 988 Suicide & Crisis Lifeline.", path: "/get-help" });
  return (
    <>
      <header className="border-b border-line bg-clay-50/70">
        <div className="container-read py-12">
          <p className="kicker mb-3">Get help now</p>
          <h1 className="text-4xl sm:text-5xl">You don't have to go through this alone</h1>
          <p className="mt-4 text-lg">If you are in immediate danger or there's a life-threatening emergency, <b>call 911</b> or go to the nearest emergency room.</p>
        </div>
      </header>
      <div className="container-read mt-8 space-y-8">
        <CrisisPanel heading="Talk to someone now: call or text 988" />
        {loading ? <Spinner /> : page && <><Markdown text={page.body} /><ReviewNote page={page} /></>}
        <p className="text-sm text-muted">Phone numbers and services on this page were checked against the official websites on {CRISIS_VERIFIED_ON}. Services can change; the official sites are the final word.</p>
      </div>
    </>
  );
}

export function PolicyPage({ slug: fixed }: { slug?: string }) {
  const params = useParams();
  const slug = fixed ?? params.slug ?? "";
  const { data: page, loading } = usePage(slug);
  useSeo({ title: `${page?.title ?? "Page"} | #ChooseHappiness`, description: page?.summary, path: fixed ? `/${slug}` : `/pages/${slug}` });
  if (loading) return <Spinner />;
  if (!page || slug === "evidence-summary") return <NotFound />;
  return (
    <>
      <PageHeader title={page.title} intro={page.summary} />
      <div className="container-read mt-10 space-y-6"><ReviewNote page={page} /><Markdown text={page.body} /></div>
    </>
  );
}

export function NotFound() {
  useSeo({ title: "Page not found | #ChooseHappiness", noindex: true });
  return (
    <div className="container-page py-20">
      <EmptyState h1 title="We couldn't find that page" action={<div className="flex flex-wrap justify-center gap-3"><Link to="/" className="btn-primary">Go home</Link><Link to="/get-help" className="btn-secondary">Get help now</Link></div>}>
        The link may be old, or the page may have moved.
      </EmptyState>
    </div>
  );
}
