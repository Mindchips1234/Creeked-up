-- Creeked Up: accounts, cloud sync and friends.
-- Paste this whole file into Supabase's SQL Editor and press Run. It is safe to run again.
--
-- Privacy rules this enforces on the server, not just in the app:
--   * Your catches, location and notes can only be read by you.
--   * Friends only get catches through friend_catches(), which hands back a fixed list of
--     fields. Exact location (lat, lng, accuracy), notes and the photo fingerprint are never in it.
--   * Nobody can list users. You can only find someone by their exact username or friend code.
--   * Friend requests must be accepted. A blocked person can't find or request you.

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  friend_code text not null unique,
  summary jsonb not null default '{}' check (pg_column_size(summary) < 8000),
  tackle jsonb not null default '[]' check (pg_column_size(tackle) < 32000),
  tackle_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.catches (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null check (length(id) between 1 and 64),
  data jsonb not null default '{}' check (pg_column_size(data) < 8000),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists catches_user_updated on public.catches (user_id, updated_at);

create table if not exists public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.blocks (
  blocker uuid not null references public.profiles on delete cascade,
  blocked uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

-- ---------- Who can touch what ----------
-- Row Level Security is on for every table. Friendships and blocks have no policies at all,
-- so they can only be changed through the functions below.

alter table public.profiles enable row level security;
alter table public.catches enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;

revoke all on public.profiles, public.catches, public.friendships, public.blocks from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (summary, tackle, tackle_updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.catches to authenticated;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own catches" on public.catches;
create policy "own catches" on public.catches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The server stamps the time on every catch change, so syncing doesn't trust phone clocks.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists catches_touch on public.catches;
create trigger catches_touch before insert or update on public.catches
  for each row execute function public.touch_updated_at();

-- ---------- Sign up ----------
-- Makes the profile when an account is created. The app sends the username and confirms the
-- person said they are 13 or older. If either is missing or the name is taken, sign up fails.

create or replace function public.new_friend_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 8)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  name text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  code text;
begin
  if coalesce(new.raw_user_meta_data ->> 'age_13_plus', '') <> 'true' then
    raise exception 'You must be 13 or older to make an account.';
  end if;
  if name !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Usernames are 3 to 20 letters, numbers or underscores.';
  end if;
  loop
    code := public.new_friend_code();
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  insert into public.profiles (id, username, friend_code) values (new.id, name, code);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(trim(name)) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(trim(name)))
$$;

-- ---------- Friends ----------

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                 where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships
                 where status = 'accepted'
                   and ((requester = a and addressee = b) or (requester = b and addressee = a)))
$$;

-- target is a username or a friend code. Returns one of:
-- sent, accepted (they had already asked you), already_friends, already_sent, not_found, self, too_many
create or replace function public.send_friend_request(target text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them uuid;
  existing public.friendships;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select id into them from public.profiles
   where username = lower(trim(target)) or friend_code = upper(trim(target)) limit 1;
  if them is null or public.is_blocked_between(me, them) then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  select * into existing from public.friendships
   where (requester = me and addressee = them) or (requester = them and addressee = me);
  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requester = me then return 'already_sent'; end if;
    update public.friendships set status = 'accepted' where requester = them and addressee = me;
    return 'accepted';
  end if;
  if (select count(*) from public.friendships where requester = me and status = 'pending') >= 20 then
    return 'too_many';
  end if;
  insert into public.friendships (requester, addressee) values (me, them);
  return 'sent';
end $$;

create or replace function public.respond_friend_request(other uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update public.friendships set status = 'accepted'
     where requester = other and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where requester = other and addressee = auth.uid() and status = 'pending';
  end if;
end $$;

-- Unfriend, or cancel a request you sent.
create or replace function public.remove_friend(other uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships
   where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid())
$$;

create or replace function public.block_user(other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if other = auth.uid() then return; end if;
  delete from public.friendships
   where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid());
  insert into public.blocks (blocker, blocked) values (auth.uid(), other) on conflict do nothing;
end $$;

-- Everyone you're connected to. kind is friend, incoming (they asked you) or outgoing (you asked them).
-- Stats are only included for friends.
create or replace function public.list_friends()
returns table (id uuid, username text, kind text, summary jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.username,
         case when f.status = 'accepted' then 'friend'
              when f.addressee = auth.uid() then 'incoming' else 'outgoing' end,
         case when f.status = 'accepted' then p.summary else '{}'::jsonb end
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where auth.uid() in (f.requester, f.addressee)
   order by p.username
$$;

-- A friend's catches, with only the fields that are safe to share. This is a list of what IS
-- shared, so a new private field added later stays private unless it's added here on purpose.
create or replace function public.friend_catches(friend uuid)
returns table (id text, data jsonb)
language sql stable security definer set search_path = public as $$
  select c.id, jsonb_strip_nulls(jsonb_build_object(
           'speciesId',   c.data -> 'speciesId',
           'lengthCm',    c.data -> 'lengthCm',
           'weightKg',    c.data -> 'weightKg',
           'caughtAt',    c.data -> 'caughtAt',
           'createdAt',   c.data -> 'createdAt',
           'method',      c.data -> 'method',
           'bait',        c.data -> 'bait',
           'released',    c.data -> 'released',
           'hasPhoto',    c.data -> 'hasPhoto',
           'photoProof',  c.data -> 'photoProof',
           'hasLocation', to_jsonb(coalesce(jsonb_typeof(c.data -> 'lat') = 'number', false))))
    from public.catches c
   where c.user_id = friend and not c.deleted and public.are_friends(auth.uid(), friend)
   order by c.data ->> 'caughtAt' desc
   limit 500
$$;

-- True for your own photo folder, or a friend's.
create or replace function public.can_view_photos(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select folder = auth.uid()::text
      or exists (select 1 from public.friendships
                 where status = 'accepted'
                   and ((requester = auth.uid() and addressee::text = folder)
                     or (addressee = auth.uid() and requester::text = folder)))
$$;

-- ---------- Delete account ----------
-- The app removes your photos first, then calls this. Everything else goes with the account.

create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid()
$$;

-- Only signed-in users can call these, except checking a username during sign up.
revoke execute on function public.new_friend_code(), public.handle_new_user(), public.is_blocked_between(uuid, uuid),
  public.are_friends(uuid, uuid), public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid), public.block_user(uuid), public.list_friends(), public.friend_catches(uuid),
  public.delete_my_account(), public.username_available(text), public.touch_updated_at(),
  public.can_view_photos(text) from public, anon, authenticated;
grant execute on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid), public.block_user(uuid), public.list_friends(), public.friend_catches(uuid),
  public.delete_my_account(), public.are_friends(uuid, uuid), public.can_view_photos(text) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- Photos ----------
-- A private bucket. Each person's photos live in a folder named after their account.
-- You can add, change and delete your own. Friends can only look.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

drop policy if exists "creeked photos read" on storage.objects;
create policy "creeked photos read" on storage.objects for select to authenticated using (
  bucket_id = 'photos' and public.can_view_photos((storage.foldername(name))[1]));
drop policy if exists "creeked photos add" on storage.objects;
create policy "creeked photos add" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "creeked photos change" on storage.objects;
create policy "creeked photos change" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "creeked photos delete" on storage.objects;
create policy "creeked photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
