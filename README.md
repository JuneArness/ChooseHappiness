# #ChooseHappiness

**Begin the journey when the paths are before you.**

A mental wellness **education and peer-support** platform founded by Stephen A. Parks Jr. & Gina P. McCoy.
It is **not** therapy, medical care, or an emergency service, and the site says so wherever it matters.

Built by SAP Development Solutions, LLC.

---

## 1. Status: what's done, what's tested, what isn't

| Area | Built | Tested | Notes |
|---|---|---|---|
| Public site (home, wellness center, perspective center, manifesto, journey, daily reflection, resources, research, about, get help, policies) | Yes | Yes, in the browser (preview mode) | 15 wellness articles, 8 perspective articles, 7 interactive exercises, 3 guided journeys, 7 prompts |
| Accounts (sign up, sign in, password reset, change password) | Yes | Sign up/in tested in preview. **Password-reset email not tested** (needs live Supabase) | |
| Private journal (create, edit, delete, search, date filter, export) | Yes | Yes (database rules + browser) | Private to the member. See "Who can see what" |
| Forums (posts, replies, edit/delete own, reactions, follow, bookmark, report, block, mute) | Yes | Yes | Members only; first post and safety posts are held for review |
| Moderation (queue, reports, remove/approve, suspend/ban, appeals, audit log) | Yes | Yes | |
| Live chat: website support + member-to-member messages | Yes | Yes in preview (updates within one browser tab). **Live delivery between different people via Supabase Realtime is not tested** | |
| Admin: articles, pages, prompts, discussion spaces, settings, members, image uploads | Yes | Yes in preview. **Image upload to Supabase Storage not tested live** | |
| Account deletion + data export | Yes | Yes (database tests + browser) | Live deletion removes the Supabase auth user; tested only in the simulator |
| Accessibility (WCAG 2.2 AA automated scan) | Yes | 0 violations on 22 pages (axe-core) | A manual check with a screen reader is still recommended |
| Mobile layouts | Yes | No sideways scrolling on 15 pages at 8 widths (320–1440 px) | |
| Email notifications | **Not built** | — | In-app notifications only. See section 9 |
| Professional / licensed services | **Not offered** | — | Shown as "Not offered" on the support page |
| Deployment | **Not deployed** | — | Nothing is live until you complete sections 5–7 |

**Automated tests:** 19 database security tests (`npm run test:db`), 122 browser checks (`npm run test:e2e`).

---

## 2. Try it now (preview mode, nothing to set up)

Preview mode runs the **real database and security rules inside your browser** (PGlite, Postgres compiled to WebAssembly). Data stays in that browser only.

```bash
npm install
npm run build:demo
npx vite preview --mode demo --port 4180
```
Open http://localhost:4180. The first load takes a few seconds while the in-browser database is created.

