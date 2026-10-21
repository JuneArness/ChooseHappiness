import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp, useRpc } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { useSeo } from "../lib/seo";
import type { Appeal, Author, Notification } from "../lib/types";
import { useToast } from "../components/Toast";
import { Badge, EmptyState, Field, Modal, Notice, PageHeader, Spinner, fmtDate, timeAgo } from "../components/ui";

export default function Account() {
  useSeo({ title: "Account & privacy | #ChooseHappiness", path: "/account", noindex: true });
  const { me, site, call, refreshMe, backend } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [p, setP] = useState(() => ({ display_name: me?.display_name ?? "", bio: me?.bio ?? "", notify_replies: me?.notify_replies ?? true, notify_messages: me?.notify_messages ?? true, allow_peer_messages: me?.allow_peer_messages ?? false }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const blocks = useRpc<{ user: Author; kind: string; created_at: string }[]>("my_blocks");
  const appeals = useRpc<Appeal[]>("my_appeals");
  const [appeal, setAppeal] = useState({ about: "", message: "" });
  const [pw, setPw] = useState("");
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");
  useEffect(() => { if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView(); }, []);
  if (!me) return <Spinner />;

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await call("update_my_profile", { p }); await refreshMe(); toast("Saved."); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  async function exportData() {
    try {
      const data = await call("export_my_data");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `choosehappiness-my-data-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Your data download has started.");
    } catch (err) { toast(friendlyError(err)); }
  }
  async function deleteAccount() {
    try { await call("delete_my_account", { p_confirm: confirm }); await backend?.signOut(); navigate("/"); toast("Your account and data were deleted."); }
    catch (err) { toast(friendlyError(err)); }
  }

  return (
    <>
      <PageHeader kicker="Your account" title="Account & privacy" intro={<>Signed in as <b>{me.display_name}</b>{me.role !== "member" && <> · <Badge>{me.role}</Badge></>}</>} />
      <div className="container-read mt-10 space-y-10">
        {me.status !== "active" && <Notice tone="warn" title="Your account is paused from posting">{me.status === "suspended" && me.suspended_until ? `Until ${fmtDate(me.suspended_until)}. ` : ""}You can still read, use your journal, export your data, or submit an appeal below.</Notice>}

        <section aria-labelledby="prof" className="card p-6">
          <h2 id="prof" className="text-2xl">Profile & notifications</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            <Field id="a-name" label="Display name"><input id="a-name" className="input" maxLength={40} value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></Field>
            <Field id="a-bio" label="Short bio (optional)" hint="Visible to signed-in members. Avoid personal details like your address or workplace."><textarea id="a-bio" className="input min-h-20" maxLength={300} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} /></Field>
            <fieldset className="space-y-2"><legend className="label">In-app notifications</legend>
              <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={p.notify_replies} onChange={(e) => setP({ ...p, notify_replies: e.target.checked })} />Replies to my discussions</label>
              <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={p.notify_messages} onChange={(e) => setP({ ...p, notify_messages: e.target.checked })} />New messages</label>
              <p className="text-sm text-muted">Email notifications aren't available yet. You'll only see notifications here on the site.</p>
            </fieldset>
            {site?.peer_chat_enabled && (
              <label className="flex gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#46664F]" checked={p.allow_peer_messages} onChange={(e) => setP({ ...p, allow_peer_messages: e.target.checked })} />
                <span><b>Allow other members to message me</b><span className="block text-sm text-muted">Off by default. You can block anyone at any time.</span></span></label>
            )}
            <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </form>
        </section>

        <section aria-labelledby="bl" className="card p-6">
          <h2 id="bl" className="text-2xl">Blocked and muted members</h2>
          <p className="mt-1 text-[0.97rem] text-muted">Muted members' posts are hidden from you. Blocked members also can't reply to your discussions or message you. They aren't told.</p>
          {blocks.data?.length ? (
            <ul className="mt-4 divide-y divide-line">
              {blocks.data.map((b) => (
                <li key={b.user.id} className="flex items-center justify-between gap-3 py-3">
                  <span>{b.user.name} <Badge tone="clay">{b.kind === "mute" ? "Muted" : "Blocked"}</Badge></span>
                  <button type="button" className="btn-ghost btn-sm" onClick={async () => { await call("set_block", { p_user: b.user.id, p_kind: "" }); blocks.reload(); toast("Removed."); }}>Undo</button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-muted">You haven't blocked or muted anyone.</p>}
        </section>

        <section id="appeals" aria-labelledby="ap" className="card scroll-mt-28 p-6">
          <h2 id="ap" className="text-2xl">Appeals</h2>
          <p className="mt-1 text-[0.97rem] text-muted">If a moderator removed something you posted or paused your account and you think it was a mistake, tell us. A different moderator will review it when possible.</p>
          {(appeals.data ?? []).map((a) => (
            <div key={a.id} className="mt-4 rounded-2xl border border-line p-4">
              <p className="flex flex-wrap items-center gap-2 font-semibold">{a.about || "Appeal"} <Badge tone={a.status === "open" ? "warn" : a.status === "reversed" ? "sage" : "clay"}>{a.status === "open" ? "Waiting for review" : a.status === "reversed" ? "Decision reversed" : "Decision stands"}</Badge></p>
              <p className="mt-1 text-sm text-muted">{fmtDate(a.created_at)}</p>
              {a.response && <p className="mt-2"><b>Moderator response:</b> {a.response}</p>}
            </div>
          ))}
          <form className="mt-4 space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            try { await call("submit_appeal", { p_about: appeal.about, p_message: appeal.message }); setAppeal({ about: "", message: "" }); appeals.reload(); toast("Appeal sent."); }
            catch (err) { toast(friendlyError(err)); }
          }}>
            <Field id="ap-about" label="What is this about?"><input id="ap-about" className="input" maxLength={200} value={appeal.about} onChange={(e) => setAppeal({ ...appeal, about: e.target.value })} placeholder="e.g. My post in Everyday Encouragement was removed" /></Field>
            <Field id="ap-msg" label="Why should we take another look?"><textarea id="ap-msg" className="input min-h-24" maxLength={2000} value={appeal.message} onChange={(e) => setAppeal({ ...appeal, message: e.target.value })} /></Field>
            <button className="btn-secondary btn-sm" disabled={appeal.message.trim().length < 10}>Submit appeal</button>
          </form>
        </section>

        <section aria-labelledby="pwh" className="card p-6">
          <h2 id="pwh" className="text-2xl">Password</h2>
          <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); try { await backend?.updatePassword(pw); setPw(""); toast("Password updated."); } catch (err) { toast(friendlyError(err)); } }}>
            <div className="min-w-0 flex-1"><Field id="a-pw" label="New password" hint="At least 8 characters."><input id="a-pw" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></Field></div>
            <button className="btn-secondary" disabled={pw.length < 8}>Update password</button>
          </form>
        </section>

        <section aria-labelledby="dat" className="card p-6">
          <h2 id="dat" className="text-2xl">Your data</h2>
          <p className="mt-1 text-[0.97rem] text-muted">Download everything tied to your account: profile, journal, saved items, posts, messages you sent, reports and appeals. Read how we handle data in our <Link to="/privacy" className="link">Privacy Policy</Link>.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={exportData}>Download my data</button>
            <button type="button" className="btn-danger" onClick={() => setDel(true)}>Delete my account</button>
          </div>
        </section>
      </div>
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
        <p>This permanently deletes your account, journal, saved items, reactions and the messages you sent. Your community posts are replaced with “[deleted]”. This can't be undone.</p>
        <p className="mt-3">Consider <button type="button" className="link" onClick={exportData}>downloading your data</button> first.</p>
        <Field id="del-c" label='Type DELETE to confirm'><input id="del-c" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="btn-danger" disabled={confirm !== "DELETE"} onClick={deleteAccount}>Delete permanently</button><button type="button" className="btn-ghost" onClick={() => setDel(false)}>Cancel</button></div>
      </Modal>
    </>
  );
}

export function NotificationsPage() {
  useSeo({ title: "Notifications | #ChooseHappiness", path: "/notifications", noindex: true });
  const { call, refreshMe } = useApp();
  const { data, loading } = useRpc<Notification[]>("my_notifications");
  useEffect(() => { if (data?.some((n) => !n.read_at)) call("mark_notifications_read").then(refreshMe).catch(() => {}); }, [data, call, refreshMe]);
  return (
    <>
      <PageHeader title="Notifications" />
      <div className="container-read mt-8">
        {loading ? <Spinner /> : !data?.length ? <EmptyState title="Nothing new">Replies, messages and updates about your posts will show up here.</EmptyState> : (
          <ul className="card divide-y divide-line">
            {data.map((n) => (
              <li key={n.id}>
                <Link to={n.link || "#"} className={`flex items-start justify-between gap-4 px-5 py-4 hover:bg-sage-50 ${n.read_at ? "" : "bg-sage-50/60"}`}>
                  <span>{!n.read_at && <span className="sr-only">Unread: </span>}{n.text}</span>
                  <span className="flex-none text-sm text-muted">{timeAgo(n.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
