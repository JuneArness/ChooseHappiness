import { useState } from "react";
import { Flag } from "lucide-react";
import { useApp } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { useToast } from "./Toast";
import { Field, Modal } from "./ui";

const REASONS: [string, string][] = [
  ["safety", "Someone may be at risk of harm (including self-harm)"],
  ["harassment", "Harassment or bullying"],
  ["hate", "Hate or discrimination"],
  ["privacy", "Shares someone's private information"],
  ["misinformation", "Harmful health misinformation"],
  ["spam", "Spam or selling"],
  ["other", "Something else"],
];

export function ReportButton({ type, id, label = "Report" }: { type: "thread" | "reply" | "message" | "user"; id: string; label?: string }) {
  const { call } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try { await call("report_content", { p_type: type, p_id: id, p_reason: reason, p_details: details }); setOpen(false); setReason(""); setDetails(""); toast("Thank you. Moderators will review this."); }
    catch (e) { toast(friendlyError(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sage-50 hover:text-ink" onClick={() => setOpen(true)}>
        <Flag className="h-4 w-4" aria-hidden="true" />{label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report to moderators">
        <p className="text-[0.97rem] text-muted">Reports are private. The person you report isn't told who reported them. Moderators aren't available around the clock.</p>
        <fieldset className="mt-4"><legend className="label">What's wrong?</legend>
          <div className="space-y-2">
            {REASONS.map(([v, l]) => (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 ${reason === v ? "border-sage-dark bg-sage-50" : "border-line"}`}>
                <input type="radio" name="report-reason" value={v} checked={reason === v} onChange={() => setReason(v)} className="mt-1 h-4 w-4 accent-[#46664F]" /><span>{l}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {reason === "safety" && <p className="mt-3 rounded-xl bg-clay-50 p-3 text-[0.95rem]">If someone is in immediate danger, call <b>911</b>. You can also share the 988 Lifeline with them: they can call or text <b>988</b> (U.S.).</p>}
        <div className="mt-4"><Field id="rp-details" label="Anything else moderators should know? (optional)"><textarea id="rp-details" className="input min-h-20" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field></div>
        <div className="mt-5 flex gap-3"><button type="button" className="btn-primary" disabled={!reason || busy} onClick={send}>{busy ? "Sending…" : "Send report"}</button><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
      </Modal>
    </>
  );
}

/** Hides a post behind its content warning until the reader chooses to view it. */
export function ContentWarning({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  if (!label || show) return <>{children}</>;
  return (
    <div className="rounded-2xl border border-dashed border-[#E2C08A] bg-[#FBF3E3] px-4 py-3">
      <p className="text-[0.95rem]"><b>Content warning:</b> {label}</p>
      <button type="button" className="link mt-1 text-sm" onClick={() => setShow(true)}>Show post</button>
    </div>
  );
}
