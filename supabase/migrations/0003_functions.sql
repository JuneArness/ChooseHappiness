-- App functions. The browser calls ONLY these (via supabase.rpc), so every rule below is
-- enforced on the server. Errors use the format CODE|Friendly message.
--  * Read functions are SECURITY INVOKER: the row-level security in 0002 decides what is visible.
--  * Write functions are SECURITY DEFINER: they check sign-in, account status, ownership,
--    staff role and rate limits explicitly before changing anything.

-- ============ helpers ============
create or replace function public._uid() returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'AUTH|Please sign in first.'; end if;
  return auth.uid();
end $$;

-- Signed in AND allowed to post (not suspended or banned).
create or replace function public._active_uid() returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = public._uid();
  if p.id is null then raise exception 'AUTH|Please sign in first.'; end if;
  if p.status = 'banned' then raise exception 'BANNED|This account can no longer post or message. You can still read, export your data, or submit an appeal.'; end if;
  if p.status = 'suspended' and (p.suspended_until is null or p.suspended_until > now()) then
    raise exception 'SUSPENDED|Your account is paused from posting until %. You can still read and use your journal, or submit an appeal.',
      coalesce(to_char(p.suspended_until, 'Mon DD, YYYY'), 'a moderator lifts it');
  end if;
  if p.status = 'suspended' then update public.profiles set status = 'active', suspended_until = null where id = p.id; end if;
  return p.id;
end $$;

create or replace function public._require_staff() returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN|Only moderators and administrators can do that.'; end if;
  return auth.uid();
end $$;

create or replace function public._require_admin() returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN|Only administrators can do that.'; end if;
  return auth.uid();
end $$;

create or replace function public._log(p_action text, p_type text, p_id text, p_reason text) returns void
language sql security definer set search_path = public as $$
  insert into public.moderation_log (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), p_action, coalesce(p_type, ''), coalesce(p_id, ''), coalesce(p_reason, '')) $$;

create or replace function public._notify(p_user uuid, p_kind text, p_text text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, text, link)
  select p_user, p_kind, p_text, coalesce(p_link, '') where p_user is not null $$;

create or replace function public._notify_staff(p_kind text, p_text text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, text, link)
  select id, p_kind, p_text, p_link from public.profiles where role in ('admin', 'moderator') and status = 'active' $$;

-- Does this text contain any of the owner's high-risk phrases? Used to hold posts for human review.
create or replace function public._high_risk(p_text text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.site_settings s, unnest(s.high_risk_terms) term
    where s.id = 1 and length(term) > 2 and lower(coalesce(p_text, '')) like '%' || lower(term) || '%') $$;

create or replace function public._author(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('id', id, 'name', display_name, 'role', role) from public.profiles where id = p_id),
    jsonb_build_object('id', null, 'name', 'Former member', 'role', 'member')) $$;

create or replace function public._clean(p text, p_max int) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F]', '', 'g')), p_max) $$;

-- ============ public content (security invoker) ============
create or replace function public.get_site() returns jsonb language sql stable as $$
  select to_jsonb(s)
  from public.site_settings s where id = 1 $$;

-- "Today" follows the site's own time zone (Admin > Settings), not the server's UTC clock.
create or replace function public.site_today() returns date language sql stable as $$
  select (now() at time zone coalesce((select timezone from public.site_settings where id = 1), 'UTC'))::date $$;

create or replace function public.get_daily_prompt() returns jsonb language sql stable as $$
  select coalesce(
    (select jsonb_build_object('id', id, 'text', text) from public.reflection_prompts where scheduled_for = public.site_today() and active),
    (select jsonb_build_object('id', id, 'text', text) from (
       select id, text, row_number() over (order by created_at, id) - 1 as n, count(*) over () as c
       from public.reflection_prompts where active and scheduled_for is null) x
     where n = (extract(doy from public.site_today())::int % greatest(c, 1)))) $$;

create or replace function public.list_prompts() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.scheduled_for nulls last, p.created_at), '[]') from public.reflection_prompts p $$;

create or replace function public._article_card(a public.articles) returns jsonb language sql stable as $$
  select jsonb_build_object('id', a.id, 'slug', a.slug, 'title', a.title, 'summary', a.summary, 'pillar', a.pillar,
    'kind', a.kind, 'topic_slug', a.topic_slug, 'reading_minutes', a.reading_minutes, 'sensitive', a.sensitive,
    'featured', a.featured, 'published', a.published, 'image_url', a.image_url, 'tags', to_jsonb(a.tags),
    'updated_at', a.updated_at, 'reviewed_by_professional', a.reviewed_by_professional) $$;

create or replace function public.list_topics(p_pillar text default null) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('article_count',
    (select count(*) from public.articles a where a.topic_slug = t.slug and a.published)) order by t.sort, t.title), '[]')
  from public.topics t where p_pillar is null or t.pillar = p_pillar $$;

create or replace function public.list_articles(p_q text default '', p_pillar text default null, p_topic text default null,
  p_kind text default null, p_tag text default null, p_include_drafts boolean default false) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(public._article_card(a) order by a.featured desc, a.title), '[]')
  from public.articles a
  where (a.published or (p_include_drafts and public.is_staff()))
    and (p_pillar is null or a.pillar = p_pillar)
    and (p_topic is null or a.topic_slug = p_topic)
    and (p_kind is null or a.kind = p_kind)
    and (p_tag is null or p_tag = any (a.tags))
    and (coalesce(p_q, '') = '' or (a.title || ' ' || a.summary || ' ' || a.body || ' ' || array_to_string(a.tags, ' '))
         ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%') $$;

create or replace function public.get_article(p_slug text) returns jsonb language sql stable as $$
  select to_jsonb(a) || jsonb_build_object(
    'topic', (select to_jsonb(t) from public.topics t where t.slug = a.topic_slug),
    'related_cards', coalesce((select jsonb_agg(public._article_card(r)) from public.articles r
                               where r.slug in (select jsonb_array_elements_text(a.related)) and r.published), '[]'))
  from public.articles a where a.slug = p_slug $$;

create or replace function public.get_topic(p_slug text) returns jsonb language sql stable as $$
  select to_jsonb(t) || jsonb_build_object('articles', public.list_articles('', null, t.slug, null, null, false))
  from public.topics t where t.slug = p_slug $$;

create or replace function public.get_page(p_slug text) returns jsonb language sql stable as $$
  select to_jsonb(p) from public.pages p where p.slug = p_slug $$;

create or replace function public.list_pages() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'title', title, 'published', published,
    'needs_professional_review', needs_professional_review, 'updated_at', updated_at) order by title), '[]') from public.pages $$;

create or replace function public.list_journeys() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(j) order by j.sort, j.title), '[]') from public.journeys j $$;

-- Category list with aggregate counts only (safe to show signed-out visitors).
create or replace function public.list_categories() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
    'thread_count', (select count(*) from public.threads t where t.category_slug = c.slug and t.status = 'published'),
    'following', exists (select 1 from public.category_follows f where f.category_slug = c.slug and f.user_id = auth.uid()))
    order by c.sort, c.name), '[]')
  from public.forum_categories c where c.active or public.is_staff() $$;

