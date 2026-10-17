import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bookmark, BookmarkCheck, EyeOff, HandHeart, Heart, MessageCircle, MoreHorizontal, Pencil, Shield, Sparkles, Trash2, UserX } from "lucide-react";
import { useApp, useRpc } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { useSeo } from "../lib/seo";
import type { Category, PostResult, ReactionKind, Reactions, Thread, ThreadCard, Author } from "../lib/types";
import { useHighRisk } from "../components/Reflect";
import { CrisisPanel } from "../components/CrisisPanel";
import { ContentWarning, ReportButton } from "../components/Safety";
import { PlainText } from "../components/Markdown";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, Field, Modal, Notice, PageHeader, SignInPrompt, Spinner, timeAgo } from "../components/ui";

function AuthorName({ a }: { a: Author }) {
  return <span className="font-semibold text-evergreen">{a.name}{a.role !== "member" && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-evergreen"><Shield className="h-3 w-3" aria-hidden="true" />{a.role === "admin" ? "Team" : "Moderator"}</span>}</span>;
}

function ThreadList({ threads }: { threads: ThreadCard[] }) {
  if (!threads.length) return <EmptyState title="No discussions yet">Be the first to start one. Small questions and small wins are welcome.</EmptyState>;
  return (
    <ul className="card divide-y divide-line">
      {threads.map((t) => (
        <li key={t.id}>
          <Link to={`/community/t/${t.id}`} className="block px-5 py-4 hover:bg-sage-50">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-lg text-evergreen">{t.title}</span>
              {t.status === "pending" && <Badge tone="warn">Waiting for review</Badge>}
              {t.content_warning && <Badge tone="clay">CW: {t.content_warning}</Badge>}
            </span>
            {!t.content_warning && <span className="mt-1 line-clamp-2 block text-[0.95rem] text-muted">{t.excerpt}</span>}
            <span className="mt-2 block text-sm text-muted">{t.author.name} · {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"} · active {timeAgo(t.last_activity_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CommunityHome() {
  useSeo({ title: "Community | #ChooseHappiness", description: "Moderated, members-only discussions for encouragement, perspective and shared experience.", path: "/community" });
  const { me, site, call } = useApp();
  const toast = useToast();
  const cats = useRpc<Category[]>("list_categories");
  const recent = useRpc<ThreadCard[]>(me ? "list_threads" : null, { p_limit: 15 });
  return (
    <>
      <PageHeader kicker="Community & forums" title="Real people. A supportive space." intro="Share encouragement, perspective and experience with other members. Discussions are visible only to signed-in members and are moderated." />
      <div className="container-page mt-8 space-y-10">
        <Notice title="Before you post">Peer support is valuable, but members aren't counselors and this isn't a crisis service. {site?.community_monitoring_note} Please read the <Link className="link" to="/guidelines">community guidelines</Link>. If you're in crisis, <Link className="link" to="/get-help">get help now</Link>.</Notice>
        <section aria-labelledby="sp">
          <h2 id="sp" className="mb-4 text-2xl">Discussion spaces</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {(cats.data ?? []).map((c) => (
              <li key={c.slug} className="card flex h-full flex-col p-5">
                <Link to={`/community/${c.slug}`} className="font-serif text-xl text-evergreen hover:text-sage-dark">{c.name}</Link>
                <p className="mt-1 flex-1 text-[0.97rem] text-muted">{c.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
                  <span>{c.thread_count ?? 0} {c.thread_count === 1 ? "discussion" : "discussions"}</span>
                  {me && <button type="button" className="btn-ghost btn-sm" aria-pressed={c.following} onClick={async () => { try { await call("toggle_follow", { p_category: c.slug }); cats.reload(); } catch (e) { toast(friendlyError(e)); } }}>{c.following ? "Following" : "Follow"}</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="rc">
          <h2 id="rc" className="mb-4 text-2xl">Recent discussions</h2>
          {!me ? <SignInPrompt what="read and join discussions" /> : recent.loading ? <Spinner /> : <ThreadList threads={recent.data ?? []} />}
        </section>
      </div>
    </>
  );
}

export function CategoryPage() {
  const { slug = "" } = useParams();
  const cats = useRpc<Category[]>("list_categories");
  const threads = useRpc<ThreadCard[]>("list_threads", { p_category: slug });
  const cat = cats.data?.find((c) => c.slug === slug);
  useSeo({ title: `${cat?.name ?? "Community"} | #ChooseHappiness`, path: `/community/${slug}`, noindex: true });
  if (cats.loading) return <Spinner />;
  if (!cat) return <div className="container-page py-16"><EmptyState h1 title="Discussion space not found" action={<Link to="/community" className="btn-primary">All spaces</Link>} /></div>;
  return (
    <>
      <PageHeader kicker="Community" title={cat.name} intro={cat.description}>
        <div className="mt-6 flex flex-wrap gap-3"><Link to={`/community/${slug}/new`} className="btn-primary">Start a discussion</Link><Link to="/community" className="btn-secondary">All spaces</Link></div>
      </PageHeader>
      <div className="container-page mt-8">{threads.loading ? <Spinner /> : <ThreadList threads={threads.data ?? []} />}</div>
    </>
  );
}

function PostedNotice({ r }: { r: PostResult }) {
  if (r.status === "published") return null;
  return r.hold_reason === "safety" ? (
    <div className="space-y-4">
      <Notice tone="warn" title="Your post is waiting for a moderator">Because it may mention self-harm or suicide, a person will review it before others can see it. That isn't a judgment. We want to make sure you and others get the right support.</Notice>
      <CrisisPanel />
    </div>
  ) : <Notice tone="info" title="Thanks for posting">New members' first posts are reviewed by a moderator before they appear. You can see it in the meantime.</Notice>;
}

function ReactionBar({ type, id, reactions, onChange, disabled }: { type: "thread" | "reply"; id: string; reactions: Reactions; onChange: () => void; disabled?: boolean }) {
  const { call } = useApp();
  const toast = useToast();
  const kinds: [ReactionKind, string, typeof Heart][] = [["support", "Sending support", HandHeart], ["relate", "I relate", Heart], ["thanks", "Thank you", Sparkles]];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Supportive reactions">
      {kinds.map(([k, label, I]) => {
        const mine = reactions.mine.includes(k);
        const n = reactions.counts[k] ?? 0;
        return (
          <button key={k} type="button" disabled={disabled} aria-pressed={mine}
            onClick={async () => { try { await call("toggle_reaction", { p_type: type, p_id: id, p_kind: k }); onChange(); } catch (e) { toast(friendlyError(e)); } }}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm ${mine ? "border-sage-dark bg-sage-100 text-evergreen" : "border-line text-muted hover:border-sage"}`}>
            <I className="h-4 w-4" aria-hidden="true" />{label}{n > 0 && <span className="text-xs">({n})</span>}
          </button>
        );
      })}
    </div>
  );
}

function AuthorActions({ author }: { author: Author }) {
  const { me, site, call } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!me || !author.id || author.id === me.id) return null;
  const act = async (kind: "block" | "mute") => {
    try { await call("set_block", { p_user: author.id, p_kind: kind }); toast(kind === "block" ? `${author.name} is blocked.` : `${author.name} is muted.`); setOpen(false); navigate(0); }
    catch (e) { toast(friendlyError(e)); }
  };
  return (
    <>
      <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm text-muted hover:bg-sage-50" onClick={() => setOpen(true)}><MoreHorizontal className="h-4 w-4" aria-hidden="true" />More<span className="sr-only"> options for {author.name}</span></button>
      <Modal open={open} onClose={() => setOpen(false)} title={author.name}>
        <div className="space-y-2">
          {site?.peer_chat_enabled && <Link to={`/messages?to=${author.id}&name=${encodeURIComponent(author.name)}`} className="btn-secondary w-full"><MessageCircle className="h-4 w-4" aria-hidden="true" />Send a private message</Link>}
          <button type="button" className="btn-secondary w-full" onClick={() => act("mute")}><EyeOff className="h-4 w-4" aria-hidden="true" />Mute (hide their posts from me)</button>
          {author.role === "member" && <button type="button" className="btn-secondary w-full" onClick={() => act("block")}><UserX className="h-4 w-4" aria-hidden="true" />Block (hide posts, stop replies and messages)</button>}
          <div className="pt-2"><ReportButton type="user" id={author.id} label="Report this member" /></div>
          <p className="text-sm text-muted">You can undo this anytime in Account & privacy.</p>
        </div>
      </Modal>
    </>
  );
}

export function ThreadPage() {
  const { id = "" } = useParams();
  const { me, call } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const isRisky = useHighRisk();
  const { data: t, loading, reload } = useRpc<Thread | null>("get_thread", { p_id: id });
  const [reply, setReply] = useState("");
  const [cw, setCw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PostResult | null>(null);
  const [editing, setEditing] = useState<{ kind: "thread" | "reply"; id: string; title?: string; body: string; cw: string } | null>(null);
  useSeo({ title: `${t?.title ?? "Discussion"} | #ChooseHappiness`, path: `/community/t/${id}`, noindex: true });
  if (loading) return <Spinner />;
  if (!t) return <div className="container-page py-16"><EmptyState h1 title="This discussion isn't available" action={<Link to="/community" className="btn-primary">Back to community</Link>}>It may have been removed, or it's waiting for review.</EmptyState></div>;

  async function postReply(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const r = await call<PostResult>("create_reply", { p_thread: t!.id, p_body: reply, p_cw: cw }); setResult(r); setReply(""); setCw(""); reload(); if (r.status === "published") toast("Reply posted."); }
    catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  async function saveEdit(e: FormEvent) {
    e.preventDefault(); if (!editing) return;
    try {
      const r = editing.kind === "thread"
        ? await call<PostResult>("edit_thread", { p_id: editing.id, p_title: editing.title, p_body: editing.body, p_cw: editing.cw })
        : await call<PostResult>("edit_reply", { p_id: editing.id, p_body: editing.body, p_cw: editing.cw });
      setEditing(null); setResult(r.status === "pending" ? { ...r, hold_reason: "safety" } : null); reload(); toast("Saved.");
    } catch (err) { toast(friendlyError(err)); }
  }
  const risky = isRisky(reply);

  return (
    <div className="container-read py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link to="/community" className="hover:underline">Community</Link> / {t.category && <Link to={`/community/${t.category.slug}`} className="hover:underline">{t.category.name}</Link>}</nav>
      <article className="mt-4" aria-labelledby="t-title">
        {t.status !== "published" && <div className="mb-4"><Notice tone="warn">{t.status === "pending" ? "This post is waiting for a moderator. Only you and moderators can see it." : "This post was removed."}</Notice></div>}
        <h1 id="t-title" className="text-3xl sm:text-4xl">{t.title}</h1>
        <p className="mt-2 text-sm text-muted"><AuthorName a={t.author} /> · {timeAgo(t.created_at)}{t.edited_at && " · edited"}</p>
        <div className="mt-5"><ContentWarning label={t.content_warning}><PlainText text={t.body} className="text-[1.05rem] leading-relaxed" /></ContentWarning></div>
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-b border-line pb-5">
          <ReactionBar type="thread" id={t.id} reactions={t.reactions} onChange={reload} disabled={t.status !== "published"} />
          <span className="flex-1" />
          <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sage-50" aria-pressed={t.bookmarked}
            onClick={async () => { await call("toggle_saved", { p_type: "thread", p_ref: t.id, p_status: "saved" }); reload(); }}>
            {t.bookmarked ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}{t.bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
          {t.mine ? (
            <>
              {t.status !== "removed" && <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sage-50" onClick={() => setEditing({ kind: "thread", id: t.id, title: t.title, body: t.body, cw: t.content_warning })}><Pencil className="h-4 w-4" aria-hidden="true" />Edit</button>}
              <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sage-50" onClick={async () => { if (confirm("Delete this discussion? Replies will also be hidden.")) { await call("delete_my_thread", { p_id: t.id }); navigate("/community"); } }}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</button>
            </>
          ) : <><ReportButton type="thread" id={t.id} /><AuthorActions author={t.author} /></>}
        </div>
      </article>

      <section aria-labelledby="replies" className="mt-8">
        <h2 id="replies" className="text-2xl">{t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}</h2>
        <ul className="mt-4 space-y-4">
          {t.replies.map((r) => (
            <li key={r.id} className="card p-5">
              <p className="text-sm text-muted"><AuthorName a={r.author} /> · {timeAgo(r.created_at)}{r.edited_at && " · edited"} {r.status === "pending" && <Badge tone="warn">Waiting for review</Badge>}</p>
              <div className="mt-2"><ContentWarning label={r.content_warning}><PlainText text={r.body} /></ContentWarning></div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ReactionBar type="reply" id={r.id} reactions={r.reactions} onChange={reload} disabled={r.status !== "published"} />
                <span className="flex-1" />
                {r.mine ? (
                  <>
                    <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sage-50" onClick={() => setEditing({ kind: "reply", id: r.id, body: r.body, cw: r.content_warning })}><Pencil className="h-4 w-4" aria-hidden="true" />Edit</button>
                    <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sage-50" onClick={async () => { if (confirm("Delete this reply?")) { await call("delete_my_reply", { p_id: r.id }); reload(); } }}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</button>
                  </>
                ) : <><ReportButton type="reply" id={r.id} /><AuthorActions author={r.author} /></>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {t.status === "published" && me && (
        <section aria-labelledby="rf" className="card mt-8 p-6">
          <h2 id="rf" className="text-2xl">Add a supportive reply</h2>
          {result && <div className="mt-4"><PostedNotice r={result} /></div>}
          <form onSubmit={postReply} className="mt-4 space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            <Field id="r-body" label="Your reply" hint="Share your experience rather than advice or diagnoses. Be kind."><textarea id="r-body" className="input min-h-28" maxLength={5000} value={reply} onChange={(e) => setReply(e.target.value)} aria-describedby="r-body-hint" /></Field>
            {risky && <CrisisPanel compact heading="It sounds like this might be about something really painful. Support is available right now." />}
            <Field id="r-cw" label="Content warning (optional)" hint="e.g. grief, illness. Readers will see this label first."><input id="r-cw" className="input" maxLength={80} value={cw} onChange={(e) => setCw(e.target.value)} /></Field>
            <button className="btn-primary" disabled={busy || !reply.trim()}>{busy ? "Posting…" : "Post reply"}</button>
          </form>
        </section>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit" wide>
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            {editing.kind === "thread" && <Field id="e-title" label="Title"><input id="e-title" className="input" maxLength={140} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>}
            <Field id="e-body" label="Message"><textarea id="e-body" className="input min-h-40" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field>
            <Field id="e-cw" label="Content warning (optional)"><input id="e-cw" className="input" maxLength={80} value={editing.cw} onChange={(e) => setEditing({ ...editing, cw: e.target.value })} /></Field>
            <div className="flex gap-3"><button className="btn-primary">Save</button><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function NewThread() {
  const { slug = "" } = useParams();
  const { call, site } = useApp();
  const navigate = useNavigate();
  const isRisky = useHighRisk();
  const cats = useRpc<Category[]>("list_categories");
  const [f, setF] = useState({ category: slug, title: "", body: "", cw: "", agree: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  useSeo({ title: "Start a discussion | #ChooseHappiness", noindex: true });
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await call<PostResult>("create_thread", { p_category: f.category, p_title: f.title, p_body: f.body, p_cw: f.cw });
      if (r.status === "published") navigate(`/community/t/${r.id}`); else setResult(r);
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  if (result) return (
    <div className="container-read space-y-6 py-12">
      <h1 className="text-3xl">Thanks for sharing</h1>
      <PostedNotice r={result} />
      <div className="flex flex-wrap gap-3"><Link to={`/community/t/${result.id}`} className="btn-secondary">View my post</Link><Link to="/community" className="btn-ghost">Back to community</Link></div>
    </div>
  );
  return (
    <div className="container-read py-12">
      <h1 className="text-3xl sm:text-4xl">Start a discussion</h1>
      {!site?.community_open && <div className="mt-4"><Notice tone="warn">New posts are paused right now.</Notice></div>}
      <form onSubmit={submit} className="card mt-6 space-y-5 p-6" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field id="n-cat" label="Discussion space">
          <select id="n-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {(cats.data ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </Field>
        <Field id="n-title" label="Title"><input id="n-title" className="input" maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field id="n-body" label="What would you like to share?" hint="Avoid sharing details that could identify you or others, like full names, addresses or workplaces."><textarea id="n-body" className="input min-h-44" maxLength={8000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} aria-describedby="n-body-hint" /></Field>
        {isRisky(f.title + " " + f.body) && <CrisisPanel heading="It sounds like you may be going through something really hard. You deserve support right now." />}
        <Field id="n-cw" label="Content warning (optional)" hint="If your post discusses something difficult (for example grief, illness or trauma), add a short label. Readers see it before your post."><input id="n-cw" className="input" maxLength={80} value={f.cw} onChange={(e) => setF({ ...f, cw: e.target.value })} aria-describedby="n-cw-hint" /></Field>
        <label className="flex gap-3 text-[0.97rem]"><input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[#46664F]" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} /><span>I've read the <Link className="link" to="/guidelines" target="_blank">community guidelines</Link>.</span></label>
        <button className="btn-primary" disabled={busy || !f.agree || !f.title.trim() || !f.body.trim()}>{busy ? "Posting…" : "Post discussion"}</button>
      </form>
    </div>
  );
}
