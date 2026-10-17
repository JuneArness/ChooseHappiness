import { useState } from "react";
import { Link } from "react-router-dom";
import { useRpc } from "../lib/app";
import { useSeo } from "../lib/seo";
import type { Prompt } from "../lib/types";
import { ReflectBox } from "../components/Reflect";
import { Landscape } from "../components/Landscape";

export default function Reflection() {
  useSeo({ title: "Daily reflection | #ChooseHappiness", description: "A gentle question for today, with an option to save your thoughts privately.", path: "/reflection" });
  const { data: today } = useRpc<Prompt | null>("get_daily_prompt");
  const { data: all } = useRpc<Prompt[]>("list_prompts");
  const [chosen, setChosen] = useState<string | null>(null);
  const prompt = chosen ?? today?.text ?? "What is one thing I can influence today?";
  return (
    <>
      <header className="relative isolate overflow-hidden">
        <Landscape variant="lake" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-ivory/65" aria-hidden="true" />
        <div className="container-read py-20 text-center sm:py-28">
          <p className="kicker mb-4">{chosen ? "A reflection you chose" : "Today's reflection"}</p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">“{prompt}”</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink/90">Take a breath. There's no right answer. Notice what comes up, including what's hard.</p>
        </div>
      </header>
      <div className="container-read mt-10 space-y-10">
        <section className="card p-6"><ReflectBox prompt={prompt} source="reflection" sourceRef="daily" /></section>
        <section aria-labelledby="more">
          <h2 id="more" className="text-2xl">Other reflection questions</h2>
          <ul className="mt-4 space-y-2">
            {(all ?? []).filter((p) => p.active !== false && p.text !== prompt).map((p) => (
              <li key={p.id}><button type="button" onClick={() => { setChosen(p.text); window.scrollTo({ top: 0 }); }} className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left hover:border-sage">{p.text}</button></li>
            ))}
          </ul>
        </section>
        <p className="text-sm text-muted">Reflections are for your own insight. They aren't a psychological assessment, and nothing you write is scored. Want something more structured? Try a <Link className="link" to="/perspective">guided exercise</Link>.</p>
      </div>
    </>
  );
}
