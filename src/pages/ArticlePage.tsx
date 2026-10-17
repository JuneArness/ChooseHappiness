import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ExternalLink, Info, Printer, Stethoscope } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { useSeo } from "../lib/seo";
import type { Article, ExerciseStep } from "../lib/types";
import { Markdown } from "../components/Markdown";
import { ArticleTile } from "../components/Cards";
import { ReflectBox, SaveButtons, useHighRisk } from "../components/Reflect";
import { CrisisPanel } from "../components/CrisisPanel";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, Notice, Spinner, fmtDate } from "../components/ui";

export default function ArticlePage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const { data: a, loading } = useRpc<Article | null>("get_article", { p_slug: slug });
  useSeo({ title: `${a?.title ?? "Article"} | #ChooseHappiness`, description: a?.summary, path: `/${a?.kind === "exercise" ? "exercises" : "articles"}/${slug}`,
    jsonLd: a && a.kind === "article" ? { "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.summary, author: { "@type": "Organization", name: a.author }, dateModified: a.updated_at } : null });
  if (loading) return <Spinner />;
  if (!a) return <div className="container-page py-16"><EmptyState h1 title="We couldn't find that page" action={<Link to="/resources" className="btn-primary">Browse resources</Link>} /></div>;
  const isExercise = a.kind === "exercise";
  if (isExercise && params.get("worksheet")) return <Worksheet a={a} />;
  return (
    <article className="pb-6">
      <header className="border-b border-line bg-gradient-to-b from-sage-50 to-ivory">
        <div className="container-read py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
            <Link className="hover:underline" to={a.pillar === "wellness" ? "/wellness" : "/perspective"}>{a.pillar === "wellness" ? "Mental Wellness" : "Perspective"}</Link>
            {a.topic && <> <span aria-hidden="true">/</span> <Link className="hover:underline" to={`/topics/${a.topic.slug}`}>{a.topic.title}</Link></>}
          </nav>
          {!a.published && <p className="mb-3"><Badge tone="warn">Draft preview: not visible to the public</Badge></p>}
          <p className="kicker mb-2">{isExercise ? `Guided exercise · ${a.reading_minutes} min` : `Article · ${a.reading_minutes} min read`}</p>
          <h1 className="text-4xl sm:text-5xl">{a.title}</h1>
          <p className="mt-4 text-lg text-muted">{a.summary}</p>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>By {a.author}</span><span aria-hidden="true">·</span><span>Updated {fmtDate(a.updated_at)}</span><span aria-hidden="true">·</span>
            <span>{a.reviewed_by_professional ? "Reviewed by a licensed professional" : "General education. Not yet reviewed by a licensed clinician."}</span>
          </p>
          <div className="mt-5"><SaveButtons type={isExercise ? "exercise" : "article"} slug={a.slug} completable /></div>
        </div>
      </header>

      <div className="container-read mt-8 space-y-8">
        {a.sensitive && (
          <Notice tone="warn" title="Content note">
            {a.content_note || "This page discusses topics some readers may find difficult."} Take breaks as you need. If you're in crisis, <Link className="link" to="/get-help">support is available now</Link>.
          </Notice>
        )}
        {isExercise ? <Exercise a={a} /> : <ArticleBody a={a} />}

        {a.professional_note && (
          <aside className="flex gap-3 rounded-2xl border border-mist bg-mist-50 p-5" aria-label="When to seek professional support">
            <Stethoscope className="mt-0.5 h-5 w-5 flex-none text-[#28485A]" aria-hidden="true" />
            <div><p className="font-semibold">When to seek professional support</p><p className="mt-1 text-[0.97rem]">{a.professional_note}</p></div>
          </aside>
        )}

        {(a.sources.length > 0 || a.evidence_note) && (
          <section aria-labelledby="src" className="border-t border-line pt-6">
            <h2 id="src" className="text-2xl">Sources and evidence</h2>
            {a.evidence_note && <p className="mt-2 flex gap-2 text-[0.97rem] text-muted"><Info className="mt-1 h-4 w-4 flex-none" aria-hidden="true" />{a.evidence_note}</p>}
            <ol className="mt-4 list-decimal space-y-2 pl-6 text-[0.95rem]">
              {a.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="link">{s.title}<ExternalLink className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
                  {(s.publisher || s.year) && <span className="text-muted">. {[s.publisher, s.year].filter(Boolean).join(", ")}.</span>}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted">This is general educational content written by the #ChooseHappiness editorial team. It is not medical advice, a diagnosis, or a substitute for care from a qualified professional. <Link to="/research" className="link">How we use research</Link></p>
          </section>
        )}

        {a.sensitive && <CrisisPanel compact heading="If you're struggling right now, you don't have to handle it alone." />}
      </div>

      {a.related_cards.length > 0 && (
        <section aria-labelledby="rel" className="container-page mt-14">
          <h2 id="rel" className="mb-4 text-2xl">Related</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{a.related_cards.map((r) => <li key={r.slug}><ArticleTile a={r} /></li>)}</ul>
        </section>
      )}
    </article>
  );
}

function ArticleBody({ a }: { a: Article }) {
  return (
    <>
      <Markdown text={a.body} />
      {a.takeaways.length > 0 && (
        <section aria-labelledby="tk" className="rounded-3xl bg-sage-50 p-6">
          <h2 id="tk" className="text-2xl">Practical takeaways</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-sage">{a.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}
      {a.prompts.length > 0 && (
        <section aria-labelledby="rp" className="card p-6">
          <h2 id="rp" className="text-2xl">Reflection prompts</h2>
          <p className="mt-1 text-muted">Optional. Pick one that speaks to you.</p>
          <PromptPicker prompts={a.prompts} sourceRef={a.slug} />
        </section>
      )}
      {a.exercise && (
        <section aria-labelledby="oe" className="rounded-3xl border border-clay bg-clay-50/60 p-6">
          <h2 id="oe" className="text-2xl">Try it: optional exercise</h2>
          <Markdown text={a.exercise} />
        </section>
      )}
    </>
  );
}

function PromptPicker({ prompts, sourceRef }: { prompts: string[]; sourceRef: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="mt-4 space-y-4">
      <fieldset>
        <legend className="sr-only">Choose a prompt</legend>
        <div className="space-y-2">
          {prompts.map((p, k) => (
            <label key={p} className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 ${i === k ? "border-sage-dark bg-sage-50" : "border-line"}`}>
              <input type="radio" name={`pp-${sourceRef}`} checked={i === k} onChange={() => setI(k)} className="mt-1 h-4 w-4 accent-[#46664F]" /><span>{p}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <ReflectBox prompt={prompts[i]} source="reflection" sourceRef={sourceRef} />
    </div>
  );
}

function Exercise({ a }: { a: Article }) {
  const { me, call } = useApp();
  const toast = useToast();
  const isRisky = useHighRisk();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedOk, setSavedOk] = useState(false);
  const steps = a.steps;
  const s: ExerciseStep | undefined = steps[step];
  const risk = Object.values(answers).some((v) => isRisky(v));
  const set = (id: string, v: string) => setAnswers((x) => ({ ...x, [id]: v }));

  async function saveToJournal() {
    setBusy(true); setError("");
    const body = steps.map((st) => `${st.prompt}\n${answers[st.id]?.trim() || "(skipped)"}`).join("\n\n");
    try {
      await call("save_journal_entry", { p: { title: a.title, body, prompt: a.title, source: "exercise", source_ref: a.slug } });
      await call("toggle_saved", { p_type: "exercise", p_ref: a.slug, p_status: "completed" }).catch(() => {});
      setSavedOk(true); toast("Saved to your private journal.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {a.intro && <Markdown text={a.intro} />}
      {a.example && (
        <details className="rounded-2xl border border-line bg-paper p-5">
          <summary className="cursor-pointer font-semibold text-evergreen">See a worked example (fictional)</summary>
          <Markdown text={a.example} className="prose-calm mt-3" />
        </details>
      )}
      {!done ? (
        <section aria-labelledby="ex-step" className="card p-6">
          <div className="mb-4 flex items-center justify-between gap-4 text-sm text-muted">
            <span>Step {step + 1} of {steps.length}</span>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-sage-100" role="progressbar" aria-label="Exercise progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
              <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
          {s && <StepInput step={s} value={answers[s.id] ?? ""} onChange={(v) => set(s.id, v)} />}
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button type="button" className="btn-ghost btn-sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost btn-sm" onClick={() => (step < steps.length - 1 ? setStep(step + 1) : setDone(true))}>Skip</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => (step < steps.length - 1 ? setStep(step + 1) : setDone(true))}>{step < steps.length - 1 ? "Next" : "Finish"}</button>
            </div>
          </div>
        </section>
      ) : (
        <section aria-labelledby="ex-done" className="card space-y-4 p-6">
          <h2 id="ex-done" className="text-2xl">You made it through</h2>
          {a.closing && <Markdown text={a.closing} />}
          {me ? (
            savedOk ? <p className="font-semibold text-sage-dark">Saved privately. <Link to="/journal" className="link">Open my journal</Link></p>
              : <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn-primary btn-sm" onClick={saveToJournal} disabled={busy}>{busy ? "Saving…" : "Save my answers to my private journal"}</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setAnswers({}); setStep(0); setDone(false); }}>Start over</button>
                </div>
          ) : <p className="text-muted">Your answers weren't saved. <Link to="/signin" className="link">Sign in</Link> to keep reflections in a private journal.</p>}
          {error && <p role="alert" className="text-sm font-semibold text-[#8C2F2F]">{error}</p>}
          {risk && <CrisisPanel compact />}
        </section>
      )}
      <p className="flex gap-2 text-sm text-muted"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />This exercise is for reflection and education. It isn't a psychological assessment or treatment.</p>
    </div>
  );
}

function StepInput({ step, value, onChange }: { step: ExerciseStep; value: string; onChange: (v: string) => void }) {
  const id = `step-${step.id}`;
  return (
    <div>
      <h2 id="ex-step" className="text-2xl"><label htmlFor={step.type === "choice" ? undefined : id}>{step.prompt}</label></h2>
      {step.help && <p className="mt-1 text-muted" id={`${id}-help`}>{step.help}</p>}
      <div className="mt-4">
        {step.type === "text" && <textarea id={id} aria-describedby={step.help ? `${id}-help` : undefined} className="input min-h-32" value={value} onChange={(e) => onChange(e.target.value)} />}
        {step.type === "choice" && (
          <fieldset><legend className="sr-only">{step.prompt}</legend>
            <div className="space-y-2">
              {(step.options ?? []).map((o) => (
                <label key={o} className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 ${value === o ? "border-sage-dark bg-sage-50" : "border-line"}`}>
                  <input type="radio" name={id} checked={value === o} onChange={() => onChange(o)} className="mt-1 h-4 w-4 accent-[#46664F]" /><span>{o}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {step.type === "scale" && (
          <div>
            <input id={id} type="range" min={step.min ?? 0} max={step.max ?? 10} value={value || String(Math.round(((step.min ?? 0) + (step.max ?? 10)) / 2))}
              onChange={(e) => onChange(e.target.value)} className="h-11 w-full accent-[#46664F]" aria-valuetext={`${value || "not set"}`} />
            <div className="flex justify-between text-sm text-muted"><span>{step.label_min ?? step.min ?? 0}</span><span className="font-semibold text-evergreen">{value || "Not set"}</span><span>{step.label_max ?? step.max ?? 10}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Printable worksheet version of an exercise (print or "Save as PDF" from the browser). */
function Worksheet({ a }: { a: Article }) {
  return (
    <div className="container-read py-10">
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <button type="button" className="btn-primary btn-sm" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" />Print or save as PDF</button>
        <Link to={`/exercises/${a.slug}`} className="btn-secondary btn-sm">Do it online instead</Link>
      </div>
      <p className="kicker">#ChooseHappiness worksheet</p>
      <h1 className="mt-2 text-4xl">{a.title}</h1>
      <p className="mt-3 text-muted">{a.summary}</p>
      <ol className="mt-8 space-y-8">
        {a.steps.map((s, i) => (
          <li key={s.id} className="break-inside-avoid">
            <p className="font-semibold">{i + 1}. {s.prompt}</p>
            {s.help && <p className="text-sm text-muted">{s.help}</p>}
            {s.type === "choice" ? <ul className="mt-2 space-y-1">{(s.options ?? []).map((o) => <li key={o}>☐ {o}</li>)}</ul>
              : s.type === "scale" ? <p className="mt-3">{s.label_min ?? s.min ?? 0} &nbsp;0 · 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10&nbsp; {s.label_max ?? s.max ?? 10}</p>
              : <div className="mt-2 space-y-6" aria-hidden="true">{[0, 1, 2, 3].map((k) => <div key={k} className="border-b border-[#BFB6A6] pt-4" />)}</div>}
          </li>
        ))}
      </ol>
      <p className="mt-10 text-sm text-muted">For reflection and education only. Not a psychological assessment or treatment. In crisis in the U.S.? Call or text 988. Emergency: 911.</p>
    </div>
  );
}
