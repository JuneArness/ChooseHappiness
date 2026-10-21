-- Row-level security. Every table is locked down; these policies are the ONLY ways
-- the browser can read data. Writes go through functions in 0003 (security definer)
-- unless a policy below allows a member to manage their own private rows.

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon') $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin' $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'moderator') $$;

-- True when the current user has blocked or muted the given author.
create or replace function public.i_block(p_author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p_author) $$;

create or replace function public.is_member_of(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conv and user_id = auth.uid()) $$;

do $$ declare t text; begin
  foreach t in array array['profiles','site_settings','pages','topics','articles','reflection_prompts','journeys',
    'journal_entries','saved_items','forum_categories','threads','replies','reactions','category_follows','blocks',
    'reports','moderation_log','appeals','conversations','conversation_members','messages','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Public content
create policy "read settings" on public.site_settings for select using (true);
create policy "read published pages" on public.pages for select using (published or public.is_staff());
create policy "read topics" on public.topics for select using (true);
create policy "read published articles" on public.articles for select using (published or public.is_staff());
create policy "read prompts" on public.reflection_prompts for select using (active or public.is_staff());
create policy "read journeys" on public.journeys for select using (published or public.is_staff());
create policy "read categories" on public.forum_categories for select using (active or public.is_staff());

-- Profiles: signed-in members see display names (needed to show authors). Nobody edits
-- profiles directly; members use update_my_profile(), staff use moderation functions.
create policy "members read profiles" on public.profiles for select to authenticated using (true);

-- Journal: private to its owner. There is deliberately NO policy for administrators or moderators.
create policy "own journal read" on public.journal_entries for select to authenticated using (user_id = auth.uid());
create policy "own journal insert" on public.journal_entries for insert to authenticated with check (user_id = auth.uid());
create policy "own journal update" on public.journal_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own journal delete" on public.journal_entries for delete to authenticated using (user_id = auth.uid());

create policy "own saved read" on public.saved_items for select to authenticated using (user_id = auth.uid());
create policy "own saved insert" on public.saved_items for insert to authenticated with check (user_id = auth.uid());
create policy "own saved delete" on public.saved_items for delete to authenticated using (user_id = auth.uid());

-- Forums are for signed-in members only (not public or indexed by search engines).
-- Removed and pending posts are visible only to their author and staff. Blocked/muted authors are hidden.
create policy "members read threads" on public.threads for select to authenticated using (
  (status = 'published' and not public.i_block(author_id))
  or author_id = auth.uid() or public.is_staff());
create policy "members read replies" on public.replies for select to authenticated using (
  ((status = 'published' and not public.i_block(author_id))
   or author_id = auth.uid() or public.is_staff())
  and exists (select 1 from public.threads t where t.id = thread_id));
create policy "members read reactions" on public.reactions for select to authenticated using (true);
create policy "own follows" on public.category_follows for select to authenticated using (user_id = auth.uid());
create policy "own blocks" on public.blocks for select to authenticated using (blocker_id = auth.uid());

-- Reports: reporters see their own; staff see all.
create policy "read reports" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_staff());
create policy "staff read log" on public.moderation_log for select to authenticated using (public.is_staff());
create policy "read appeals" on public.appeals for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- Conversations: members of the conversation; support conversations also visible to staff.
-- Peer conversations are NOT visible to staff unless a message is reported (see get_reported_target).
create policy "read conversations" on public.conversations for select to authenticated using (
  public.is_member_of(id) or (kind = 'support' and public.is_staff()));
create policy "read conversation members" on public.conversation_members for select to authenticated using (
  public.is_member_of(conversation_id)
  or exists (select 1 from public.conversations c where c.id = conversation_id and c.kind = 'support' and public.is_staff()));
create policy "read messages" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id
          and (public.is_member_of(c.id) or (c.kind = 'support' and public.is_staff()))));

create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Remove the default broad table grants for the anonymous role on private tables (defense in depth).
revoke all on public.journal_entries, public.saved_items, public.messages, public.conversations,
  public.conversation_members, public.notifications, public.reports, public.moderation_log, public.appeals,
  public.blocks, public.category_follows, public.reactions, public.threads, public.replies, public.profiles
  from anon;