-- ============ member: profile, notifications ============
create or replace function public.me() returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(p) || jsonb_build_object(
    'unread', (select count(*) from public.notifications n where n.user_id = p.id and n.read_at is null),
    'is_staff', p.role in ('admin', 'moderator'))
  from public.profiles p where p.id = auth.uid() $$;

create or replace function public.update_my_profile(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_name text;
begin
  if p ? 'display_name' then
    v_name := public._clean(p ->> 'display_name', 40);
    if char_length(v_name) < 2 then raise exception 'INVALID|Display names need at least 2 characters.'; end if;
    if exists (select 1 from public.profiles where lower(display_name) = lower(v_name) and id <> v_uid) then
      raise exception 'DUPLICATE|That display name is taken. Please choose another.'; end if;
  end if;
  update public.profiles set
    display_name = coalesce(v_name, display_name),
    bio = case when p ? 'bio' then public._clean(p ->> 'bio', 300) else bio end,
    notify_replies = coalesce((p ->> 'notify_replies')::boolean, notify_replies),
    notify_messages = coalesce((p ->> 'notify_messages')::boolean, notify_messages),
    email_notifications = coalesce((p ->> 'email_notifications')::boolean, email_notifications),
    allow_peer_messages = coalesce((p ->> 'allow_peer_messages')::boolean, allow_peer_messages)
  where id = v_uid;
  return public.me();
end $$;

create or replace function public.my_notifications() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]')
  from (select * from public.notifications where user_id = auth.uid() order by created_at desc limit 50) n $$;

create or replace function public.mark_notifications_read() returns void language sql as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null $$;

-- ============ member: journal & saved items (security invoker: RLS = owner only) ============
create or replace function public.my_journal(p_q text default '', p_from date default null, p_to date default null) returns jsonb
language plpgsql stable as $$
begin
  perform public._uid();
  return coalesce((select jsonb_agg(to_jsonb(j) order by j.entry_date desc, j.created_at desc)
    from public.journal_entries j
    where j.user_id = auth.uid()
      and (p_from is null or j.entry_date >= p_from) and (p_to is null or j.entry_date <= p_to)
      and (coalesce(p_q, '') = '' or (j.title || ' ' || j.body || ' ' || j.prompt) ilike '%' || p_q || '%')), '[]');
end $$;

create or replace function public.save_journal_entry(p jsonb) returns jsonb language plpgsql as $$
declare v_uid uuid := public._uid(); v_row public.journal_entries;
begin
  if char_length(coalesce(p ->> 'body', '')) > 20000 then raise exception 'INVALID|Entries can be up to 20,000 characters.'; end if;
  if coalesce(btrim(p ->> 'body'), '') = '' and coalesce(btrim(p ->> 'title'), '') = '' then
    raise exception 'INVALID|Write something before saving.'; end if;
  if (select count(*) from public.journal_entries where user_id = v_uid and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'RATE_LIMIT|You have saved a lot of entries in the last hour. Please try again a little later.'; end if;
  if nullif(p ->> 'id', '') is null then
    insert into public.journal_entries (user_id, entry_date, title, body, prompt, source, source_ref)
    values (v_uid, coalesce((p ->> 'entry_date')::date, public.site_today()), public._clean(p ->> 'title', 160), coalesce(p ->> 'body', ''),
            public._clean(p ->> 'prompt', 300), coalesce(nullif(p ->> 'source', ''), 'journal'), public._clean(p ->> 'source_ref', 120))
    returning * into v_row;
  else
    update public.journal_entries set entry_date = coalesce((p ->> 'entry_date')::date, entry_date),
      title = public._clean(p ->> 'title', 160), body = coalesce(p ->> 'body', ''), updated_at = now()
    where id = (p ->> 'id')::uuid returning * into v_row;  -- RLS limits this to the owner's rows
    if v_row.id is null then raise exception 'NOT_FOUND|That entry was not found.'; end if;
  end if;
  return to_jsonb(v_row);
end $$;

create or replace function public.delete_journal_entry(p_id uuid) returns void language plpgsql as $$
begin
  perform public._uid();
  delete from public.journal_entries where id = p_id;  -- RLS: owner only, permanent
  if not found then raise exception 'NOT_FOUND|That entry was not found.'; end if;
end $$;

create or replace function public.my_saved() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]') from public.saved_items s where s.user_id = auth.uid() $$;

create or replace function public.toggle_saved(p_type text, p_ref text, p_status text) returns boolean language plpgsql as $$
declare v_uid uuid := public._uid();
begin
  delete from public.saved_items where user_id = v_uid and item_type = p_type and item_ref = p_ref and status = p_status;
  if found then return false; end if;
  insert into public.saved_items (user_id, item_type, item_ref, status) values (v_uid, p_type, left(p_ref, 120), p_status);
  return true;
end $$;

-- ============ community: reading (security invoker) ============
create or replace function public._thread_card(t public.threads) returns jsonb language sql stable as $$
  select jsonb_build_object('id', t.id, 'category_slug', t.category_slug, 'title', t.title,
    'excerpt', left(t.body, 220), 'content_warning', t.content_warning, 'status', t.status, 'hold_reason', t.hold_reason,
    'reply_count', t.reply_count, 'created_at', t.created_at, 'last_activity_at', t.last_activity_at,
    'author', public._author(t.author_id), 'mine', t.author_id = auth.uid()) $$;

create or replace function public.list_threads(p_category text default null, p_mine boolean default false, p_limit int default 50) returns jsonb
language plpgsql stable as $$
begin
  perform public._uid();
  return coalesce((select jsonb_agg(public._thread_card(t) order by t.last_activity_at desc)
    from (select * from public.threads t
          where (p_category is null or t.category_slug = p_category)
            and (not p_mine or t.author_id = auth.uid())
            and (t.status = 'published' or t.author_id = auth.uid())
          order by t.last_activity_at desc limit least(p_limit, 100)) t), '[]');
end $$;

create or replace function public._reaction_summary(p_type text, p_id uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.reactions
                where target_type = p_type and target_id = p_id group by kind) x), '{}'),
    'mine', coalesce((select jsonb_agg(kind) from public.reactions where target_type = p_type and target_id = p_id and user_id = auth.uid()), '[]')) $$;

