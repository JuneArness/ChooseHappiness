import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Lock } from "lucide-react";
import { useApp } from "../lib/app";
import { friendlyError } from "../lib/backend";
import type { SavedItem } from "../lib/types";
import { useToast } from "./Toast";
import { CrisisPanel } from "./CrisisPanel";

/** True when text contains one of the owner's high-risk phrases (used to show support info right away). */
export function useHighRisk() {
  const { site } = useApp();
  return (text: string) => {
    const t = text.toLowerCase();
    return (site?.high_risk_terms ?? []).some((term) => term.length > 2 && t.includes(term.toLowerCase()));
  };
}

/** Private, optional reflection saved to the member's journal. */
export function ReflectBox({ prompt, source, sourceRef, label = "Your reflection (private)" }: { prompt: string; source: "reflection" | "exercise" | "journey" | "journal"; sourceRef?: string; label?: string }) {
  const { me, call } = useApp();
  const toast = useToast();
  const isRisky = useHighRisk();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [risk, setRisk] = useState(false);
  const id = `rf-${(sourceRef ?? source).replace(/[^a-z0-9]/gi, "")}-${prompt.length}`;
  if (!me) return (
    <p className="rounded-2xl border border-dashed border-line bg-paper px-4 py-3 text-[0.95rem] text-muted">
      <Lock className="mr-1 inline h-4 w-4" aria-hidden="true" />You can reflect on paper, or <Link to="/signin" className="link">sign in</Link> to save your thoughts privately.
    </p>
  );
  async function save() {
    setBusy(true); setError("");
    try {
      await call("save_journal_entry", { p: { title: prompt.slice(0, 160), body: text, prompt, source, source_ref: sourceRef ?? "" } });
      setSaved(true); setRisk(isRisky(text)); setText(""); toast("Saved to your private journal.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3">
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} className="input min-h-32" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary btn-sm" disabled={busy || !text.trim()} onClick={save}>{busy ? "Saving…" : "Save to my journal"}</button>
        {saved && <Link to="/journal" className="link text-sm">Open my journal</Link>}
        <span className="text-sm text-muted"><Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Only you can see your journal.</span>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-[#8C2F2F]">{error}</p>}
      {risk && <CrisisPanel compact heading="Thank you for writing that down. If you're having thoughts of suicide or self-harm, support is available right now." />}
    </div>
  );
}

/** Save / mark complete buttons for an article, exercise or journey. */
export function SaveButtons({ type, slug, completable }: { type: SavedItem["item_type"]; slug: string; completable?: boolean }) {
  const { me, call } = useApp();
  const toast = useToast();
  const [items, setItems] = useState<SavedItem[]>([]);
  useEffect(() => { if (me) call<SavedItem[]>("my_saved").then(setItems).catch(() => {}); }, [me, call]);
  if (!me) return null;
  const has = (status: string) => items.some((i) => i.item_type === type && i.item_ref === slug && i.status === status);
  async function toggle(status: "saved" | "completed") {
    try {
      const on = await call<boolean>("toggle_saved", { p_type: type, p_ref: slug, p_status: status });
      setItems(await call<SavedItem[]>("my_saved"));
      toast(status === "saved" ? (on ? "Saved to your library." : "Removed from your library.") : (on ? "Marked as done. Nice work." : "Marked as not done."));
    } catch (e) { toast(friendlyError(e)); }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-secondary btn-sm" aria-pressed={has("saved")} onClick={() => toggle("saved")}>
        {has("saved") ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}{has("saved") ? "Saved" : "Save for later"}
      </button>
      {completable && (
        <button type="button" className="btn-secondary btn-sm" aria-pressed={has("completed")} onClick={() => toggle("completed")}>
          {has("completed") ? <CheckCircle2 className="h-4 w-4 text-sage-dark" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}{has("completed") ? "Done" : "Mark as done"}
        </button>
      )}
    </div>
  );
}
