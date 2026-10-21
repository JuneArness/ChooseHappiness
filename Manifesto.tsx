import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { EvidenceItem, Page } from "../lib/types";
import { Landscape } from "../components/Landscape";
import { Badge, Spinner } from "../components/ui";

export default function Manifesto() {
  const { data: page, loading } = useRpc<Page | null>("get_page", { p_slug: "manifesto" });
  const { data: ev } = useRpc<Page | null>("get_page", { p_slug: "evidence-summary" });
  useSeo({ title: "The Choice That Changes the View | #ChooseHappiness", description: "You may not choose every circumstance. You can learn to choose how you meet it.", path: "/manifesto" });
  if (loading) return <Spinner />;
  let evidence: EvidenceItem[] = [];
  try { evidence = JSON.parse(ev?.body ?? "[]"); } catch { evidence = []; }
  const paras = (page?.body ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <header className="relative isolate overflow-hidden">
        <Landscape className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-ivory/60" aria-hidden="true" />
        <div className="container-read py-24 text-center sm:py-32">
          <p className="kicker mb-4">Our manifesto · Brand philosophy</p>
          <h1 className="text-4xl sm:text-6xl">{page?.title ?? "The Choice That Changes the View"}</h1>
        </div>
      </header>

      <div className="container-read py-16">
        {paras.map((p, i) => {
          const isQuestions = (p.match(/\?/g) ?? []).length >= 3;
          if (i === 0) return <p key={i} className="fade-in font-serif text-3xl leading-snug text-evergreen sm:text-4xl">{p}</p>;
          if (isQuestions) return (
            <ul key={i} className="my-14 space-y-3 border-l-4 border-terracotta/60 pl-6" aria-label="Questions to consider">
              {p.split(/(?<=\?)\s+/).map((q) => <li key={q} className="font-serif text-2xl italic text-evergreen">{q}</li>)}
            </ul>
          );
          const last = i === paras.length - 1;
          return <p key={i} className={last ? "mt-14 font-serif text-2xl leading-snug text-evergreen sm:text-3xl" : "mt-8 text-xl leading-relaxed text-ink"}>{p}</p>;
        })}
        <div className="mt-12 flex flex-wrap gap-3"><Link to="/journey" className="btn-primary">Begin My Journey</Link><Link to="/perspective" className="btn-secondary">Explore Perspective</Link></div>
      </div>

      <section aria-labelledby="ev-h" className="border-t border-line bg-paper py-16">
        <div className="container-page">
          <p className="kicker mb-3">Research & evidence</p>
          <h2 id="ev-h" className="text-3xl sm:text-4xl">What research suggests</h2>
          <p className="mt-3 max-w-3xl text-lg text-muted">The manifesto above is our philosophy, not a scientific claim. Below is what published research says about some of the ideas behind it, including how strong the evidence is and where it falls short.</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {evidence.map((e) => (
              <li key={e.topic} className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl">{e.topic}</h3>
                  <Badge tone={e.strength === "Established" ? "sage" : e.strength === "Promising" ? "mist" : "warn"}>Evidence: {e.strength}</Badge>
                </div>
                <p className="mt-3">{e.finding}</p>
                <p className="mt-2 text-[0.95rem] text-muted"><b>Limitation:</b> {e.limitation}</p>
                <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="link mt-3 inline-flex items-center gap-1 text-sm">{e.source_title}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[0.95rem] text-muted">Research findings describe averages across groups of people. They can't predict what will work for you, and none of these practices replaces professional care. <Link to="/research" className="link">See our full Research & Evidence page</Link></p>
        </div>
      </section>
    </>
  );
}