create or replace function public.get_thread(p_id uuid) returns jsonb language plpgsql stable as $$
declare t public.threads;
begin
  perform public._uid();
  select * into t from public.threads where id = p_id;  -- RLS decides visibility
  if t.id is null then return null; end if;
  return public._thread_card(t) || jsonb_build_object(
    'body', t.body, 'edited_at', t.edited_at, 'reactions', public._reaction_summary('thread', t.id),
    'category', (select to_jsonb(c) from public.forum_categories c where c.slug = t.category_slug),
    'bookmarked', exists (select 1 from public.saved_items s where s.user_id = auth.uid() and s.item_type = 'thread' and s.item_ref = t.id::text and s.status = 'saved'),
    'replies', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'body', r.body, 'content_warning', r.content_warning,
        'status', r.status, 'hold_reason', r.hold_reason, 'created_at', r.created_at, 'edited_at', r.edited_at,
        'author', public._author(r.author_id), 'mine', r.author_id = auth.uid(),
        'reactions', public._reaction_summary('reply', r.id)) order by r.created_at)
      from public.replies r where r.thread_id = t.id and (r.status = 'published' or r.author_id = auth.uid())), '[]'));
end $$;

-- ============ community: writing (security definer) ============
create or replace function public._post_status(p_uid uuid, p_text text, out status text, out hold_reason text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  status := 'published'; hold_reason := '';
  if public._high_risk(p_text) then
    status := 'pending'; hold_reason := 'safety';
  elsif (select review_first_posts from public.site_settings where id = 1)
    and not exists (select 1 from public.threads where author_id = p_uid and status = 'published')
    and not exists (select 1 from public.replies where author_id = p_uid and status = 'published')
    and not public.is_staff() then
    status := 'pending'; hold_reason := 'first_post';
  end if;
end $$;

create or replace function public.create_thread(p_category text, p_title text, p_body text, p_cw text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid(); v_st record; v_id uuid;
  v_title text := public._clean(p_title, 140); v_body text := public._clean(p_body, 8000);
begin
  if not (select community_open from public.site_settings where id = 1) and not public.is_staff() then
    raise exception 'CLOSED|New posts are paused right now. Please check back later.'; end if;
  if not exists (select 1 from public.forum_categories where slug = p_category and active) then
    raise exception 'INVALID|Please choose a discussion space.'; end if;
  if char_length(v_title) < 3 then raise exception 'INVALID|Please add a title (at least 3 characters).'; end if;
  if char_length(v_body) < 1 then raise exception 'INVALID|Please write your post.'; end if;
  if (select count(*) from public.threads where author_id = v_uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMIT|You can start up to 5 discussions an hour. Please try again later.'; end if;
  select * into v_st from public._post_status(v_uid, v_title || ' ' || v_body);
  insert into public.threads (category_slug, author_id, title, body, content_warning, status, hold_reason)
  values (p_category, v_uid, v_title, v_body, public._clean(p_cw, 80), v_st.status, v_st.hold_reason) returning id into v_id;
  if v_st.status = 'pending' then
    perform public._notify_staff(case when v_st.hold_reason = 'safety' then 'review_urgent' else 'review' end,
      case when v_st.hold_reason = 'safety' then 'A new post may mention a safety concern and is waiting for review.' else 'A new member''s first post is waiting for review.' end,
      '/admin/moderation');
  end if;
  return jsonb_build_object('id', v_id, 'status', v_st.status, 'hold_reason', v_st.hold_reason);
end $$;

create or replace function public.edit_thread(p_id uuid, p_title text, p_body text, p_cw text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid(); t public.threads; v_risk boolean;
  v_title text := public._clean(p_title, 140); v_body text := public._clean(p_body, 8000);
begin
  select * into t from public.threads where id = p_id;
  if t.id is null or t.author_id is distinct from v_uid then raise exception 'FORBIDDEN|You can only edit your own posts.'; end if;
  if t.status = 'removed' then raise exception 'FORBIDDEN|This post was removed and can''t be edited.'; end if;
  if char_length(v_title) < 3 or char_length(v_body) < 1 then raise exception 'INVALID|Please add a title and a message.'; end if;
  v_risk := public._high_risk(v_title || ' ' || v_body);
  update public.threads set title = v_title, body = v_body, content_warning = public._clean(p_cw, 80), edited_at = now(),
    status = case when v_risk then 'pending' else status end,
    hold_reason = case when v_risk then 'safety' else hold_reason end
  where id = p_id;
  if v_risk and t.status = 'published' then perform public._notify_staff('review_urgent', 'An edited post may mention a safety concern and is waiting for review.', '/admin/moderation'); end if;
  return jsonb_build_object('id', p_id, 'status', case when v_risk then 'pending' else t.status end, 'hold_reason', case when v_risk then 'safety' else t.hold_reason end);
end $$;

create or replace function public.delete_my_thread(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.threads set status = 'removed', hold_reason = 'deleted_by_author', title = 'Deleted by author', body = '[deleted]'
  where id = p_id and author_id = public._uid();
  if not found then raise exception 'FORBIDDEN|You can only delete your own posts.'; end if;
end $$;

create or replace function public.create_reply(p_thread uuid, p_body text, p_cw text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid(); t public.threads; v_st record; v_id uuid; v_body text := public._clean(p_body, 5000);
begin
  select * into t from public.threads where id = p_thread;
  if t.id is null or t.status <> 'published' then raise exception 'NOT_FOUND|This discussion isn''t open for replies.'; end if;
  if exists (select 1 from public.blocks where blocker_id = t.author_id and blocked_id = v_uid and kind = 'block') then
    raise exception 'FORBIDDEN|You can''t reply to this discussion.'; end if;
  if char_length(v_body) < 1 then raise exception 'INVALID|Please write a reply.'; end if;
  if (select count(*) from public.replies where author_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'RATE_LIMIT|You have replied a lot in the last hour. Please take a short break and try again.'; end if;
  select * into v_st from public._post_status(v_uid, v_body);
  insert into public.replies (thread_id, author_id, body, content_warning, status, hold_reason)
  values (p_thread, v_uid, v_body, public._clean(p_cw, 80), v_st.status, v_st.hold_reason) returning id into v_id;
  if v_st.status = 'published' then
    update public.threads set reply_count = reply_count + 1, last_activity_at = now() where id = p_thread;
    if t.author_id <> v_uid and (select notify_replies from public.profiles where id = t.author_id)
       and not exists (select 1 from public.blocks where blocker_id = t.author_id and blocked_id = v_uid) then
      perform public._notify(t.author_id, 'reply', 'Someone replied to "' || left(t.title, 60) || '".', '/community/t/' || t.id);
    end if;
  else
    perform public._notify_staff(case when v_st.hold_reason = 'safety' then 'review_urgent' else 'review' end,
      case when v_st.hold_reason = 'safety' then 'A reply may mention a safety concern and is waiting for review.' else 'A new member''s first reply is waiting for review.' end,
      '/admin/moderation');
  end if;
  return jsonb_build_object('id', v_id, 'status', v_st.status, 'hold_reason', v_st.hold_reason);
end $$;

create or replace function public.edit_reply(p_id uuid, p_body text, p_cw text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid(); r public.replies; v_risk boolean; v_body text := public._clean(p_body, 5000);
begin
  select * into r from public.replies where id = p_id;
  if r.id is null or r.author_id is distinct from v_uid then raise exception 'FORBIDDEN|You can only edit your own replies.'; end if;
  if r.status = 'removed' then raise exception 'FORBIDDEN|This reply was removed and can''t be edited.'; end if;
  if char_length(v_body) < 1 then raise exception 'INVALID|Please write a reply.'; end if;
  v_risk := public._high_risk(v_body);
  update public.replies set body = v_body, content_warning = public._clean(p_cw, 80), edited_at = now(),
    status = case when v_risk then 'pending' else status end, hold_reason = case when v_risk then 'safety' else hold_reason end
  where id = p_id;
  if v_risk and r.status = 'published' then
    update public.threads set reply_count = greatest(reply_count - 1, 0) where id = r.thread_id;
    perform public._notify_staff('review_urgent', 'An edited reply may mention a safety concern and is waiting for review.', '/admin/moderation');
  end if;
  return jsonb_build_object('id', p_id, 'status', case when v_risk then 'pending' else r.status end);
end $$;

create or replace function public.delete_my_reply(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.replies;
begin
  select * into r from public.replies where id = p_id and author_id = public._uid();
  if r.id is null then raise exception 'FORBIDDEN|You can only delete your own replies.'; end if;
  delete from public.replies where id = p_id;
  if r.status = 'published' then update public.threads set reply_count = greatest(reply_count - 1, 0) where id = r.thread_id; end if;
end $$;

create or replace function public.toggle_reaction(p_type text, p_id uuid, p_kind text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid();
begin
  if p_kind not in ('support', 'relate', 'thanks') or p_type not in ('thread', 'reply') then raise exception 'INVALID|Unknown reaction.'; end if;
  if p_type = 'thread' and not exists (select 1 from public.threads where id = p_id and status = 'published') then raise exception 'NOT_FOUND|Post not found.'; end if;
  if p_type = 'reply' and not exists (select 1 from public.replies where id = p_id and status = 'published') then raise exception 'NOT_FOUND|Reply not found.'; end if;
  delete from public.reactions where user_id = v_uid and target_type = p_type and target_id = p_id and kind = p_kind;
  if found then return false; end if;
  insert into public.reactions (user_id, target_type, target_id, kind) values (v_uid, p_type, p_id, p_kind);
  return true;
end $$;

create or replace function public.toggle_follow(p_category text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  delete from public.category_follows where user_id = v_uid and category_slug = p_category;
  if found then return false; end if;
  insert into public.category_follows values (v_uid, p_category);
  return true;
end $$;

create or replace function public.set_block(p_user uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  if p_user = v_uid then raise exception 'INVALID|You can''t block yourself.'; end if;
  if p_kind is null or p_kind = '' then
    delete from public.blocks where blocker_id = v_uid and blocked_id = p_user;
  elsif p_kind in ('block', 'mute') then
    if exists (select 1 from public.profiles where id = p_user and role in ('admin', 'moderator')) and p_kind = 'block' then
      raise exception 'INVALID|Moderators can''t be blocked, because they may need to contact you about your account. You can mute them instead.'; end if;
    insert into public.blocks (blocker_id, blocked_id, kind) values (v_uid, p_user, p_kind)
    on conflict (blocker_id, blocked_id) do update set kind = excluded.kind;
  else raise exception 'INVALID|Unknown option.'; end if;
end $$;

create or replace function public.my_blocks() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('user', public._author(b.blocked_id), 'kind', b.kind, 'created_at', b.created_at)), '[]')
  from public.blocks b where b.blocker_id = auth.uid() $$;

create or replace function public.report_content(p_type text, p_id uuid, p_reason text, p_details text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_id uuid; v_ok boolean;
begin
  if (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'RATE_LIMIT|You have sent many reports today. Thank you. Our moderators will review them.'; end if;
  v_ok := case p_type
    when 'thread' then exists (select 1 from public.threads where id = p_id)
    when 'reply' then exists (select 1 from public.replies where id = p_id)
    when 'message' then exists (select 1 from public.messages m where m.id = p_id and public.is_member_of(m.conversation_id))
    when 'user' then exists (select 1 from public.profiles where id = p_id)
    else false end;
  if not v_ok then raise exception 'NOT_FOUND|We couldn''t find what you''re reporting.'; end if;
  select id into v_id from public.reports where reporter_id = v_uid and target_type = p_type and target_id = p_id and status = 'open';
  if v_id is not null then return v_id; end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details, priority)
  values (v_uid, p_type, p_id, p_reason, public._clean(p_details, 1000), case when p_reason = 'safety' then 'high' else 'normal' end)
  returning id into v_id;
  perform public._notify_staff(case when p_reason = 'safety' then 'report_urgent' else 'report' end,
    case when p_reason = 'safety' then 'A safety report needs review.' else 'A new report needs review.' end, '/admin/moderation');
  return v_id;
end $$;

create or replace function public.submit_appeal(p_about text, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_id uuid;
begin
  if (select count(*) from public.appeals where user_id = v_uid and status = 'open') >= 3 then
    raise exception 'RATE_LIMIT|You already have open appeals. A moderator will respond to them first.'; end if;
  if char_length(btrim(coalesce(p_message, ''))) < 10 then raise exception 'INVALID|Please explain a little more (at least 10 characters).'; end if;
  insert into public.appeals (user_id, about, message) values (v_uid, public._clean(p_about, 200), public._clean(p_message, 2000)) returning id into v_id;
  perform public._notify_staff('appeal', 'A member submitted an appeal.', '/admin/moderation');
  return v_id;
end $$;

create or replace function public.my_appeals() returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]') from public.appeals a where a.user_id = auth.uid() $$;

-- ============ messaging ============
create or replace function public._conv_card(c public.conversations) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'kind', c.kind, 'subject', c.subject, 'status', c.status,
    'created_at', c.created_at, 'last_message_at', c.last_message_at, 'created_by', public._author(c.created_by),
    'members', coalesce((select jsonb_agg(public._author(m.user_id)) from public.conversation_members m where m.conversation_id = c.id), '[]'),
    'unread', (select count(*) from public.messages x where x.conversation_id = c.id and x.sender_id is distinct from auth.uid()
               and x.created_at > coalesce((select last_read_at from public.conversation_members m
                  where m.conversation_id = c.id and m.user_id = auth.uid()), '-infinity'::timestamptz))) $$;

create or replace function public.my_conversations() returns jsonb language plpgsql stable as $$
begin
  perform public._uid();
  return coalesce((select jsonb_agg(public._conv_card(c) order by c.last_message_at desc)
    from public.conversations c where public.is_member_of(c.id)), '[]');
end $$;

create or replace function public.support_inbox(p_status text default 'open') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_staff();
  return coalesce((select jsonb_agg(public._conv_card(c) order by c.last_message_at desc)
    from public.conversations c where c.kind = 'support' and (p_status is null or c.status = p_status)), '[]');
end $$;

create or replace function public.get_conversation(p_id uuid) returns jsonb language plpgsql stable as $$
declare c public.conversations;
begin
  perform public._uid();
  select * into c from public.conversations where id = p_id;  -- RLS: members (and staff for support)
  if c.id is null then return null; end if;
  return public._conv_card(c) || jsonb_build_object('messages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'body', case when m.removed then '' else m.body end, 'removed', m.removed, 'from_staff', m.from_staff,
      'created_at', m.created_at, 'mine', m.sender_id = auth.uid(), 'sender', public._author(m.sender_id)) order by m.created_at)
    from public.messages m where m.conversation_id = c.id), '[]'));
end $$;

create or replace function public.start_support_conversation(p_subject text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid(); v_id uuid; v_status text;
begin
  select support_status into v_status from public.site_settings where id = 1;
  if v_status = 'unavailable' then raise exception 'UNAVAILABLE|Website support messaging is not available right now. Please use the contact details on the Contact page.'; end if;
  if (select count(*) from public.conversations where created_by = v_uid and kind = 'support' and created_at > now() - interval '1 day') >= 5 then
    raise exception 'RATE_LIMIT|You have opened several support conversations today. Please continue in an existing one.'; end if;
  if char_length(btrim(coalesce(p_body, ''))) < 1 then raise exception 'INVALID|Please write a message.'; end if;
  insert into public.conversations (kind, subject, created_by) values ('support', coalesce(nullif(public._clean(p_subject, 120), ''), 'Website support'), v_uid) returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, v_uid);
  insert into public.messages (conversation_id, sender_id, body) values (v_id, v_uid, public._clean(p_body, 2000));
  perform public._notify_staff('support', 'New website support message.', '/admin/support');
  return jsonb_build_object('id', v_id, 'high_risk', public._high_risk(p_body));
end $$;

create or replace function public.start_peer_conversation(p_other uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid(); v_id uuid; o public.profiles;
begin
  if not (select peer_chat_enabled from public.site_settings where id = 1) then
    raise exception 'UNAVAILABLE|Member-to-member messages are turned off right now.'; end if;
  select * into o from public.profiles where id = p_other;
  if o.id is null or o.id = v_uid then raise exception 'NOT_FOUND|Member not found.'; end if;
  if not o.allow_peer_messages or o.status <> 'active' then raise exception 'UNAVAILABLE|This member isn''t accepting messages.'; end if;
  if exists (select 1 from public.blocks where (blocker_id = p_other and blocked_id = v_uid) or (blocker_id = v_uid and blocked_id = p_other and kind = 'block')) then
    raise exception 'UNAVAILABLE|This member isn''t accepting messages.'; end if;
  if (select count(*) from public.conversations where created_by = v_uid and kind = 'peer' and created_at > now() - interval '1 day') >= 10 then
    raise exception 'RATE_LIMIT|You can start up to 10 new conversations a day.'; end if;
  select c.id into v_id from public.conversations c
    join public.conversation_members a on a.conversation_id = c.id and a.user_id = v_uid
    join public.conversation_members b on b.conversation_id = c.id and b.user_id = p_other
    where c.kind = 'peer' and c.status = 'open' limit 1;
  if v_id is null then
    insert into public.conversations (kind, subject, created_by) values ('peer', '', v_uid) returning id into v_id;
    insert into public.conversation_members (conversation_id, user_id) values (v_id, v_uid), (v_id, p_other);
  end if;
  perform public.send_message(v_id, p_body);
  return jsonb_build_object('id', v_id, 'high_risk', public._high_risk(p_body));
end $$;

create or replace function public.send_message(p_conv uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._active_uid(); c public.conversations; v_staff boolean := public.is_staff(); v_id uuid;
  v_body text := public._clean(p_body, 2000); v_member boolean;
begin
  select * into c from public.conversations where id = p_conv;
  if c.id is null then raise exception 'NOT_FOUND|Conversation not found.'; end if;
  v_member := exists (select 1 from public.conversation_members where conversation_id = p_conv and user_id = v_uid);
  if not v_member and not (c.kind = 'support' and v_staff) then raise exception 'FORBIDDEN|You''re not part of this conversation.'; end if;
  if c.status = 'closed' then raise exception 'CLOSED|This conversation is closed. Start a new one if you need to.'; end if;
  if char_length(v_body) < 1 then raise exception 'INVALID|Please write a message.'; end if;
  if (select count(*) from public.messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 15 then
    raise exception 'RATE_LIMIT|You''re sending messages very quickly. Please wait a moment.'; end if;
  if c.kind = 'peer' and exists (select 1 from public.conversation_members m join public.blocks b
       on b.blocker_id = m.user_id and b.blocked_id = v_uid and b.kind = 'block'
       where m.conversation_id = p_conv and m.user_id <> v_uid) then
    raise exception 'UNAVAILABLE|This member isn''t accepting messages.'; end if;
  insert into public.messages (conversation_id, sender_id, body, from_staff)
  values (p_conv, v_uid, v_body, c.kind = 'support' and v_staff and not (c.created_by = v_uid)) returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conv;
  if v_member then update public.conversation_members set last_read_at = now() where conversation_id = p_conv and user_id = v_uid; end if;
  perform public._notify(m.user_id, 'message',
      case when c.kind = 'support' then 'New reply in your support conversation.' else 'You have a new message.' end, '/messages/' || p_conv)
    from public.conversation_members m join public.profiles p on p.id = m.user_id
    where m.conversation_id = p_conv and m.user_id <> v_uid and p.notify_messages;
  if c.kind = 'support' and not v_staff then perform public._notify_staff('support', 'New website support message.', '/admin/support'); end if;
  return jsonb_build_object('id', v_id, 'high_risk', public._high_risk(v_body));
end $$;

create or replace function public.mark_conversation_read(p_conv uuid) returns void language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now() where conversation_id = p_conv and user_id = auth.uid() $$;

create or replace function public.close_conversation(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  perform public._uid();
  select * into c from public.conversations where id = p_conv;
  if c.id is null or not (public.is_member_of(p_conv) or (c.kind = 'support' and public.is_staff())) then
    raise exception 'FORBIDDEN|You''re not part of this conversation.'; end if;
  update public.conversations set status = 'closed' where id = p_conv;
end $$;

-- ============ account: export and deletion ============
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where id = v_uid),
    'journal_entries', coalesce((select jsonb_agg(to_jsonb(j) order by j.entry_date) from public.journal_entries j where user_id = v_uid), '[]'),
    'saved_items', coalesce((select jsonb_agg(to_jsonb(s)) from public.saved_items s where user_id = v_uid), '[]'),
    'threads', coalesce((select jsonb_agg(to_jsonb(t)) from public.threads t where author_id = v_uid), '[]'),
    'replies', coalesce((select jsonb_agg(to_jsonb(r)) from public.replies r where author_id = v_uid), '[]'),
    'messages_sent', coalesce((select jsonb_agg(to_jsonb(m)) from public.messages m where sender_id = v_uid), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('target_type', target_type, 'reason', reason, 'details', details, 'status', status, 'created_at', created_at))
                               from public.reports where reporter_id = v_uid), '[]'),
    'appeals', coalesce((select jsonb_agg(to_jsonb(a)) from public.appeals a where user_id = v_uid), '[]'));
end $$;

-- Permanently deletes the account. Journal, saved items, reactions and messages are deleted;
-- forum posts are replaced with "[deleted]" so other members' replies still make sense.
create or replace function public.delete_my_account(p_confirm text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := public._uid();
begin
  if p_confirm is distinct from 'DELETE' then raise exception 'INVALID|Type DELETE to confirm.'; end if;
  if public.is_admin() and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'FORBIDDEN|You are the only administrator. Make someone else an administrator first.'; end if;
  update public.threads set title = 'Deleted by author', body = '[deleted]', status = 'removed', hold_reason = 'account_deleted' where author_id = v_uid;
  update public.replies set body = '[deleted]', status = 'removed', hold_reason = 'account_deleted' where author_id = v_uid;
  delete from public.messages where sender_id = v_uid;
  delete from public.reports where reporter_id = v_uid and status <> 'open';
  delete from auth.users where id = v_uid;  -- cascades to profile, journal, saved items, reactions, follows, blocks, notifications
end $$;

-- ============ staff: moderation ============
create or replace function public.mod_queue() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_staff();
  return jsonb_build_object(
    'pending_threads', coalesce((select jsonb_agg(public._thread_card(t) || jsonb_build_object('body', t.body) order by (t.hold_reason = 'safety') desc, t.created_at)
       from public.threads t where t.status = 'pending'), '[]'),
    'pending_replies', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'thread_id', r.thread_id, 'body', r.body, 'hold_reason', r.hold_reason,
       'created_at', r.created_at, 'author', public._author(r.author_id), 'thread_title', (select title from public.threads where id = r.thread_id))
       order by (r.hold_reason = 'safety') desc, r.created_at) from public.replies r where r.status = 'pending'), '[]'),
    'reports', coalesce((select jsonb_agg(to_jsonb(x) || jsonb_build_object('reporter', public._author(x.reporter_id))
       order by (x.priority = 'high') desc, x.created_at) from public.reports x where x.status = 'open'), '[]'),
    'appeals', coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('member', public._author(a.user_id)) order by a.created_at)
       from public.appeals a where a.status = 'open'), '[]'));
