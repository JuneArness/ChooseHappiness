-- Hardening from the Supabase security advisor (Oct 2026).
-- 1. _conv_card only describes conversations the caller is allowed to see (it previously
--    returned member names for any conversation id passed to it directly).
create or replace function public._conv_card(c public.conversations) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not (public.is_member_of(c.id) or (c.kind = 'support' and public.is_staff())) then null else
  jsonb_build_object('id', c.id, 'kind', c.kind, 'subject', c.subject, 'status', c.status,
    'created_at', c.created_at, 'last_message_at', c.last_message_at, 'created_by', public._author(c.created_by),
    'members', coalesce((select jsonb_agg(public._author(m.user_id)) from public.conversation_members m where m.conversation_id = c.id), '[]'),
    'unread', (select count(*) from public.messages x where x.conversation_id = c.id and x.sender_id is distinct from auth.uid()
               and x.created_at > coalesce((select last_read_at from public.conversation_members m
                  where m.conversation_id = c.id and m.user_id = auth.uid()), '-infinity'::timestamptz))) end $$;

-- 2. Signed-out visitors may call only the public-content functions. Everything else needs a sign-in.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function
  public.get_site(), public.site_today(), public.get_daily_prompt(), public.list_prompts(),
  public._article_card(public.articles), public.list_topics(text),
  public.list_articles(text, text, text, text, text, boolean), public.get_article(text), public.get_topic(text),
  public.get_page(text), public.list_pages(), public.list_journeys(), public.list_categories(),
  public.my_role(), public.is_admin(), public.is_staff(), public.i_block(uuid), public.is_member_of(uuid), public.me()
  to anon;

-- 3. Internal helpers stay unavailable to the browser.
revoke execute on function public._active_uid(), public._require_staff(), public._require_admin(),
  public._log(text, text, text, text), public._notify(uuid, text, text, text), public._notify_staff(text, text, text),
  public._post_status(uuid, text), public.handle_new_user()
  from authenticated;

-- 4. Pin search_path on every function that doesn't set it.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proconfig is null loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- 5. Future functions are not callable by signed-out visitors unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon;
