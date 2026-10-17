# #ChooseHappiness launch checklist

Tick each item before announcing the site. Items marked **(professional)** need a qualified person, not just the owners.

## Accounts and services
- [ ] Supabase project created on a paid plan (free projects pause when idle)
- [ ] Migrations 0001–0004 and seed.sql run in order; shim.sql NOT run
- [ ] Custom SMTP configured; confirmation and reset emails tested with a real inbox
- [ ] Auth Site URL and redirect URLs set to the live domain
- [ ] Owner account made administrator (README step 5.7); at least one backup administrator
- [ ] Supabase dashboard protected with two-factor authentication; access limited to the owners
- [ ] `service_role` key stored only in a password manager, never in code or hosting variables
- [ ] Nightly message retention scheduled with pg_cron (README step 5.8)
- [ ] Hosting connected with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL
- [ ] Custom domain with HTTPS
- [ ] Live launch test in README section 7 fully passed

## Safety (professional)
- [ ] Crisis numbers in `src/data/crisis.ts` and the Get Help page re-verified on the official sites
- [ ] Get Help page reviewed by a qualified mental health professional
- [ ] Moderation playbook (`docs/MODERATION_PLAYBOOK.md`) reviewed and adopted; on-call person named
- [ ] High-risk phrase list reviewed (Admin → Settings)
- [ ] "How the community is monitored" text matches what you actually do
- [ ] Decision made on member-to-member messages (off by default)
- [ ] Moderators trained on the playbook; each knows they are not crisis counselors

## Content (professional)
- [ ] Sensitive articles reviewed (depression, anxiety, grief and loss, seeking help, meaning, relationships)
- [ ] Research & Evidence page reviewed; strength labels confirmed
- [ ] "Reviewed by a licensed professional" checked ONLY on articles that were actually reviewed
- [ ] All source links re-opened and working

## Legal (professional)
- [ ] Privacy Policy reviewed; placeholders filled ([Owner email address], [X days], backup retention, [State])
- [ ] Terms of Use reviewed; governing law and dispute terms filled
- [ ] Age requirement confirmed (currently 18+ to create an account)
- [ ] No claims of HIPAA compliance, therapy or clinical services anywhere
- [ ] "Needs professional review" unchecked on each page after its review (Admin → Pages)

## Operations
- [ ] Support hours and reply time set honestly (Admin → Settings)
- [ ] Support status set; someone responsible for switching it to Online/Offline
- [ ] Contact email set and monitored
- [ ] Homepage photo uploaded (optional; must have rights to use it)
- [ ] Discussion spaces and guidelines reviewed (Admin → Discussion spaces / Pages)
