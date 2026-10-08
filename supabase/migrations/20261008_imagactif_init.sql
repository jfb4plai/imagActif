-- ImagActif : tables, droits, RLS, stockage, fonctions de quota.
-- À exécuter à la main dans le SQL Editor du projet partagé (région Europe). Idempotent.
-- Tables préfixées img_. Ne pas recréer profiles ni le trigger updated_at.

begin;

create table if not exists img_accounts (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  terms_version    text not null,
  terms_accepted_at timestamptz not null default now(),
  has_own_key      boolean not null default false
);

create table if not exists img_generations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  json             jsonb not null,
  prompt_text      text not null,
  seed             bigint not null,
  model            text not null,
  key_mode         text not null check (key_mode in ('trial', 'own')),
  status           text not null default 'pending' check (status in ('pending', 'done', 'failed', 'refused')),
  quota_day        date,
  image_path       text,
  image_expires_at timestamptz,
  image_deleted_at timestamptz,
  parent_id        uuid references img_generations(id) on delete set null,
  created_at       timestamptz not null default now()
);
create unique index if not exists img_generations_one_pending on img_generations (user_id) where status = 'pending';
create index if not exists img_generations_user_created on img_generations (user_id, created_at desc);
create index if not exists img_generations_expiry on img_generations (image_expires_at)
  where image_path is not null and image_deleted_at is null;

create table if not exists img_jobs (
  generation_id uuid primary key references img_generations(id) on delete cascade,
  polling_url   text not null,
  created_at    timestamptz not null default now()
);

create table if not exists img_templates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  json          jsonb not null,
  locked_fields text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists img_templates_user on img_templates (user_id, created_at desc);

create table if not exists img_user_keys (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  ciphertext     text not null,
  iv             text not null,
  secret_version text not null,
  created_at     timestamptz not null default now()
);

create table if not exists img_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

-- ── RLS ──
alter table img_accounts    enable row level security;
alter table img_generations enable row level security;
alter table img_jobs        enable row level security;
alter table img_templates   enable row level security;
alter table img_user_keys   enable row level security;
alter table img_usage       enable row level security;

drop policy if exists img_accounts_select on img_accounts;
create policy img_accounts_select on img_accounts for select to authenticated using (auth.uid() = user_id);

drop policy if exists img_generations_select on img_generations;
create policy img_generations_select on img_generations for select to authenticated using (auth.uid() = user_id);

drop policy if exists img_templates_select on img_templates;
drop policy if exists img_templates_insert on img_templates;
drop policy if exists img_templates_update on img_templates;
drop policy if exists img_templates_delete on img_templates;
create policy img_templates_select on img_templates for select to authenticated using (auth.uid() = user_id);
create policy img_templates_insert on img_templates for insert to authenticated with check (auth.uid() = user_id);
create policy img_templates_update on img_templates for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy img_templates_delete on img_templates for delete to authenticated using (auth.uid() = user_id);

drop policy if exists img_usage_select on img_usage;
create policy img_usage_select on img_usage for select to authenticated using (auth.uid() = user_id);

-- img_jobs et img_user_keys : RLS active, aucune politique, aucun droit client.

-- ── Droits (Data API) ──
revoke all on table img_accounts, img_generations, img_jobs, img_templates, img_user_keys, img_usage from public, anon, authenticated;

grant select on img_accounts to authenticated;
grant select on img_generations to authenticated;
grant select, insert, update, delete on img_templates to authenticated;
grant select on img_usage to authenticated;

grant select, insert, update, delete on img_accounts, img_generations, img_jobs, img_templates, img_user_keys, img_usage to service_role;

-- ── Stockage : bucket privé, lecture de ses propres fichiers uniquement ──
insert into storage.buckets (id, name, public) values ('img-generations', 'img-generations', false)
  on conflict (id) do nothing;

drop policy if exists img_select_own_files on storage.objects;
create policy img_select_own_files on storage.objects for select to authenticated
  using (bucket_id = 'img-generations' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Quota : réservation atomique (essai) ──
create or replace function img_reserve_quota(p_user uuid, p_day date, p_user_limit integer, p_global_limit integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_global integer;
  v_user   integer;
begin
  perform pg_advisory_xact_lock(hashtext('img_quota_' || p_day::text));
  select coalesce(sum(count), 0) into v_global from img_usage where day = p_day;
  if v_global >= p_global_limit then return 'global_limit'; end if;
  v_user := coalesce((select count from img_usage where user_id = p_user and day = p_day), 0);
  if v_user >= p_user_limit then return 'user_limit'; end if;
  insert into img_usage (user_id, day, count) values (p_user, p_day, 1)
    on conflict (user_id, day) do update set count = img_usage.count + 1;
  return 'ok';
end $$;

create or replace function img_refund_quota(p_user uuid, p_day date)
returns void language sql security definer set search_path = public as $$
  update img_usage set count = greatest(count - 1, 0) where user_id = p_user and day = p_day;
$$;

revoke all on function img_reserve_quota(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function img_refund_quota(uuid, date) from public, anon, authenticated;
grant execute on function img_reserve_quota(uuid, date, integer, integer) to service_role;
grant execute on function img_refund_quota(uuid, date) to service_role;

commit;
