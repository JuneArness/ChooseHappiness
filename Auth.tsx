import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../lib/app";
import { friendlyError } from "../lib/backend";
import { PREVIEW_ACCOUNTS } from "../lib/previewAccounts";
import { useSeo } from "../lib/seo";
import { Field, Notice } from "../components/ui";

function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="card mx-auto max-w-md p-6 sm:p-8">
        <h1 className="text-3xl">{title}</h1>
        {intro && <div className="mt-2 text-muted">{intro}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function SignIn() {
  useSeo({ title: "Sign in | #ChooseHappiness", path: "/signin", noindex: true });
  const { backend, refreshMe } = useApp();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!backend) return;
    setBusy(true); setError("");
    try { await backend.signIn(email, password); await refreshMe(); navigate(loc.state?.from ?? "/journal"); }
    catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return (
    <AuthCard title="Welcome back" intro={<>New here? <Link className="link" to="/signup">Create a free account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field id="si-email" label="Email"><input id="si-email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field id="si-pw" label="Password"><input id="si-pw" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-sm"><Link className="link" to="/forgot-password">Forgot your password?</Link></p>
      </form>
      {PREVIEW_ACCOUNTS.length > 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E2C08A] bg-[#FBF3E3] p-4 text-sm">
          <p className="font-semibold">Preview sign-ins (preview mode only)</p>
          <ul className="mt-2 space-y-1.5">
            {PREVIEW_ACCOUNTS.map((a) => (
              <li key={a.email}><button type="button" className="link text-left" onClick={() => { setEmail(a.email); setPassword(a.password); }}>{a.name}</button> <span className="text-muted">({a.role})</span></li>
            ))}
          </ul>
        </div>
      )}
    </AuthCard>
  );
}

export function SignUp() {
  useSeo({ title: "Create an account | #ChooseHappiness", path: "/signup" });
  const { backend, refreshMe } = useApp();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", age: false, terms: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!backend) return;
    if (f.name.trim().length < 2) return setError("Please choose a display name (at least 2 characters). It doesn't have to be your real name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError("Please enter a valid email address.");
    if (f.password.length < 8) return setError("Please use a password with at least 8 characters.");
    if (!f.age || !f.terms) return setError("Please confirm both boxes to continue.");
    setBusy(true); setError("");
    try {
      const r = await backend.signUp(f.email, f.password, f.name.trim());
      if (r.needsConfirmation) setSent(true); else { await refreshMe(); navigate("/journey"); }
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  if (sent) return <AuthCard title="Check your email">We sent a confirmation link to <b>{f.email}</b>. Open it to finish creating your account.</AuthCard>;
  return (
    <AuthCard title="Create your free account" intro={<>Already a member? <Link className="link" to="/signin">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field id="su-name" label="Display name" hint="Shown on your community posts. Consider not using your full real name."><input id="su-name" className="input" maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-describedby="su-name-hint" /></Field>
        <Field id="su-email" label="Email" hint="Private. Never shown to other members."><input id="su-email" type="email" autoComplete="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-describedby="su-email-hint" /></Field>
        <Field id="su-pw" label="Password" hint="At least 8 characters."><input id="su-pw" type="password" autoComplete="new-password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-describedby="su-pw-hint" /></Field>
        <label className="flex gap-3 text-[0.95rem]"><input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[#46664F]" checked={f.age} onChange={(e) => setF({ ...f, age: e.target.checked })} /><span>I am at least 18 years old.</span></label>
        <label className="flex gap-3 text-[0.95rem]"><input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[#46664F]" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
          <span>I agree to the <Link className="link" to="/terms" target="_blank">Terms of Use</Link> and <Link className="link" to="/guidelines" target="_blank">Community Guidelines</Link>, and I understand #ChooseHappiness is not therapy or an emergency service.</span></label>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        <p className="text-sm text-muted">We collect only what's needed to run your account. See our <Link className="link" to="/privacy">Privacy Policy</Link>.</p>
      </form>
    </AuthCard>
  );
}

export function ForgotPassword() {
  useSeo({ title: "Reset your password | #ChooseHappiness", path: "/forgot-password", noindex: true });
  const { backend } = useApp();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!backend) return; setError("");
    try { await backend.sendPasswordReset(email); setDone(true); } catch (err) { setError(friendlyError(err)); }
  }
  return (
    <AuthCard title="Reset your password">
      {done ? <Notice tone="success">If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.</Notice> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field id="fp-email" label="Email"><input id="fp-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn-primary w-full">Send reset link</button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword() {
  useSeo({ title: "Choose a new password | #ChooseHappiness", path: "/reset-password", noindex: true });
  const { backend, user } = useApp();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!backend) return; setError("");
    if (pw.length < 8) return setError("Please use at least 8 characters.");
    try { await backend.updatePassword(pw); navigate("/account"); } catch (err) { setError(friendlyError(err)); }
  }
  return (
    <AuthCard title="Choose a new password">
      {!user ? <Notice>Open this page from the reset link in your email. Links expire after a while; you can <Link className="link" to="/forgot-password">request a new one</Link>.</Notice> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field id="rp-pw" label="New password"><input id="rp-pw" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <button className="btn-primary w-full">Save new password</button>
        </form>
      )}
    </AuthCard>
  );
}
