import { useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { useSeo } from "../lib/seo";
import type { Conversation, LogEntry, Member, ModQueue, Report, Stats } from "../lib/types";
import { ConversationView } from "../pages/Messages";
import { PlainText } from "../components/Markdown";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, Field, Modal, Notice, Spinner, fmtDate, fmtTime, timeAgo } from "../components/ui";
import { ArticleEditor, ArticlesAdmin, CategoriesAdmin, PagesAdmin, PromptsAdmin, SettingsAdmin } from "./AdminContent";

export function AdminHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl">{title}</h1>{children}</div>;
}

export default function AdminApp() {
  const { me } = useApp();
  useSeo({ title: "Admin | #ChooseHappiness", noindex: true });
  if (!me?.is_staff) return <div className="container-page py-16"><EmptyState h1 title="This area is for the #ChooseHappiness team">Your account doesn't have moderator or administrator access.</EmptyState></div>;
  const admin = me.role === "admin";
  const nav: [string, string][] = [["", "Dashboard"], ["moderation", "Moderation"], ["support", "Support inbox"], ["members", "Members"], ["log", "Audit log"]];
  if (admin) nav.push(["content", "Articles & exercises"], ["pages", "Pages"], ["prompts", "Daily reflections"], ["community", "Discussion spaces"], ["settings", "Settings"]);
  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Admin" className="lg:sticky lg:top-28 lg:self-start">
        <p className="kicker mb-3">{admin ? "Administrator" : "Moderator"}</p>
        <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {nav.map(([to, label]) => (
            <li key={to}><NavLink end to={`/admin${to ? `/${to}` : ""}`} className={({ isActive }) => `block whitespace-nowrap rounded-xl px-3 py-2.5 font-semibold ${isActive ? "bg-evergreen text-white" : "hover:bg-sage-50"}`}>{label}</NavLink></li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="support" element={<SupportInbox />} />
          <Route path="support/:id" element={<SupportConversation />} />
          <Route path="members" element={<Members />} />
          <Route path="log" element={<AuditLog />} />
          {admin && <>
            <Route path="content" element={<ArticlesAdmin />} />
            <Route path="content/new" element={<ArticleEditor />} />
            <Route path="content/:slug" element={<ArticleEditor />} />
            <Route path="pages" element={<PagesAdmin />} />
            <Route path="prompts" element={<PromptsAdmin />} />
            <Route path="community" element={<CategoriesAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
          </>}
          <Route path="*" element={<EmptyState h1 title="Not available" />} />
        </Routes>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: s, loading } = useRpc<Stats>("admin_stats");
  const { me } = useApp();
  if (loading || !s) return <Spinner />;
  const tiles: [string, number, string?][] = [
    ["Urgent items to review", s.urgent_reports, "/admin/moderation"], ["Posts waiting for review", s.pending_posts, "/admin/moderation"],
    ["Open reports", s.open_reports, "/admin/moderation"], ["Open appeals", s.open_appeals, "/admin/moderation"], ["Open support conversations", s.open_support, "/admin/support"],
    ["Members", s.members], ["New members (30 days)", s.new_members_30d], ["Active discussions (7 days)", s.active_discussions_7d],
    ["New discussions (30 days)", s.threads_30d], ["Replies (30 days)", s.replies_30d], ["Published articles", s.published_articles], ["Draft articles", s.draft_articles],
  ];
  return (
    <>
      <AdminHeader title={`Welcome, ${me?.display_name}`} />
      {s.urgent_reports > 0 && <div className="mb-6"><Notice tone="error" title={`${s.urgent_reports} urgent item${s.urgent_reports === 1 ? "" : "s"} may involve someone's safety`}>Review these first in <Link className="link" to="/admin/moderation">Moderation</Link>. If someone may be in immediate danger, follow your escalation procedure (see README).</Notice></div>}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(([label, n, to]) => {
          const inner = <><span className="block font-serif text-3xl text-evergreen">{n}</span><span className="text-sm text-muted">{label}</span></>;
          return <li key={label}>{to ? <Link to={to} className="card block p-5 hover:border-sage">{inner}</Link> : <div className="card p-5">{inner}</div>}</li>;
        })}
      </ul>
      <p className="mt-6 text-sm text-muted">These are totals only. Journal entries and private messages are never counted or shown here.</p>
    </>
  );
}

const HOLD: Record<string, string> = { safety: "May mention self-harm or suicide", first_post: "New member's first post" };

function Moderation() {
  const { call } = useApp();
  const toast = useToast();
  const { data: q, loading, reload } = useRpc<ModQueue>("mod_queue");
  const [reason, setReason] = useState<{ type: string; id: string; action: string } | null>(null);
  const [why, setWhy] = useState("");
  const [viewing, setViewing] = useState<{ report: Report; target: Record<string, unknown> } | null>(null);
  const [resolution, setResolution] = useState("");
  const [appealResp, setAppealResp] = useState<Record<string, string>>({});
  if (loading || !q) return <Spinner />;
  const act = async (type: string, id: string, action: string, r = "") => {
    try { await call("moderate_content", { p_type: type, p_id: id, p_action: action, p_reason: r }); toast(action === "approve" ? "Approved." : "Removed."); reload(); }
    catch (e) { toast(friendlyError(e)); }
  };
  const total = q.pending_threads.length + q.pending_replies.length + q.reports.length + q.appeals.length;
  return (
    <>
      <AdminHeader title="Moderation"><button type="button" className="btn-secondary btn-sm" onClick={reload}>Refresh</button></AdminHeader>
      <Notice title="Escalation reminder">Moderators are not crisis counselors. For posts that may involve self-harm: approve only if it's safe to share, reach out using your written procedure, and share the 988 Lifeline. If someone may be in immediate danger, follow your emergency procedure.</Notice>
      {total === 0 && <div className="mt-6"><EmptyState title="All clear">Nothing is waiting for review.</EmptyState></div>}

      {(q.pending_threads.length > 0 || q.pending_replies.length > 0) && (
        <section aria-labelledby="pq" className="mt-8">
          <h2 id="pq" className="mb-3 text-2xl">Waiting for review</h2>
          <ul className="space-y-3">
            {q.pending_threads.map((t) => (
              <li key={t.id} className={`card p-5 ${t.hold_reason === "safety" ? "border-[#D9A3A3]" : ""}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm">{t.hold_reason === "safety" && <AlertTriangle className="h-4 w-4 text-[#8C2F2F]" aria-hidden="true" />}<Badge tone={t.hold_reason === "safety" ? "warn" : "mist"}>{HOLD[t.hold_reason] ?? t.hold_reason}</Badge> Discussion by <b>{t.author.name}</b> · {timeAgo(t.created_at)}</p>
                <h3 className="mt-2 text-xl">{t.title}</h3>
                <PlainText text={t.body} className="mt-2" />
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-primary btn-sm" onClick={() => act("thread", t.id, "approve")}>Approve</button><button type="button" className="btn-secondary btn-sm" onClick={() => setReason({ type: "thread", id: t.id, action: "remove" })}>Remove…</button></div>
              </li>
            ))}
            {q.pending_replies.map((r) => (
              <li key={r.id} className={`card p-5 ${r.hold_reason === "safety" ? "border-[#D9A3A3]" : ""}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm"><Badge tone={r.hold_reason === "safety" ? "warn" : "mist"}>{HOLD[r.hold_reason] ?? r.hold_reason}</Badge> Reply by <b>{r.author.name}</b> in “{r.thread_title}” · {timeAgo(r.created_at)}</p>
                <PlainText text={r.body} className="mt-2" />
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-primary btn-sm" onClick={() => act("reply", r.id, "approve")}>Approve</button><button type="button" className="btn-secondary btn-sm" onClick={() => setReason({ type: "reply", id: r.id, action: "remove" })}>Remove…</button></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.reports.length > 0 && (
        <section aria-labelledby="rq" className="mt-10">
          <h2 id="rq" className="mb-3 text-2xl">Reports</h2>
          <ul className="space-y-3">
            {q.reports.map((r) => (
              <li key={r.id} className={`card flex flex-wrap items-center justify-between gap-3 p-5 ${r.priority === "high" ? "border-[#D9A3A3]" : ""}`}>
                <div>
                  <p className="flex flex-wrap items-center gap-2">{r.priority === "high" && <Badge tone="warn">Urgent</Badge>}<b className="capitalize">{r.reason}</b> · {r.target_type} · {timeAgo(r.created_at)}</p>
                  {r.details && <p className="mt-1 text-sm text-muted">“{r.details}”</p>}
                  <p className="text-sm text-muted">Reported by {r.reporter.name}</p>
                </div>
                <button type="button" className="btn-secondary btn-sm" onClick={async () => { try { setViewing({ report: r, target: await call("get_reported_target", { p_report: r.id }) }); setResolution(""); } catch (e) { toast(friendlyError(e)); } }}>Review</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.appeals.length > 0 && (
        <section aria-labelledby="aq" className="mt-10">
          <h2 id="aq" className="mb-3 text-2xl">Appeals</h2>
          <ul className="space-y-3">
            {q.appeals.map((a) => (
              <li key={a.id} className="card p-5">
                <p className="text-sm text-muted"><b>{a.member?.name}</b> · {fmtDate(a.created_at)}</p>
                <p className="mt-1 font-semibold">{a.about}</p>
                <PlainText text={a.message} className="mt-1" />
                <Field id={`ar-${a.id}`} label="Response to member"><textarea id={`ar-${a.id}`} className="input min-h-20" value={appealResp[a.id] ?? ""} onChange={(e) => setAppealResp({ ...appealResp, [a.id]: e.target.value })} /></Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["reversed", "upheld"] as const).map((st) => (
                    <button key={st} type="button" className={st === "reversed" ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={async () => { try { await call("handle_appeal", { p_id: a.id, p_status: st, p_response: appealResp[a.id] ?? "" }); toast("Appeal answered."); reload(); } catch (e) { toast(friendlyError(e)); } }}>
                      {st === "reversed" ? "Reverse decision" : "Keep decision"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Reversing records the decision. Restore the content or reactivate the account separately (Members page or by approving it).</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={!!reason} onClose={() => setReason(null)} title="Remove content">
        <Field id="rm-why" label="Reason (shared with the author)" hint="Be brief and kind, e.g. “Selling isn't allowed” or “Contains another person's private details.”"><textarea id="rm-why" className="input min-h-20" value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
        <div className="mt-4 flex gap-3"><button type="button" className="btn-danger" onClick={async () => { if (reason) await act(reason.type, reason.id, "remove", why); setReason(null); setWhy(""); }}>Remove</button><button type="button" className="btn-ghost" onClick={() => setReason(null)}>Cancel</button></div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Review report" wide>
        {viewing && (
          <div className="space-y-4">
            <p><b className="capitalize">{viewing.report.reason}</b> report on a {viewing.report.target_type}. {viewing.report.details && <>Reporter said: “{viewing.report.details}”</>}</p>
            {viewing.report.target_type === "message" && <Notice tone="warn">This is a private message. Your viewing of it has been recorded in the audit log.</Notice>}
            <div className="rounded-2xl bg-sage-50 p-4">
              {viewing.target.missing ? <p>The content no longer exists.</p> : <>
                <p className="text-sm text-muted">By {(viewing.target.author as { name: string })?.name}</p>
                {typeof viewing.target.title === "string" && <p className="font-semibold">{viewing.target.title}</p>}
                <PlainText text={String(viewing.target.body ?? viewing.target.bio ?? "")} className="mt-1" />
                {typeof viewing.target.link === "string" && <Link className="link mt-2 inline-block text-sm" to={viewing.target.link}>Open in context</Link>}
              </>}
            </div>
            {viewing.report.target_type !== "user" && !viewing.target.missing && (
              <button type="button" className="btn-secondary btn-sm" onClick={() => setReason({ type: viewing.report.target_type, id: viewing.report.target_id, action: "remove" })}>Remove this content…</button>
            )}
            <Field id="res" label="Resolution note (for the audit log)"><input id="res" className="input" value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">
              {(["resolved", "dismissed"] as const).map((st) => (
                <button key={st} type="button" className={st === "resolved" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={async () => { try { await call("resolve_report", { p_id: viewing.report.id, p_status: st, p_resolution: resolution }); setViewing(null); reload(); toast("Report closed."); } catch (e) { toast(friendlyError(e)); } }}>
                  {st === "resolved" ? "Mark resolved" : "Dismiss (no action needed)"}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function SupportInbox() {
  const [status, setStatus] = useState<"open" | "closed">("open");
  const { data, loading } = useRpc<Conversation[]>("support_inbox", { p_status: status });
  return (
    <>
      <AdminHeader title="Support inbox">
        <div className="flex gap-2">{(["open", "closed"] as const).map((s) => <button key={s} type="button" aria-pressed={status === s} className={status === s ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setStatus(s)}>{s === "open" ? "Open" : "Closed"}</button>)}</div>
      </AdminHeader>
      <p className="mb-4 text-sm text-muted">Website support conversations only. Private member-to-member conversations are not visible here. Set availability and reply times in Settings.</p>
      {loading ? <Spinner /> : !data?.length ? <EmptyState title={`No ${status} conversations`} /> : (
        <ul className="card divide-y divide-line">
          {data.map((c) => (
            <li key={c.id}><Link to={`/admin/support/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-sage-50">
              <span><span className="font-semibold">{c.created_by.name}</span> · {c.subject}</span><span className="text-sm text-muted">{timeAgo(c.last_message_at)}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}

function SupportConversation() {
  const { id = "" } = useParams();
  return <><Link to="/admin/support" className="link text-sm">← Support inbox</Link><div className="mt-4"><ConversationView id={id} staffView /></div></>;
}

function Members() {
  const { me, call } = useApp();
  const toast = useToast();
  const [q, setQ] = useState("");
  const { data, loading, reload } = useRpc<Member[]>("list_members", { p_q: q });
  const [target, setTarget] = useState<Member | null>(null);
  const [form, setForm] = useState({ status: "suspended", days: "7", reason: "" });
  const admin = me?.role === "admin";
  return (
    <>
      <AdminHeader title="Members" />
      <div className="mb-4 max-w-sm"><label htmlFor="m-q" className="label">Search by display name</label><input id="m-q" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <p className="mb-4 text-sm text-muted">Email addresses aren't shown here, to limit who sees personal details. Administrators can find them in the Supabase dashboard if needed.</p>
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[0.95rem]">
            <thead className="border-b border-line text-sm text-muted"><tr><th className="p-3">Member</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Posts</th><th className="p-3">Joined</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(data ?? []).map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-semibold">{m.display_name}{m.open_reports > 0 && <Badge tone="warn">{m.open_reports} reports</Badge>}</td>
                  <td className="p-3">
                    {admin && m.id !== me?.id ? (
                      <select aria-label={`Role for ${m.display_name}`} className="input min-h-10 py-1" value={m.role} onChange={async (e) => { try { await call("set_user_role", { p_user: m.id, p_role: e.target.value }); toast("Role updated."); reload(); } catch (err) { toast(friendlyError(err)); } }}>
                        <option value="member">Member</option><option value="moderator">Moderator</option><option value="admin">Administrator</option>
                      </select>
                    ) : m.role}
                  </td>
                  <td className="p-3">{m.status}{m.suspended_until && ` until ${fmtDate(m.suspended_until)}`}</td>
                  <td className="p-3">{m.post_count}</td>
                  <td className="p-3">{fmtDate(m.created_at)}</td>
                  <td className="p-3 text-right">{m.id !== me?.id && <button type="button" className="btn-ghost btn-sm" onClick={() => { setTarget(m); setForm({ status: m.status === "active" ? "suspended" : "active", days: "7", reason: "" }); }}>Change status</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!target} onClose={() => setTarget(null)} title={`Account status: ${target?.display_name ?? ""}`}>
        <div className="space-y-4">
          <Field id="ms-st" label="New status">
            <select id="ms-st" className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active (can post)</option><option value="suspended">Suspended (paused from posting)</option>{admin && <option value="banned">Banned</option>}
            </select>
          </Field>
          {form.status === "suspended" && <Field id="ms-days" label="Days (leave blank until lifted)"><input id="ms-days" type="number" min={1} className="input" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></Field>}
          <Field id="ms-why" label="Reason (shared with the member)"><textarea id="ms-why" className="input min-h-20" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <div className="flex gap-3">
            <button type="button" className="btn-primary" onClick={async () => { if (!target) return; try { await call("set_user_status", { p_user: target.id, p_status: form.status, p_days: form.status === "suspended" && form.days ? Number(form.days) : null, p_reason: form.reason }); toast("Status updated."); setTarget(null); reload(); } catch (e) { toast(friendlyError(e)); } }}>Save</button>
            <button type="button" className="btn-ghost" onClick={() => setTarget(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function AuditLog() {
  const { data, loading } = useRpc<LogEntry[]>("mod_log", { p_limit: 200 });
  return (
    <>
      <AdminHeader title="Audit log" />
      <p className="mb-4 text-sm text-muted">Every moderator and administrator action is recorded here and can't be edited or deleted from the app.</p>
      {loading ? <Spinner /> : !data?.length ? <EmptyState title="No actions yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-[0.95rem]">
            <thead className="border-b border-line text-sm text-muted"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Details</th></tr></thead>
            <tbody>{data.map((l) => <tr key={l.id} className="border-b border-line last:border-0"><td className="p-3 whitespace-nowrap">{fmtTime(l.created_at)}</td><td className="p-3">{l.actor.name}</td><td className="p-3">{l.action.replace(/_/g, " ")}</td><td className="p-3 text-muted">{[l.target_type, l.reason].filter(Boolean).join(": ")}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
