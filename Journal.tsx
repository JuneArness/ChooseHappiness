import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Download, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { useSeo } from "../lib/seo";
import type { JournalEntry, Prompt } from "../lib/types";
import { useHighRisk } from "../components/Reflect";
import { CrisisPanel } from "../components/CrisisPanel";
import { PlainText } from "../components/Markdown";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, Field, Modal, Notice, PageHeader, Spinner, fmtDate } from "../components/ui";

const SOURCE_LABEL: Record<JournalEntry["source"], string> = { journal: "Journal", reflection: "Reflection", exercise: "Exercise", journey: "Journey" };
const blank = () => ({ id: "", entry_date: "", title: "", body: "", prompt: "" });

export default function Journal() {
  useSeo({ title: "My journal | #ChooseHappiness", path: "/journal", noindex: true });
  const { call } = useApp();
  const toast = useToast();
  const isRisky = useHighRisk();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, loading, reload, error: loadError } = useRpc<JournalEntry[]>("my_journal", { p_q: q, p_from: from || null, p_to: to || null });
  const { data: prompt } = useRpc<Prompt | null>("get_daily_prompt");
  const [edit, setEdit] = useState<ReturnType<typeof blank> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [risk, setRisk] = useState(false);
  const [confirmDel, setConfirmDel] = useState<JournalEntry | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault(); if (!edit) return;
    setBusy(true); setError("");
    try {
      await call("save_journal_entry", { p: { ...edit, id: edit.id || null, entry_date: edit.entry_date || null } });
      setRisk(isRisky(edit.body)); setEdit(null); reload(); toast("Saved privately.");
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  function exportText() {
    const text = (data ?? []).map((j) => `${j.entry_date}${j.title ? ` | ${j.title}` : ""}\n${j.prompt && j.prompt !== j.title ? `Prompt: ${j.prompt}\n` : ""}\n${j.body}\n`).join("\n----------\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "my-journal.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <>
      <PageHeader kicker="Private" title="My journal" intro={<span className="flex items-center gap-2"><Lock className="h-4 w-4 flex-none" aria-hidden="true" />Only you can read your journal. Administrators and moderators can't see it in the app. <Link className="link" to="/privacy">How privacy works</Link></span>}>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => { setError(""); setEdit(blank()); }}><Plus className="h-4 w-4" aria-hidden="true" />New entry</button>
          {prompt && <button type="button" className="btn-secondary" onClick={() => { setError(""); setEdit({ ...blank(), title: prompt.text, prompt: prompt.text }); }}>Write about today's prompt</button>}
        </div>
      </PageHeader>
      <div className="container-page mt-8">
        {risk && <div className="mb-6"><CrisisPanel compact heading="Thank you for writing that down. If you're thinking about suicide or self-harm, support is available right now." /></div>}
        <form role="search" onSubmit={(e) => e.preventDefault()} className="card grid gap-4 p-5 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
          <div className="relative"><label htmlFor="j-q" className="label">Search my entries</label><Search className="pointer-events-none absolute bottom-3.5 left-4 h-5 w-5 text-muted" aria-hidden="true" /><input id="j-q" type="search" className="input pl-12" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div><label htmlFor="j-from" className="label">From</label><input id="j-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label htmlFor="j-to" className="label">To</label><input id="j-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <button type="button" className="btn-ghost" onClick={exportText} disabled={!data?.length}><Download className="h-4 w-4" aria-hidden="true" />Export</button>
        </form>
        <div className="mt-6" aria-live="polite">
          {loadError ? <div className="mb-4"><Notice tone="error">{friendlyError(loadError, "We couldn't load your entries. Please refresh the page.")}</Notice></div> : null}
          {loading && !data ? <Spinner /> : !data?.length ? (
            <EmptyState title={q || from || to ? "No entries match" : "Your journal is empty"}>{q || from || to ? "Try a different search or date range." : "Write anything: a thought, a feeling, a small win. It stays private."}</EmptyState>
          ) : (
            <ul className="space-y-4">
              {data.map((j) => (
                <li key={j.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted">{fmtDate(j.entry_date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} <Badge tone="mist">{SOURCE_LABEL[j.source]}</Badge></p>
                      {j.title && <h2 className="mt-1 text-xl">{j.title}</h2>}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => { setError(""); setEdit({ id: j.id, entry_date: j.entry_date, title: j.title, body: j.body, prompt: j.prompt }); }}><Pencil className="h-4 w-4" aria-hidden="true" />Edit<span className="sr-only"> entry from {j.entry_date}</span></button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmDel(j)}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete<span className="sr-only"> entry from {j.entry_date}</span></button>
                    </div>
                  </div>
                  <PlainText text={j.body} className="mt-3" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit entry" : "New entry"} wide>
        {edit && (
          <form onSubmit={save} className="space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Field id="je-title" label="Title (optional)"><input id="je-title" className="input" maxLength={160} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field id="je-date" label="Date"><input id="je-date" type="date" className="input" value={edit.entry_date} onChange={(e) => setEdit({ ...edit, entry_date: e.target.value })} /></Field>
            </div>
            <Field id="je-body" label="Entry"><textarea id="je-body" className="input min-h-56" maxLength={20000} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save privately"}</button><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        )}
      </Modal>
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete this entry?">
        <p>This permanently deletes the entry. It can't be recovered.</p>
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn-danger" onClick={async () => { if (!confirmDel) return; try { await call("delete_journal_entry", { p_id: confirmDel.id }); toast("Entry deleted."); reload(); } catch (err) { toast(friendlyError(err)); } setConfirmDel(null); }}>Delete permanently</button>
          <button type="button" className="btn-ghost" onClick={() => setConfirmDel(null)}>Keep it</button>
        </div>
      </Modal>
    </>
  );
}
