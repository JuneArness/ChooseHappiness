import { Link } from "react-router-dom";
import { Phone, MessageSquareText, LifeBuoy } from "lucide-react";
import { CRISIS } from "../data/crisis";

/** Shown when someone may be in crisis (e.g. after writing about self-harm) and on the Get Help page. */
export function CrisisPanel({ compact, heading = "If you're thinking about suicide or are in crisis, you deserve support right now." }: { compact?: boolean; heading?: string }) {
  return (
    <section aria-labelledby="crisis-h" className="rounded-3xl border-2 border-terracotta/50 bg-clay-50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <LifeBuoy className="mt-1 h-6 w-6 flex-none text-terracotta-dark" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="crisis-h" className="font-serif text-xl text-evergreen">{heading}</h2>
          <p className="mt-1 text-[0.97rem] text-muted">In the U.S., the {CRISIS.lifeline.name} is free, confidential and available 24/7. If you are in immediate danger, call <a className="link" href="tel:911">911</a>.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={CRISIS.lifeline.call} className="btn-primary btn-sm"><Phone className="h-4 w-4" aria-hidden="true" />Call 988</a>
            <a href={CRISIS.lifeline.text} className="btn-secondary btn-sm"><MessageSquareText className="h-4 w-4" aria-hidden="true" />Text 988</a>
            <a href={CRISIS.lifeline.chat} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">Chat online<span className="sr-only"> (opens in a new tab)</span></a>
          </div>
          {!compact && (
            <ul className="mt-4 space-y-1 text-[0.95rem]">
              <li lang="es">{CRISIS.spanish}</li>
              <li>{CRISIS.veterans}</li>
              <li>{CRISIS.textLine.name}: {CRISIS.textLine.detail}.</li>
            </ul>
          )}
          <p className="mt-3 text-sm text-muted">This website is not an emergency service and can't send help to you. <Link to="/get-help" className="link">More support options</Link></p>
        </div>
      </div>
    </section>
  );
}
