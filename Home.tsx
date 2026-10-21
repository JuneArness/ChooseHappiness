import { Link } from "react-router-dom";
import { BookOpen, Brain, Compass, Users } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { ArticleCard, Category, Prompt, Topic } from "../lib/types";
import { CHECKIN } from "../data/checkin";
import { asset } from "../lib/backend";
import { Landscape } from "../components/Landscape";
import { ArticleTile, MoreLink, TopicTile } from "../components/Cards";
import { CrisisPanel } from "../components/CrisisPanel";

export default function Home() {
  const { site, me } = useApp();
  const { data: topics } = useRpc<Topic[]>("list_topics");
  const { data: articles } = useRpc<ArticleCard[]>("list_articles");
  const { data: cats } = useRpc<Category[]>("list_categories");
  const { data: prompt } = useRpc<Prompt | null>("get_daily_prompt");
  useSeo({
    title: "#ChooseHappiness | Begin the journey when the paths are before you",
    description: "A mental wellness education and peer-support community. Explore your thoughts, discover new perspectives, and make room for growth.",
    path: "/",
    jsonLd: { "@context": "https://schema.org", "@type": "Organization", name: "#ChooseHappiness", slogan: site?.tagline,
      founder: (site?.founders ?? "").split(/\s*(?:&|\band\b)\s*/).filter(Boolean).map((name) => ({ "@type": "Person", name })) },
  });
  const wellness = (topics ?? []).filter((t) => t.pillar === "wellness");
  const perspective = (topics ?? []).filter((t) => t.pillar === "perspective");
  const exercises = (articles ?? []).filter((a) => a.kind === "exercise");
  const featured = (articles ?? []).filter((a) => a.kind === "article").sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 3);
  const icon = (slug: string | null) => topics?.find((t) => t.slug === slug)?.icon;

  return (
    <>
      {/* 1. Hero */}
      <section className="relative isolate overflow-hidden">
        {site?.hero_image_url
          ? <img src={site.hero_image_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          : <Landscape className="absolute inset-0 -z-10 h-full w-full" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ivory/95 via-ivory/80 to-ivory/10" aria-hidden="true" />
        <div className="container-page py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl fade-in">
            <p className="kicker mb-4">#ChooseHappiness</p>
            <h1 className="text-[2.5rem] leading-[1.1] sm:text-6xl">Your next chapter can begin with a different perspective.</h1>
            <p className="mt-6 text-lg text-ink/90 sm:text-xl">Life presents us with paths we didn't expect, challenges we didn't choose, and opportunities we may not immediately recognize. #ChooseHappiness is a place to pause, reflect, connect, and discover the possibilities that may still lie ahead.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/journey" className="btn-primary px-7">Begin My Journey</Link>
              <Link to="/wellness" className="btn-secondary px-7">Explore Mental Wellness</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section aria-label="What you'll find here" className="border-y border-line bg-paper">
        <ul className="container-page grid grid-cols-2 gap-px py-2 lg:grid-cols-4">
          {[[Brain, "Mental Wellness", "Learn practical, healthy coping tools.", "/wellness"], [Compass, "The Power of Perspective", "See new possibilities in everyday moments.", "/perspective"],
            [Users, "Community", "You're not alone. Find your people.", "/community"], [BookOpen, "Resources & Research", "Evidence-informed tools for real life.", "/resources"]].map(([I, t, d, to]) => {
            const Icon = I as typeof Brain;
            return (
              <li key={t as string}>
                <Link to={to as string} className="flex h-full flex-col items-center gap-2 rounded-2xl px-3 py-6 text-center hover:bg-sage-50">
                  <Icon className="h-7 w-7 text-sage-dark" strokeWidth={1.6} aria-hidden="true" />
                  <span className="font-serif text-lg text-evergreen">{t as string}</span>
                  <span className="text-sm text-muted">{d as string}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 1. Welcome */}
      <section className="container-page mt-20 grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="kicker mb-3">Welcome</p>
          <h2 className="text-3xl sm:text-4xl">Welcome to #ChooseHappiness</h2>
          <p className="mt-4 text-lg text-muted">A place for your mind, your perspective, and your journey. Here you can learn about mental wellness in plain language, try short guided reflections, keep a private journal, and connect with others in a moderated community.</p>
          <p className="mt-4 text-lg text-muted">We are a wellness education and peer-support platform. We're not therapy or medical care, and we'll always point you toward professional help when it's the right next step.</p>
          <div className="mt-6"><MoreLink to="/about">Learn more about us</MoreLink></div>
        </div>
        <figure className="card relative overflow-hidden p-8 sm:p-10">
          <Landscape variant="path" className="absolute inset-0 h-full w-full opacity-30" />
          <blockquote className="relative font-serif text-2xl leading-snug text-evergreen sm:text-3xl">“Happiness isn't about pretending life is perfect. It's about discovering healthier ways to meet life as it is.”</blockquote>
          <figcaption className="relative mt-4 text-sm font-semibold text-muted">Our philosophy</figcaption>
        </figure>
      </section>

      {/* 2. Where would you like to begin? */}
      <section aria-labelledby="begin-h" className="container-page mt-20">
        <div className="card bg-gradient-to-br from-paper to-sage-50 p-6 sm:p-10">
          <h2 id="begin-h" className="text-3xl">Where would you like to begin?</h2>
          <p className="mt-2 text-muted">Choose whatever fits today. There's no wrong answer, and you can skip this anytime.</p>
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {CHECKIN.map((c) => (
              <li key={c.id}><Link to={`/journey?checkin=${c.id}`} className="inline-flex min-h-11 items-center rounded-full border border-sage/40 bg-paper px-4 text-[0.97rem] font-medium hover:border-sage-dark hover:bg-white">{c.label}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Mental wellness education */}
      <section aria-labelledby="mw-h" className="container-page mt-20">
        <SectionHead id="mw-h" kicker="Mental wellness" title="Understand. Support. Grow." link={["/wellness", "All wellness topics"]} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wellness.slice(0, 6).map((t) => <li key={t.slug}><TopicTile t={t} /></li>)}
        </ul>
      </section>

      {/* 4. The Power of Perspective */}
      <section aria-labelledby="pp-h" className="mt-20 bg-mist-50/70 py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="kicker mb-3">The Power of Perspective</p>
            <h2 id="pp-h" className="text-3xl sm:text-4xl">See beyond the moment</h2>
            <p className="mt-4 text-lg text-muted">How we interpret a situation can shape how we experience it. These modules help you notice assumptions, find what's within your control, and consider other views, without pretending that hard things aren't hard.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/perspective" className="btn-primary">Explore Perspective</Link><Link to="/manifesto" className="btn-secondary">Read our manifesto</Link></div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {perspective.map((t) => <li key={t.slug}><TopicTile t={t} /></li>)}
          </ul>
        </div>
      </section>

      {/* 5. Daily reflection */}
      <section aria-labelledby="dr-h" className="container-page mt-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-evergreen px-6 py-12 text-center text-white sm:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#F2D3B8]">Today's reflection</p>
          <h2 id="dr-h" className="mx-auto mt-4 max-w-3xl font-serif text-3xl text-white sm:text-4xl">“{prompt?.text ?? "What is one thing I can influence today?"}”</h2>
          <p className="mt-4 text-[#D6E2D9]">Take a moment with it. If you'd like, save your thoughts privately.</p>
          <Link to="/reflection" className="btn mt-6 bg-white text-evergreen hover:bg-sage-50">Reflect on today's question</Link>
        </div>
      </section>

      {/* 6. Guided self-reflection exercises */}
      <section aria-labelledby="ex-h" className="container-page mt-20">
        <SectionHead id="ex-h" kicker="Guided exercises" title="Short, step-by-step reflections" link={["/resources?kind=exercise", "All exercises"]} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {exercises.slice(0, 4).map((a) => <li key={a.slug}><ArticleTile a={a} topicIcon={icon(a.topic_slug)} /></li>)}
        </ul>
      </section>

      {/* 7. Community preview */}
      <section aria-labelledby="cm-h" className="container-page mt-20 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="kicker mb-3">Community</p>
          <h2 id="cm-h" className="text-3xl sm:text-4xl">Real conversations. A supportive space.</h2>
          <p className="mt-4 text-lg text-muted">Share experiences, encouragement and questions with other members. Discussions are for signed-in members only, follow our community guidelines, and are moderated. Peer support isn't professional care or crisis support.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link to="/community" className="btn-primary">Visit the community</Link><Link to="/guidelines" className="btn-secondary">Community guidelines</Link></div>
        </div>
        <ul className="card divide-y divide-line">
          {(cats ?? []).map((c) => (
            <li key={c.slug}>
              <Link to={`/community/${c.slug}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sage-50">
                <span className="min-w-0"><span className="block font-semibold text-evergreen">{c.name}</span><span className="block text-sm text-muted">{c.description}</span></span>
                <span className="flex-none text-sm text-muted">{c.thread_count ?? 0} {c.thread_count === 1 ? "discussion" : "discussions"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 8. Research-informed articles */}
      <section aria-labelledby="ra-h" className="container-page mt-20">
        <SectionHead id="ra-h" kicker="Research-informed" title="Articles grounded in evidence" link={["/research", "How we use research"]} />
        <ul className="grid gap-4 md:grid-cols-3">
          {featured.map((a) => <li key={a.slug}><ArticleTile a={a} topicIcon={icon(a.topic_slug)} /></li>)}
        </ul>
      </section>

      {/* 9. Philosophy and mission */}
      <section aria-labelledby="ph-h" className="container-page mt-20">
        <div className="grid items-center gap-8 rounded-[2rem] border border-line bg-clay-50/60 p-6 sm:p-10 lg:grid-cols-[auto_1fr]">
          <img src={asset("/brand/choosehappiness-badge-photo.webp")} alt="#ChooseHappiness sunset badge" width={480} height={480} loading="lazy" className="mx-auto h-40 w-40 sm:h-48 sm:w-48" />
          <div>
            <p className="kicker mb-3">Our philosophy & mission</p>
            <h2 id="ph-h" className="text-3xl">“Begin the journey to choose happiness when the paths are before you.”</h2>
            <p className="mt-4 text-lg text-muted">You may not choose every circumstance. You can learn to choose how you meet it. Our mission is to help improve mental well-being and personal perspective through accessible education, thoughtful reflection, healthy coping practices, community, and encouragement.</p>
            <div className="mt-5 flex flex-wrap gap-4"><MoreLink to="/manifesto">The Choice That Changes the View</MoreLink><MoreLink to="/about">Our mission</MoreLink></div>
          </div>
        </div>
      </section>

      {/* 10. Support resources */}
      <section aria-label="Support resources" className="container-page mt-20">
        <CrisisPanel heading="Need support right now?" compact />
      </section>

      {/* 11. Join */}
      {!me && (
        <section aria-labelledby="jn-h" className="container-page mt-20 text-center">
          <h2 id="jn-h" className="text-3xl sm:text-4xl">Join the community</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted">A free account gives you a private journal, saved resources, your personal journey, and access to member discussions.</p>
          <Link to="/signup" className="btn-primary mt-6 px-8">Create a free account</Link>
        </section>
      )}

      {/* 12. Final CTA */}
      <section aria-labelledby="cta-h" className="relative isolate mt-20 overflow-hidden">
        <Landscape variant="lake" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-ivory/70" aria-hidden="true" />
        <div className="container-page py-20 text-center">
          <h2 id="cta-h" className="text-4xl sm:text-5xl">Take the Next Step</h2>
          <p className="mx-auto mt-4 max-w-xl font-serif text-xl italic text-evergreen">You don't have to have everything figured out to take your next step.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link to="/journey" className="btn-primary px-8">Begin My Journey</Link><Link to="/reflection" className="btn-secondary px-8">Try today's reflection</Link></div>
        </div>
      </section>
    </>
  );
}

function SectionHead({ id, kicker, title, link }: { id: string; kicker: string; title: string; link?: [string, string] }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><p className="kicker mb-2">{kicker}</p><h2 id={id} className="text-3xl sm:text-4xl">{title}</h2></div>
      {link && <MoreLink to={link[0]}>{link[1]}</MoreLink>}
    </div>
  );
}