Preview sign-ins (shown on the Sign in page in preview mode only; they don't exist on the live site):

| Role | Email | Password |
|---|---|---|
| Administrator | owner@preview.test | preview-owner |
| Moderator | moderator@preview.test | preview-mod |
| Member | alex@preview.test | preview-alex |
| Member | sam@preview.test | preview-sam |

"Reset preview" in the yellow bar erases the preview data. **Never deploy a preview build as the real site.**

Preview-only limit: if the page is reloaded within a split second of saving something, that last save can occasionally be lost. The live site uses Supabase, which doesn't have this issue.

---

## 3. How it's built

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4. Fonts: Playfair Display (headings), Inter (text), both bundled (no Google Fonts calls).
- **Backend:** Supabase: Postgres database, Auth, Storage (images), Realtime (live chat).
- **Security model:** the browser can only call database **functions** (`supabase/migrations/0003_functions.sql`). Every function checks sign-in, account status, ownership, role and rate limits **on the server**. Row-level security (`0002_security.sql`) is a second lock on every table. Hiding a button is never the security.
- **No secrets in the frontend.** The app uses only the public Supabase URL and anon key. The `service_role` key must never go in this repo or any `VITE_` variable.

```
content/                 Launch content (JSON) with verified sources. Source of seed.sql
scripts/generate-seed.mjs  Builds supabase/seed.sql from /content
supabase/migrations/     0001 schema, 0002 security rules, 0003 functions, 0004 storage
supabase/seed.sql        Topics, articles, exercises, pages, prompts, forum spaces, journeys
supabase/sim/shim.sql    Stand-in for Supabase auth/storage. Tests and preview ONLY
src/lib/                 backend.ts (interface), supabaseBackend.ts (live), demoBackend.ts (preview)
src/pages/               Public and member pages
src/admin/               Admin and moderation
src/components/          Layout, crisis panel, reflection box, safety tools, UI kit
src/data/crisis.ts       Crisis phone numbers (verified Oct 16, 2026). Re-verify before launch
tests/                   db.test.mjs (database rules), e2e.py (browser)
public/brand/            Logo files
```

### Who can see what (the real access model)

| Data | Who can see it in the app |
|---|---|
| Journal entries | **Only the member.** No policy exists for administrators or moderators, and admin statistics never count journals. |
| Saved items, notifications | Only the member |
| Forum posts | Signed-in members. Pending and removed posts: only the author and staff. Blocked or muted authors are hidden from the person who blocked them. |
| Website support chats | The member and staff (moderators and administrators) |
| Member-to-member messages | Only the two members. Staff see a message **only if it is reported**, and every such view is written to the audit log. |
| Reports | The reporter and staff |
| Audit log | Staff only. It can't be edited or deleted from the app. |

**Exceptional access (be honest about this in your privacy policy):** anyone with your Supabase dashboard login or the `service_role` key can read the raw database, including journals. So can Supabase as your hosting provider, and data can be disclosed if legally required. Protect the dashboard with a strong password and two-factor authentication, and limit who has it.

---

## 4. Brand

The brand uses the **original #ChooseHappiness sunset logos** (round 1): the photo badge, the vector badge and the horizontal lockup, in `public/brand/`. The favicon and app icons (`public/brand/mark.svg`, `icon-*.png`) are the vector sunset without text, so they stay readable at small sizes.

Colors: warm ivory `#F7F3EB`, sage `#6B8F7A` (decorative) / `#46664F` (text), mist blue `#A7C4D1`, clay `#D8B9A6`, terracotta `#C98A6B` (decorative) / `#94543A` (text), deep evergreen `#263E34`. Text colors meet WCAG AA contrast.

Photos: the site uses drawn landscapes until you upload a homepage photo (Admin → Settings). Use only photos you have the rights to, and avoid staged "happy" stock photos.

---

## 5. Connect Supabase (step by step)

1. **Create a project** at https://supabase.com (choose a region near your members). Save the database password somewhere safe.
2. **Run the migrations, in order.** Dashboard → SQL Editor → New query → paste and run each file:
   1. `supabase/migrations/0001_schema.sql`
   2. `supabase/migrations/0002_security.sql`
   3. `supabase/migrations/0003_functions.sql`
   4. `supabase/migrations/0004_storage.sql`
   5. `supabase/seed.sql` (the launch content)

   Or with the Supabase CLI: `supabase link --project-ref YOUR-REF` then `supabase db push`, then run `seed.sql` in the SQL Editor.

   **Do not run `supabase/sim/shim.sql` on a real project.**
3. **Auth settings** (Authentication → Sign In / Providers and URL Configuration):
   - Email provider on. Keep **Confirm email** on.
   - Site URL: your live address (e.g. `https://www.choosehappiness.example`).
   - Redirect URLs: add `https://YOUR-DOMAIN/signin` and `https://YOUR-DOMAIN/reset-password`.
   - Minimum password length: 8 or more.
   - **Set up custom SMTP** (Authentication → Emails → SMTP settings). Supabase's built-in email sender is heavily rate-limited and meant for testing only, so confirmation and reset emails will fail at any real volume without it. See section 9.
4. **Realtime:** the migration adds the `messages` table to the `supabase_realtime` publication. Confirm under Database → Publications.
5. **Storage:** confirm a public bucket named `media` exists (created by 0004).
6. **Get your keys:** Project Settings → API → copy the **Project URL** and the **anon public** key.
7. **Make yourself the administrator:** sign up on your live site, confirm your email, then run in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
   ```
   Add moderators later from Admin → Members.
8. **Message retention (recommended):** Database → Extensions → enable `pg_cron`, then run:
   ```sql
   select cron.schedule('chat-retention', '15 3 * * *', $$select public.run_retention()$$);
   ```
   This deletes chat messages older than the number of days in Admin → Settings, every night.

---

## 6. Environment variables

Copy `.env.example` to `.env.local` for local work, and add the same values in your host's settings:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your anon public key (safe to expose; the database rules protect the data) |
| `VITE_SITE_URL` | Your live address, no trailing slash |

Without the first two, the site shows "This site isn't connected yet" instead of failing silently.

---

## 7. Deploy

**Netlify:** New site → import the GitHub repo → build command `npm run build`, publish directory `dist` (already in `netlify.toml`) → add the environment variables → deploy → add your custom domain (HTTPS is automatic).

**Cloudflare Pages:** Create project → connect repo → build `npm run build`, output `dist` → add the environment variables. `public/_redirects` and `public/_headers` are included.

Both configs set security headers (no framing, content security policy limited to your site and `*.supabase.co`).

After deploying, run the **launch test** below.

### Launch test (do this on the live site before announcing)
1. Sign up with a real email; confirm the email arrives and the link works.
2. Request a password reset; confirm the email and the reset page work.
3. As a second test member, post in a discussion. Confirm it waits for review, approve it as admin, and confirm the first member sees it.
4. Write "I want to end my life" in a test post. Confirm it's held, flagged urgent, and the writer sees the 988 panel.
5. Start a website-support chat on a phone; reply from a computer as admin; confirm the reply appears on the phone **without refreshing** (this confirms Realtime).
6. Write a journal entry as a member. Sign in as admin and confirm it's not visible anywhere.
7. Upload a homepage photo in Admin → Settings (confirms Storage).
8. Download a member's data export, then delete that test account.
9. Tap every crisis link on a phone (Call 988, Text 988, Chat online).

---

## 8. Running the tests

```bash
npm run test:db                 # 19 database security tests (no browser needed)
npm run build:demo
npx vite preview --mode demo --port 4180 &
npm run test:e2e                # 122 browser checks incl. accessibility + mobile
```
The browser tests need Python Playwright with Chromium.

---

## 9. Outside services and estimated costs

**These prices are estimates, not verified.** Pricing pages couldn't be checked while this was built. Confirm current prices on each provider's pricing page before budgeting.

| Service | Used for | Estimated cost | Limits to know |
|---|---|---|---|
| Supabase | Database, sign-in, image storage, live chat | Free tier to start; Pro is about $25/month | **Free projects pause after about a week without activity.** Use Pro for a live community. https://supabase.com/pricing |
| Netlify or Cloudflare Pages | Hosting | Free tier is usually enough to start | https://www.netlify.com/pricing/ · https://pages.cloudflare.com |
| Custom email (SMTP), e.g. Resend, Postmark, SendGrid | Sign-up confirmation and password-reset emails | Free tiers exist (often around 100 emails/day); paid plans start around $15–20/month | **Required for production sign-ups.** Needs DNS records on your domain |
| Domain name | Your web address | About $10–20/year | |
| Optional: email notifications for replies and messages | Not built yet | Uses the same email provider | Would need a Supabase Edge Function plus database webhook |

Not needed: no analytics or ad trackers are included (on purpose, for privacy).

---

## 10. Running the community day to day

- **Moderation:** Admin → Moderation. Urgent items (possible self-harm) are listed first. Read `docs/MODERATION_PLAYBOOK.md` and have it reviewed **before launch**.
- **Support chat:** set your real availability in Admin → Settings → Live support. The site only ever shows what you set. Choose "Online" only when someone is really there.
- **Monitoring statement:** Admin → Settings → "How the community is monitored". Keep it accurate. Never claim 24/7 monitoring unless it's true.
- **High-risk phrases:** Admin → Settings. Posts containing them are held for a person to review and the writer sees crisis resources. This is a safety net; it can't reliably detect risk.
- **Content:** Admin → Articles & exercises (Markdown editor with preview, drafts, sources, "reviewed by a licensed professional" checkbox). Pages covers the manifesto, About, Get Help, Research, policies and guidelines.
- **Daily reflections:** Admin → Daily reflections. Schedule a prompt for a date, or let active prompts rotate.

---

## 11. Needs your configuration or professional review before launch

See `docs/LAUNCH_CHECKLIST.md` for the full list. The essentials:

1. **Legal review:** Privacy Policy and Terms of Use (drafts with bracketed placeholders like [State], [Owner email address], [X days]).
2. **Clinical review:** Get Help, Research & Evidence, and all sensitive articles (depression, anxiety, grief, seeking help). Check "Reviewed by a licensed professional" only after a real review.
3. **Crisis information:** re-verify every number in `src/data/crisis.ts` and on the Get Help page (last checked Oct 16, 2026).
4. **Moderation and escalation procedure:** `docs/MODERATION_PLAYBOOK.md` is a draft. Have a qualified professional and your lawyer review it, and decide who is on call.
5. **Age:** sign-up requires members to confirm they are 18+. Decide with your lawyer whether that stays.
6. **Support hours and reply times:** set them in Admin → Settings.
7. **Custom SMTP** for emails.
8. **No HIPAA or clinical-compliance claims.** The platform isn't set up for them and must not claim them.

---

## 12. Updating launch content

The articles live in `/content/*.json`. To reload them into a fresh database: edit the JSON, run `npm run seed`, then run `supabase/seed.sql`. Existing rows are never overwritten, so edits made in Admin are safe. For a live site, edit in Admin instead.

Every source in the launch content was opened and checked when it was written (October 2026). A few links point to university repositories rather than the publisher. Re-check links once a year.
