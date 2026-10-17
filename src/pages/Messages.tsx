import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Headset, Stethoscope, Users } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { useSeo } from "../lib/seo";
import type { Conversation, SupportStatus } from "../lib/types";
import { CrisisPanel } from "../components/CrisisPanel";
import { ReportButton } from "../components/Safety";
import { PlainText } from "../components/Markdown";
import { Badge, EmptyState, Field, Notice, PageHeader, SignInPrompt, Spinner, fmtTime, timeAgo } from "../components/ui";
import { CRISIS } from "../data/crisis";

const STATUS: Record<SupportStatus, { label: string; tone: "sage" | "warn" | "clay"; text: string }> = {
  online: { label: "Online", tone: "sage", text: "Someone from our team is available right now." },
  offline: { label: "Offline", tone: "warn", text: "No one is online right now. Leave a message and we'll reply as soon as we can." },
  unavailable: { label: "Unavailable", tone: "clay", text: "Website support messaging is paused right now." },
};

export function SupportHub() {
  useSeo({ title: "Live chat & support | #ChooseHappiness", description: "Website support, private member conversations, and where to find professional or crisis help.", path: "/support" });
  const { site, me, call } = useApp();
  const navigate = useNavigate();
  const [f, setF] = useState({ subject: "", body: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const st = STATUS[site?.support_status ?? "offline"];
  async function start(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const r = await call<{ id: string; high_risk: boolean }>("start_support_conversation", { p_subject: f.subject, p_body: f.body }); navigate(`/messages/${r.id}${r.high_risk ? "?support=1" : ""}`); }
    catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader kicker="Get support" title="Live chat & support" intro="There are different kinds of support here. Please choose the one that fits, and know what each one can and can't do." />
      <div className="container-page mt-8 space-y-8">
        <CrisisPanel compact heading="If you're in crisis or thinking about suicide, please contact the 988 Lifeline now. Our chat is not a crisis service." />
        <div className="grid gap-5 lg:grid-cols-3">
          <section aria-labelledby="ws" className="card flex flex-col p-6">
            <Headset className="h-7 w-7 text-sage-dark" aria-hidden="true" />
            <h2 id="ws" className="mt-3 text-2xl">Website support</h2>
            <p className="mt-1 text-muted">Help with your account, technical problems, or questions about the site.</p>
            <p className="mt-4 flex items-center gap-2"><Badge tone={st.tone}>{st.label}</Badge><span className="text-sm">{st.text}</span></p>
            {site?.support_hours && <p className="mt-2 text-sm"><b>Hours:</b> {site.support_hours}</p>}
            {site?.support_response_time && <p className="mt-1 text-sm"><b>Typical reply time:</b> {site.support_response_time}</p>}
            {site?.contact_email && <p className="mt-1 text-sm"><b>Email:</b> <a className="link" href={`mailto:${site.contact_email}`}>{site.contact_email}</a></p>}
          </section>
          <section aria-labelledby="pc" className="card flex flex-col p-6">
            <Users className="h-7 w-7 text-sage-dark" aria-hidden="true" />
            <h2 id="pc" className="mt-3 text-2xl">Member conversations</h2>
            <p className="mt-1 text-muted">Private messages between members who've chosen to accept them. This is peer support from other members, not professional or crisis counseling.</p>
            <p className="mt-4 text-sm">{site?.peer_chat_enabled ? "Turned on. Members choose whether to accept messages in Account settings." : "Member-to-member messages are turned off right now."}</p>
            {me && <Link to="/messages" className="btn-secondary btn-sm mt-auto self-start">My messages</Link>}
          </section>
          <section aria-labelledby="ps" className="card flex flex-col p-6">
            <Stethoscope className="h-7 w-7 text-sage-dark" aria-hidden="true" />
            <h2 id="ps" className="mt-3 text-2xl">Professional support</h2>
            <p className="mt-1 text-muted">#ChooseHappiness does not currently offer sessions with licensed therapists or counselors.</p>
            <p className="mt-4 flex items-center gap-2"><Badge tone="clay">Not offered</Badge></p>
            <ul className="mt-3 space-y-1 text-sm">
              <li><a className="link" href={CRISIS.findTreatment} target="_blank" rel="noopener noreferrer">FindTreatment.gov</a> (search for care in the U.S.)</li>
              <li><a className="link" href={CRISIS.samhsa.href}>SAMHSA National Helpline: 1-800-662-4357</a></li>
              <li><Link className="link" to="/topics/seeking-help">How to find a therapist</Link></li>
            </ul>
          </section>
        </div>

        <section aria-labelledby="sf" className="card p-6">
          <h2 id="sf" className="text-2xl">Message website support</h2>
          {!me ? <div className="mt-4"><SignInPrompt what="message our team" /></div> : site?.support_status === "unavailable" ? (
            <div className="mt-4"><Notice>Support messaging is paused right now.{site.contact_email && <> You can email <a className="link" href={`mailto:${site.contact_email}`}>{site.contact_email}</a>.</>}</Notice></div>
          ) : (
            <form onSubmit={start} className="mt-4 space-y-4">
              {error && <Notice tone="error">{error}</Notice>}
              <Field id="s-sub" label="Subject"><input id="s-sub" className="input" maxLength={120} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. Trouble signing in" /></Field>
              <Field id="s-body" label="Message" hint="Please don't include passwords or sensitive health details."><textarea id="s-body" className="input min-h-28" maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} aria-describedby="s-body-hint" /></Field>
              <button className="btn-primary" disabled={busy || !f.body.trim()}>{busy ? "Sending…" : "Send message"}</button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

export function MessagesList() {
  useSeo({ title: "Messages | #ChooseHappiness", path: "/messages", noindex: true });
  const { me, site, call } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const to = params.get("to");
  const { data, loading } = useRpc<Conversation[]>("my_conversations");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  async function startPeer(e: FormEvent) {
    e.preventDefault(); setError("");
    try { const r = await call<{ id: string; high_risk: boolean }>("start_peer_conversation", { p_other: to, p_body: body }); navigate(`/messages/${r.id}${r.high_risk ? "?support=1" : ""}`); }
    catch (err) { setError(friendlyError(err)); }
  }
  const other = (c: Conversation) => c.kind === "support" ? "Website support" : c.members.filter((m) => m.id !== me?.id).map((m) => m.name).join(", ") || "Conversation";
  return (
    <>
      <PageHeader title="Messages" intro="Website support conversations and private member messages." />
      <div className="container-read mt-8 space-y-6">
        {to && site?.peer_chat_enabled && (
          <form onSubmit={startPeer} className="card space-y-4 p-6">
            <h2 className="text-2xl">New message to {params.get("name") ?? "member"}</h2>
            <p className="text-sm text-muted">Private messages are between you and this member. Moderators only see a message if one of you reports it. Peer messages are not professional or crisis support.</p>
            {error && <Notice tone="error">{error}</Notice>}
            <Field id="pm-body" label="Message"><textarea id="pm-body" className="input min-h-24" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
            <button className="btn-primary" disabled={!body.trim()}>Send</button>
          </form>
        )}
        {loading ? <Spinner /> : !data?.length ? <EmptyState title="No conversations yet" action={<Link to="/support" className="btn-secondary">Contact website support</Link>} /> : (
          <ul className="card divide-y divide-line">
            {data.map((c) => (
              <li key={c.id}><Link to={`/messages/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sage-50">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-evergreen">{other(c)} {c.kind === "support" && <Badge tone="mist">Support</Badge>} {c.status === "closed" && <Badge tone="clay">Closed</Badge>} {c.unread > 0 && <Badge tone="warn">{c.unread} new</Badge>}</span>
                  {c.subject && <span className="block truncate text-sm text-muted">{c.subject}</span>}
                </span>
                <span className="flex-none text-sm text-muted">{timeAgo(c.last_message_at)}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** One conversation. Also used by staff in the admin support inbox. */
export function ConversationView({ id, staffView }: { id: string; staffView?: boolean }) {
  const { me, call, backend, site } = useApp();
  const [params] = useSearchParams();
  const { data: c, loading, reload } = useRpc<Conversation | null>("get_conversation", { p_id: id });
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [risk, setRisk] = useState(params.get("support") === "1");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!backend) return; return backend.subscribeConversation(id, reload); }, [backend, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (c && !staffView) call("mark_conversation_read", { p_conv: id }).catch(() => {}); endRef.current?.scrollIntoView({ block: "nearest" }); }, [c, id, call, staffView]);
  if (loading && !c) return <Spinner />;
  if (!c) return <EmptyState h1 title="Conversation not found" />;
  async function send(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const r = await call<{ high_risk: boolean }>("send_message", { p_conv: id, p_body: body }); setBody(""); if (r.high_risk) setRisk(true); reload(); }
    catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  const title = c.kind === "support" ? (staffView ? `Support: ${c.created_by.name}` : "Website support") : `Conversation with ${c.members.filter((m) => m.id !== me?.id).map((m) => m.name).join(", ")}`;
  const st = STATUS[site?.support_status ?? "offline"];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{title}</h1>
          {c.subject && <p className="mt-1 text-muted">{c.subject}</p>}
          {c.kind === "support" && !staffView && <p className="mt-2 flex items-center gap-2 text-sm"><Badge tone={st.tone}>{st.label}</Badge>{st.text}{site?.support_response_time && ` Typical reply time: ${site.support_response_time}.`}</p>}
          {c.kind === "peer" && <p className="mt-2 text-sm text-muted">Peer conversation. Not professional or crisis support. Only the two of you can see it unless one of you reports a message.</p>}
        </div>
        {c.status === "open" && <button type="button" className="btn-ghost btn-sm" onClick={async () => { if (confirm("Close this conversation? Neither side can send more messages.")) { await call("close_conversation", { p_conv: id }); reload(); } }}>Close conversation</button>}
      </div>
      {risk && <CrisisPanel />}
      <ol className="card space-y-4 p-5" aria-label="Messages" aria-live="polite">
        {(c.messages ?? []).map((m) => (
          <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.mine ? "bg-evergreen text-white" : m.from_staff ? "bg-mist-50" : "bg-sage-50"}`}>
              <p className={`text-xs ${m.mine ? "text-[#D6E2D9]" : "text-muted"}`}>
                {m.mine ? "You" : m.sender.name}{m.from_staff && !m.mine ? " · #ChooseHappiness team" : ""} · <time dateTime={m.created_at}>{fmtTime(m.created_at)}</time>
              </p>
              {m.removed ? <p className="mt-1 italic">This message was removed by a moderator.</p> : <PlainText text={m.body} className="mt-1" />}
              {!m.mine && !m.removed && !staffView && <div className="mt-1 -mb-1 -ml-3"><ReportButton type="message" id={m.id} /></div>}
            </div>
          </li>
        ))}
        <div ref={endRef} />
      </ol>
      {c.status === "closed" ? <Notice>This conversation is closed.</Notice> : (
        <form onSubmit={send} className="space-y-3">
          {error && <Notice tone="error">{error}</Notice>}
          <label htmlFor="msg" className="sr-only">Message</label>
          <textarea id="msg" className="input min-h-24" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); }} />
          <button className="btn-primary" disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send"}</button>
        </form>
      )}
      {backend?.mode === "demo" && <p className="text-xs text-muted">Preview mode: new messages appear instantly in this tab only. On the live site, Supabase Realtime delivers them to everyone in the conversation.</p>}
    </div>
  );
}

export function ConversationPage() {
  const { id = "" } = useParams();
  useSeo({ title: "Conversation | #ChooseHappiness", noindex: true });
  return <div className="container-read py-10"><Link to="/messages" className="link text-sm">← All messages</Link><div className="mt-4"><ConversationView id={id} /></div></div>;
}