end $$;

-- Shows staff the reported item. Viewing a reported private message is written to the audit log.
create or replace function public.get_reported_target(p_report uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.reports; v jsonb;
begin
  perform public._require_staff();
  select * into r from public.reports where id = p_report;
  if r.id is null then raise exception 'NOT_FOUND|Report not found.'; end if;
  v := case r.target_type
    when 'thread' then (select jsonb_build_object('title', title, 'body', body, 'status', status, 'author', public._author(author_id), 'link', '/community/t/' || id) from public.threads where id = r.target_id)
    when 'reply' then (select jsonb_build_object('body', body, 'status', status, 'author', public._author(author_id), 'link', '/community/t/' || thread_id) from public.replies where id = r.target_id)
    when 'message' then (select jsonb_build_object('body', body, 'removed', removed, 'author', public._author(sender_id)) from public.messages where id = r.target_id)
    when 'user' then (select jsonb_build_object('author', public._author(id), 'status', status, 'bio', bio) from public.profiles where id = r.target_id)
  end;
  if r.target_type = 'message' then perform public._log('view_reported_message', 'message', r.target_id::text, 'Report ' || r.id); end if;
  return coalesce(v, jsonb_build_object('missing', true));
end $$;

create or replace function public.moderate_content(p_type text, p_id uuid, p_action text, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_thread uuid; v_old text; v_new text;
begin
  perform public._require_staff();
  v_new := case p_action when 'approve' then 'published' when 'restore' then 'published' when 'remove' then 'removed' else null end;
  if v_new is null then raise exception 'INVALID|Unknown action.'; end if;
  if p_type = 'thread' then
    select author_id, status into v_author, v_old from public.threads where id = p_id;
    if v_old is null then raise exception 'NOT_FOUND|Post not found.'; end if;
    update public.threads set status = v_new, hold_reason = case when v_new = 'removed' then 'moderator' else '' end,
      last_activity_at = case when v_old = 'pending' and v_new = 'published' then now() else last_activity_at end where id = p_id;
    v_thread := p_id;
  elsif p_type = 'reply' then
    select author_id, status, thread_id into v_author, v_old, v_thread from public.replies where id = p_id;
    if v_old is null then raise exception 'NOT_FOUND|Reply not found.'; end if;
    update public.replies set status = v_new, hold_reason = case when v_new = 'removed' then 'moderator' else '' end where id = p_id;
    if v_old = 'published' and v_new <> 'published' then update public.threads set reply_count = greatest(reply_count - 1, 0) where id = v_thread;
    elsif v_old <> 'published' and v_new = 'published' then update public.threads set reply_count = reply_count + 1, last_activity_at = now() where id = v_thread; end if;
  elsif p_type = 'message' then
    select sender_id into v_author from public.messages where id = p_id;
    if not found then raise exception 'NOT_FOUND|Message not found.'; end if;
    update public.messages set removed = (p_action = 'remove') where id = p_id;
  else raise exception 'INVALID|Unknown content type.'; end if;
  perform public._log(p_action, p_type, p_id::text, p_reason);
  if p_action = 'remove' then
    perform public._notify(v_author, 'moderation', 'A moderator removed your ' || case p_type when 'thread' then 'post' else p_type end
      || coalesce(nullif(': ' || p_reason, ': '), '') || '. You can appeal from your account page.', '/account#appeals');
  elsif p_action = 'approve' and p_type <> 'message' then
    perform public._notify(v_author, 'moderation', 'Your ' || case p_type when 'thread' then 'post' else p_type end || ' was reviewed and is now visible.', '/community/t/' || v_thread);
  end if;
end $$;

create or replace function public.resolve_report(p_id uuid, p_status text, p_resolution text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff();
  if p_status not in ('resolved', 'dismissed') then raise exception 'INVALID|Choose resolved or dismissed.'; end if;
  update public.reports set status = p_status, resolution = public._clean(p_resolution, 500), handled_by = auth.uid(), handled_at = now() where id = p_id;
  if not found then raise exception 'NOT_FOUND|Report not found.'; end if;
  perform public._log('report_' || p_status, 'report', p_id::text, p_resolution);
end $$;

create or replace function public.set_user_status(p_user uuid, p_status text, p_days int default null, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare t public.profiles;
begin
  perform public._require_staff();
  select * into t from public.profiles where id = p_user;
  if t.id is null then raise exception 'NOT_FOUND|Member not found.'; end if;
  if t.role <> 'member' and not public.is_admin() then raise exception 'FORBIDDEN|Only administrators can change a moderator''s or administrator''s status.'; end if;
  if p_user = auth.uid() then raise exception 'FORBIDDEN|You can''t change your own status.'; end if;
  if p_status = 'banned' and not public.is_admin() then raise exception 'FORBIDDEN|Only administrators can ban accounts.'; end if;
  if p_status not in ('active', 'suspended', 'banned') then raise exception 'INVALID|Unknown status.'; end if;
  update public.profiles set status = p_status,
    suspended_until = case when p_status = 'suspended' and p_days is not null then now() + make_interval(days => p_days) else null end
  where id = p_user;
  perform public._log('user_' || p_status, 'user', p_user::text, coalesce(p_reason, '') || coalesce(' (' || p_days || ' days)', ''));
  perform public._notify(p_user, 'moderation', case p_status
    when 'active' then 'Your account can post again.'
    when 'suspended' then 'Your account is paused from posting' || coalesce(' for ' || p_days || ' days', '') || coalesce(nullif(': ' || p_reason, ': '), '') || '. You can appeal from your account page.'
    else 'Your account can no longer post or message' || coalesce(nullif(': ' || p_reason, ': '), '') || '. You can appeal from your account page.' end, '/account#appeals');
end $$;

create or replace function public.handle_appeal(p_id uuid, p_status text, p_response text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.appeals;
begin
  perform public._require_staff();
  if p_status not in ('upheld', 'reversed') then raise exception 'INVALID|Choose upheld or reversed.'; end if;
  update public.appeals set status = p_status, response = public._clean(p_response, 2000), handled_by = auth.uid() where id = p_id returning * into a;
  if a.id is null then raise exception 'NOT_FOUND|Appeal not found.'; end if;
  perform public._log('appeal_' || p_status, 'appeal', p_id::text, p_response);
  perform public._notify(a.user_id, 'appeal', 'Your appeal was reviewed: ' || case p_status when 'reversed' then 'the decision was reversed.' else 'the decision stands.' end, '/account#appeals');
end $$;

create or replace function public.list_members(p_q text default '') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_staff();
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'role', p.role, 'status', p.status,
      'suspended_until', p.suspended_until, 'created_at', p.created_at,
      'post_count', (select count(*) from public.threads where author_id = p.id) + (select count(*) from public.replies where author_id = p.id),
      'open_reports', (select count(*) from public.reports where target_type = 'user' and target_id = p.id and status = 'open'))
    order by p.created_at desc)
    from (select * from public.profiles where coalesce(p_q, '') = '' or display_name ilike '%' || p_q || '%' order by created_at desc limit 200) p), '[]');
end $$;

create or replace function public.mod_log(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_staff();
  return coalesce((select jsonb_agg(to_jsonb(l) || jsonb_build_object('actor', public._author(l.actor_id)) order by l.id desc)
    from (select * from public.moderation_log order by id desc limit least(p_limit, 500)) l), '[]');
end $$;

-- Aggregate numbers only. Journal and message contents are never counted or shown here.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_staff();
  return jsonb_build_object(
    'published_articles', (select count(*) from public.articles where published),
    'draft_articles', (select count(*) from public.articles where not published),
    'members', (select count(*) from public.profiles),
    'new_members_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'threads_30d', (select count(*) from public.threads where status = 'published' and created_at > now() - interval '30 days'),
    'replies_30d', (select count(*) from public.replies where status = 'published' and created_at > now() - interval '30 days'),
    'active_discussions_7d', (select count(*) from public.threads where status = 'published' and last_activity_at > now() - interval '7 days'),
    'pending_posts', (select count(*) from public.threads where status = 'pending') + (select count(*) from public.replies where status = 'pending'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'urgent_reports', (select count(*) from public.reports where status = 'open' and priority = 'high')
      + (select count(*) from public.threads where status = 'pending' and hold_reason = 'safety')
      + (select count(*) from public.replies where status = 'pending' and hold_reason = 'safety'),
    'open_appeals', (select count(*) from public.appeals where status = 'open'),
    'open_support', (select count(*) from public.conversations where kind = 'support' and status = 'open'));
end $$;

-- ============ admin only ============
create or replace function public.set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  if p_role not in ('member', 'moderator', 'admin') then raise exception 'INVALID|Unknown role.'; end if;
  if p_user = auth.uid() and p_role <> 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'FORBIDDEN|You are the only administrator. Make someone else an administrator first.'; end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'NOT_FOUND|Member not found.'; end if;
  perform public._log('set_role_' || p_role, 'user', p_user::text, '');
end $$;

create or replace function public.admin_save_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  if p ? 'support_status' and p ->> 'support_status' not in ('online', 'offline', 'unavailable') then raise exception 'INVALID|Unknown support status.'; end if;
  update public.site_settings set
    site_name = case when p ? 'site_name' then public._clean(p ->> 'site_name', 80) else site_name end,
    timezone = case when p ? 'timezone' and exists (select 1 from pg_timezone_names where name = p ->> 'timezone') then p ->> 'timezone' else timezone end,
    tagline = case when p ? 'tagline' then public._clean(p ->> 'tagline', 200) else tagline end,
    founders = case when p ? 'founders' then public._clean(p ->> 'founders', 200) else founders end,
    contact_email = case when p ? 'contact_email' then public._clean(p ->> 'contact_email', 200) else contact_email end,
    logo_url = case when p ? 'logo_url' then public._clean(p ->> 'logo_url', 2000) else logo_url end,
    hero_image_url = case when p ? 'hero_image_url' then public._clean(p ->> 'hero_image_url', 2000) else hero_image_url end,
    support_status = coalesce(p ->> 'support_status', support_status),
    support_hours = case when p ? 'support_hours' then public._clean(p ->> 'support_hours', 300) else support_hours end,
    support_response_time = case when p ? 'support_response_time' then public._clean(p ->> 'support_response_time', 200) else support_response_time end,
    peer_chat_enabled = coalesce((p ->> 'peer_chat_enabled')::boolean, peer_chat_enabled),
    community_open = coalesce((p ->> 'community_open')::boolean, community_open),
    review_first_posts = coalesce((p ->> 'review_first_posts')::boolean, review_first_posts),
    community_monitoring_note = case when p ? 'community_monitoring_note' then public._clean(p ->> 'community_monitoring_note', 500) else community_monitoring_note end,
    message_retention_days = coalesce((p ->> 'message_retention_days')::int, message_retention_days),
    high_risk_terms = coalesce((select array_agg(distinct lower(btrim(x))) from jsonb_array_elements_text(p -> 'high_risk_terms') x where btrim(x) <> ''), high_risk_terms),
    external_links = coalesce(p -> 'external_links', external_links),
    updated_at = now()
  where id = 1;
  perform public._log('settings_saved', 'settings', '1', '');
  return public.get_site();
end $$;

create or replace function public.admin_save_article(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_row public.articles; v_pub boolean := coalesce((p ->> 'published')::boolean, false);
begin
  perform public._require_admin();
  if coalesce(p ->> 'slug', '') !~ '^[a-z0-9-]+$' then raise exception 'INVALID|The URL name can only use lowercase letters, numbers and dashes.'; end if;
  if v_id is null then
    insert into public.articles (slug, title, pillar, kind) values (p ->> 'slug', coalesce(p ->> 'title', 'Untitled'), coalesce(p ->> 'pillar', 'wellness'), coalesce(p ->> 'kind', 'article'))
    returning id into v_id;
  end if;
  update public.articles a set
    slug = p ->> 'slug', title = public._clean(p ->> 'title', 160),
    topic_slug = nullif(p ->> 'topic_slug', ''), pillar = coalesce(p ->> 'pillar', a.pillar), kind = coalesce(p ->> 'kind', a.kind),
    summary = coalesce(p ->> 'summary', ''), body = coalesce(p ->> 'body', ''), intro = coalesce(p ->> 'intro', a.intro),
    example = coalesce(p ->> 'example', a.example), closing = coalesce(p ->> 'closing', a.closing),
    steps = coalesce(p -> 'steps', a.steps), takeaways = coalesce(p -> 'takeaways', '[]'), prompts = coalesce(p -> 'prompts', '[]'),
    exercise = coalesce(p ->> 'exercise', ''), sources = coalesce(p -> 'sources', '[]'), related = coalesce(p -> 'related', '[]'),
    tags = coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'tags') x), '{}'),
    sensitive = coalesce((p ->> 'sensitive')::boolean, false), content_note = coalesce(p ->> 'content_note', ''),
    professional_note = coalesce(p ->> 'professional_note', ''), evidence_note = coalesce(p ->> 'evidence_note', ''),
    author = coalesce(nullif(p ->> 'author', ''), '#ChooseHappiness Editorial'),
    reviewed_by_professional = coalesce((p ->> 'reviewed_by_professional')::boolean, false),
    reading_minutes = coalesce((p ->> 'reading_minutes')::int, 5), image_url = coalesce(p ->> 'image_url', ''),
    featured = coalesce((p ->> 'featured')::boolean, false), published = v_pub,
    published_at = case when v_pub and a.published_at is null then now() when not v_pub then null else a.published_at end,
    updated_at = now()
  where id = v_id returning * into v_row;
  perform public._log('article_saved', 'article', v_row.slug, case when v_pub then 'published' else 'draft' end);
  return to_jsonb(v_row);
exception when unique_violation then raise exception 'DUPLICATE|Another article already uses that URL name.';
end $$;

create or replace function public.admin_delete_article(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  perform public._require_admin();
  delete from public.articles where id = p_id returning slug into v_slug;
  perform public._log('article_deleted', 'article', coalesce(v_slug, p_id::text), '');
end $$;

create or replace function public.admin_save_page(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row public.pages;
begin
  perform public._require_admin();
  if coalesce(p ->> 'slug', '') !~ '^[a-z0-9-]+$' then raise exception 'INVALID|The URL name can only use lowercase letters, numbers and dashes.'; end if;
  insert into public.pages (slug, title, summary, body, needs_professional_review, published, updated_at)
  values (p ->> 'slug', public._clean(p ->> 'title', 160), coalesce(p ->> 'summary', ''), coalesce(p ->> 'body', ''),
          coalesce((p ->> 'needs_professional_review')::boolean, false), coalesce((p ->> 'published')::boolean, true), now())
  on conflict (slug) do update set title = excluded.title, summary = excluded.summary, body = excluded.body,
    needs_professional_review = excluded.needs_professional_review, published = excluded.published, updated_at = now()
  returning * into v_row;
  perform public._log('page_saved', 'page', v_row.slug, '');
  return to_jsonb(v_row);
end $$;

create or replace function public.admin_save_prompt(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row public.reflection_prompts;
begin
  perform public._require_admin();
  if nullif(p ->> 'id', '') is null then
    insert into public.reflection_prompts (text, scheduled_for, active)
    values (public._clean(p ->> 'text', 300), nullif(p ->> 'scheduled_for', '')::date, coalesce((p ->> 'active')::boolean, true)) returning * into v_row;
  else
    update public.reflection_prompts set text = public._clean(p ->> 'text', 300), scheduled_for = nullif(p ->> 'scheduled_for', '')::date,
      active = coalesce((p ->> 'active')::boolean, true) where id = (p ->> 'id')::uuid returning * into v_row;
  end if;
  perform public._log('prompt_saved', 'prompt', v_row.id::text, '');
  return to_jsonb(v_row);
exception when unique_violation then raise exception 'DUPLICATE|Another prompt is already scheduled for that date.';
end $$;

create or replace function public.admin_delete_prompt(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from public.reflection_prompts where id = p_id;
  perform public._log('prompt_deleted', 'prompt', p_id::text, '');
end $$;

create or replace function public.admin_save_category(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row public.forum_categories;
begin
  perform public._require_admin();
  if coalesce(p ->> 'slug', '') !~ '^[a-z0-9-]+$' then raise exception 'INVALID|The URL name can only use lowercase letters, numbers and dashes.'; end if;
  insert into public.forum_categories (slug, name, description, sort, active)
  values (p ->> 'slug', public._clean(p ->> 'name', 80), public._clean(p ->> 'description', 400), coalesce((p ->> 'sort')::int, 0), coalesce((p ->> 'active')::boolean, true))
  on conflict (slug) do update set name = excluded.name, description = excluded.description, sort = excluded.sort, active = excluded.active
  returning * into v_row;
  perform public._log('category_saved', 'category', v_row.slug, '');
  return to_jsonb(v_row);
end $$;

create or replace function public.admin_save_topic(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row public.topics;
begin
  perform public._require_admin();
  if coalesce(p ->> 'slug', '') !~ '^[a-z0-9-]+$' then raise exception 'INVALID|The URL name can only use lowercase letters, numbers and dashes.'; end if;
  insert into public.topics (slug, pillar, title, summary, icon, sort)
  values (p ->> 'slug', coalesce(p ->> 'pillar', 'wellness'), public._clean(p ->> 'title', 120), coalesce(p ->> 'summary', ''), coalesce(p ->> 'icon', 'leaf'), coalesce((p ->> 'sort')::int, 0))
  on conflict (slug) do update set pillar = excluded.pillar, title = excluded.title, summary = excluded.summary, icon = excluded.icon, sort = excluded.sort
  returning * into v_row;
  perform public._log('topic_saved', 'topic', v_row.slug, '');
  return to_jsonb(v_row);
end $$;

-- Deletes chat messages older than the owner's retention setting. Schedule daily (see README).
create or replace function public.run_retention() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int; v_days int;
begin
  if auth.uid() is not null then perform public._require_admin(); end if;  -- cron runs with no user
  select message_retention_days into v_days from public.site_settings where id = 1;
  delete from public.messages where created_at < now() - make_interval(days => v_days);
  get diagnostics v_n = row_count;
  delete from public.notifications where created_at < now() - interval '180 days';
  if auth.uid() is not null then perform public._log('retention_run', 'messages', '', v_n || ' deleted'); end if;
  return v_n;
end $$;

-- Lock down: helpers are not callable from the browser.
revoke execute on function public._active_uid(), public._require_staff(), public._require_admin(), public._log(text, text, text, text),
  public._notify(uuid, text, text, text), public._notify_staff(text, text, text), public._post_status(uuid, text), public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.run_retention() from anon;
