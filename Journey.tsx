import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Check, Footprints, HeartHandshake, NotebookPen, Pause, Route } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { ArticleCard, Journey } from "../lib/types";
import { CHECKIN, type CheckinOption } from "../data/checkin";
import { ArticleTile, MoreLink } from "../components/Cards";
import { ReflectBox, SaveButtons } from "../components/Reflect";
import { Landscape } from "../components/Landscape";
import { Markdown } from "../components/Markdown";
import { EmptyState, Spinner } from "../components/ui";

const STEPS = ["Check in", "Choose a path", "One small step", "Reflect", "Continue"];

export default function JourneyPage() {
  const { slug } = useParams();
  return slug ? <GuidedJourney slug={slug} /> : <JourneyFlow />;
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Journey steps">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${i === current ? "bg-evergreen text-white" : i < current ? "bg-sage-100 text-evergreen" : "bg-paper text-muted"}`}>
          {i < current ? <Check className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true">{i + 1}.</span>}{s}
        </li>
      ))}
    </ol>
  );
}

function JourneyFlow() {
  useSeo({ title: "The Choose Happiness Journey | #ChooseHappiness", description: "A simple, supportive path to check in, choose a focus, take one small step, and reflect, at your own pace.", path: "/journey" });
  const [params, setParams] = useSearchParams();
  const initial = CHECKIN.find((c) => c.id === params.get("checkin"));
  const [step, setStep] = useState(initial ? 1 : 0);
  const [choice, setChoice] = useState<CheckinOption | null>(initial ?? null);
  const [smallStep, setSmallStep] = useState("");
  const { data: all } = useRpc<ArticleCard[]>("list_articles");
  const { data: journeys } = useRpc<Journey[]>("list_journeys");
  useEffect(() => { document.getElementById("journey-panel")?.focus(); }, [step]);

  const recs = useMemo(() => {
    if (!choice || !all) return [];
    const want = [...choice.exercises, ...choice.articles];
    return want.map((s) => all.find((a) => a.slug === s)).filter(Boolean) as ArticleCard[];
  }, [choice, all]);
  const journey = journeys?.find((j) => j.slug === choice?.journey);
  const pick = (c: CheckinOption | null) => { setChoice(c); setStep(1); if (c) setParams({ checkin: c.id }, { replace: true }); };

  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-line">
        <Landscape variant="path" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ivory/95 via-ivory/85 to-ivory/40" aria-hidden="true" />
        <div className="container-page py-14 sm:py-20">
          <p className="kicker mb-3">The Choose Happiness Journey</p>
          <h1 className="max-w-2xl text-4xl sm:text-5xl">Small steps. Real change. Your pace.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink/90">A simple, optional path to help you focus, reflect and take one small step forward. No scores, no streaks, and no pressure to feel a certain way.</p>
        </div>
      </header>
      <div className="container-page mt-10">
        <Stepper current={step} />
        <section id="journey-panel" tabIndex={-1} aria-live="polite" className="card mt-6 p-6 focus:outline-none sm:p-8">
          {step === 0 && (
            <>
              <h2 className="text-3xl">How are you arriving today?</h2>
              <p className="mt-2 text-muted">Pick what fits best, or skip. This isn't a test and nothing here labels you.</p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {CHECKIN.map((c) => (
                  <li key={c.id}><button type="button" onClick={() => pick(c)} className="flex min-h-14 w-full items-center rounded-2xl border border-line bg-paper px-4 py-3 text-left font-medium hover:border-sage-dark hover:bg-sage-50">{c.label}</button></li>
                ))}
              </ul>
              <button type="button" className="btn-ghost btn-sm mt-5" onClick={() => pick(null)}>Skip the check-in</button>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="text-3xl">{choice ? "Here's a path you might try" : "Choose a path"}</h2>
              {choice && <p className="mt-2 text-muted">You said: “{choice.label}” <button type="button" className="link ml-1" onClick={() => setStep(0)}>Change</button></p>}
              {journey && (
                <Link to={`/journey/${journey.slug}`} className="mt-6 flex items-start gap-4 rounded-2xl border border-sage/50 bg-sage-50 p-5 hover:border-sage-dark">
                  <Route className="mt-1 h-6 w-6 flex-none text-sage-dark" aria-hidden="true" />
                  <span><span className="block font-serif text-xl text-evergreen">Guided journey: {journey.title}</span><span className="mt-1 block text-muted">{journey.summary} About {journey.minutes} minutes.</span></span>
                </Link>
              )}
              {recs.length > 0 && <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{recs.map((a) => <li key={a.slug}><ArticleTile a={a} /></li>)}</ul>}
              {choice?.community && <p className="mt-6"><MoreLink to={`/community/${choice.community}`}>Visit Everyday Encouragement in the community</MoreLink></p>}
              {!choice && <ul className="mt-6 grid gap-4 md:grid-cols-3">{(journeys ?? []).map((j) => <li key={j.slug}><JourneyTile j={j} /></li>)}</ul>}
              <div className="mt-8 flex flex-wrap gap-3"><button type="button" className="btn-primary" onClick={() => setStep(2)}>Next: one small step</button></div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-3xl">Take one small step</h2>
              <p className="mt-2 text-muted">Choose one that feels doable today, or write your own. Small counts.</p>
              <fieldset className="mt-6">
                <legend className="sr-only">Small steps</legend>
                <div className="space-y-2">
                  {(choice?.steps ?? ["Take a mindful pause: three slow breaths.", "Write down one thought that's on your mind.", "Reach out to someone you trust.", "Name one realistic next step for tomorrow."]).map((s) => (
                    <label key={s} className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 ${smallStep === s ? "border-sage-dark bg-sage-50" : "border-line"}`}>
                      <input type="radio" name="small-step" checked={smallStep === s} onChange={() => setSmallStep(s)} className="mt-1 h-4 w-4 accent-[#46664F]" /><span>{s}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-4"><label htmlFor="own-step" className="label">Or write your own</label><input id="own-step" className="input" value={CHECKIN.some((c) => c.steps.includes(smallStep)) ? "" : smallStep} onChange={(e) => setSmallStep(e.target.value)} /></div>
              <div className="mt-8 flex flex-wrap gap-3"><button type="button" className="btn-ghost" onClick={() => setStep(1)}>Back</button><button type="button" className="btn-primary" onClick={() => setStep(3)}>Next: reflect</button></div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="text-3xl">Reflect</h2>
              <p className="mt-2 text-muted">{smallStep ? <>Your step: <b className="text-evergreen">{smallStep}</b>. </> : null}How did it go, or how do you feel about trying it? Write as much or as little as you like. You can also come back later.</p>
              <div className="mt-6"><ReflectBox prompt={smallStep ? `My small step: ${smallStep}` : "Today's check-in"} source="journey" sourceRef={choice?.id ?? "check-in"} /></div>
              <div className="mt-8 flex flex-wrap gap-3"><button type="button" className="btn-ghost" onClick={() => setStep(2)}>Back</button><button type="button" className="btn-primary" onClick={() => setStep(4)}>Continue</button></div>
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="text-3xl">Continue at your own pace</h2>
              <p className="mt-2 text-muted">That's it for now. Whatever today looked like, showing up for yourself counts. There are no streaks to keep. Come back whenever you like.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Link to="/library" className="card flex items-center gap-3 p-4 hover:border-sage"><NotebookPen className="h-5 w-5 text-sage-dark" aria-hidden="true" />My library</Link>
                <Link to="/journal" className="card flex items-center gap-3 p-4 hover:border-sage"><Footprints className="h-5 w-5 text-sage-dark" aria-hidden="true" />My journal</Link>
                <Link to="/community" className="card flex items-center gap-3 p-4 hover:border-sage"><HeartHandshake className="h-5 w-5 text-sage-dark" aria-hidden="true" />Community</Link>
              </div>
              <button type="button" className="btn-secondary mt-6" onClick={() => { setChoice(null); setSmallStep(""); setStep(0); setParams({}, { replace: true }); }}>Start a new check-in</button>
            </>
          )}
        </section>
        <section aria-labelledby="gj" className="mt-14">
          <h2 id="gj" className="mb-4 text-3xl">Guided journeys</h2>
          <ul className="grid gap-4 md:grid-cols-3">{(journeys ?? []).map((j) => <li key={j.slug}><JourneyTile j={j} /></li>)}</ul>
        </section>
      </div>
    </>
  );
}

function JourneyTile({ j }: { j: Journey }) {
  return (
    <Link to={`/journey/${j.slug}`} className="card group flex h-full flex-col p-5 hover:border-sage/60 hover:bg-white">
      <Route className="h-6 w-6 text-sage-dark" aria-hidden="true" />
      <span className="mt-3 font-serif text-xl text-evergreen group-hover:text-sage-dark">{j.title}</span>
      <span className="mt-2 flex-1 text-[0.97rem] text-muted">{j.summary}</span>
      <span className="mt-3 text-sm text-muted">{j.steps.length} steps · about {j.minutes} min</span>
    </Link>
  );
}

function BreathingPause() {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  const phase = left > 0 ? (Math.floor((60 - left) / 5) % 2 === 0 ? "Breathe in…" : "Breathe out…") : "";
  return (
    <div className="mt-4 rounded-2xl bg-mist-50 p-5 text-center">
      {left > 0 ? (
        <>
          <p className="font-serif text-2xl text-evergreen" aria-live="polite">{phase}</p>
          <p className="mt-1 text-sm text-muted">{left} seconds left</p>
          <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => setLeft(0)}>Stop</button>
        </>
      ) : <button type="button" className="btn-secondary btn-sm" onClick={() => setLeft(60)}><Pause className="h-4 w-4" aria-hidden="true" />Start a 1-minute pause</button>}
    </div>
  );
}

function GuidedJourney({ slug }: { slug: string }) {
  const { data: journeys, loading } = useRpc<Journey[]>("list_journeys");
  const { data: topics } = useRpc<{ slug: string; title: string }[]>("list_topics");
  const { me } = useApp();
  const j = journeys?.find((x) => x.slug === slug);
  const [i, setI] = useState(0);
  useSeo({ title: `${j?.title ?? "Guided journey"} | #ChooseHappiness`, description: j?.summary, path: `/journey/${slug}` });
  useEffect(() => { document.getElementById("gj-panel")?.focus(); }, [i]);
  if (loading) return <Spinner />;
  if (!j) return <div className="container-page py-16"><EmptyState h1 title="Journey not found" action={<Link to="/journey" className="btn-primary">All journeys</Link>} /></div>;
  const s = j.steps[i];
  const done = i >= j.steps.length;
  const topicTitle = (t?: string) => topics?.find((x) => x.slug === t)?.title;
  return (
    <div className="container-read py-12">
      <Link to="/journey" className="link text-sm">← The Journey</Link>
      <h1 className="mt-4 text-4xl">{j.title}</h1>
      <p className="mt-3 text-lg text-muted">{j.summary}</p>
      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Steps">
        {j.steps.map((st, k) => <li key={st.title} aria-current={k === i ? "step" : undefined} className={`rounded-full px-3 py-1 text-sm font-semibold ${k === i ? "bg-evergreen text-white" : k < i ? "bg-sage-100 text-evergreen" : "bg-paper text-muted"}`}>{k + 1}</li>)}
      </ol>
      <section id="gj-panel" tabIndex={-1} aria-live="polite" className="card mt-6 p-6 focus:outline-none sm:p-8">
        {!done ? (
          <>
            <p className="kicker">Step {i + 1} of {j.steps.length}</p>
            <h2 className="mt-2 text-3xl">{s.title}</h2>
            <Markdown text={s.body} />
            {s.action === "pause" && <BreathingPause />}
            {s.action === "read" && s.link_slug && <p className="mt-4"><MoreLink to={`/topics/${s.link_slug}`}>Read: {topicTitle(s.link_slug) ?? "related articles"}</MoreLink></p>}
            {s.link_slug && s.action !== "read" && <p className="mt-4 text-sm"><Link className="link" to={`/topics/${s.link_slug}`}>Related: {topicTitle(s.link_slug) ?? "learn more"}</Link></p>}
            {(s.action === "reflect" || s.action === "plan" || s.action === "reach-out") && (
              <div className="mt-6"><ReflectBox prompt={s.reflect_prompt || s.title} source="journey" sourceRef={j.slug} label={s.reflect_prompt ? s.reflect_prompt : "Your thoughts (private)"} /></div>
            )}
            <div className="mt-8 flex justify-between gap-3">
              <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
              <button type="button" className="btn-primary" onClick={() => setI(i + 1)}>{i < j.steps.length - 1 ? "Next step" : "Finish"}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-3xl">You finished this journey</h2>
            <p className="mt-3 text-muted">Thank you for taking this time. If it didn't help much today, that's okay too. You can return anytime.</p>
            {me && <div className="mt-5"><SaveButtons type="journey" slug={j.slug} completable /></div>}
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/journey" className="btn-primary">Back to The Journey</Link><button type="button" className="btn-secondary" onClick={() => setI(0)}>Start again</button></div>
          </>
        )}
      </section>
    </div>
  );
}
