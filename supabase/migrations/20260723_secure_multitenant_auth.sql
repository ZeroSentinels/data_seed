-- DataSeed Portal — autenticación y aislamiento multi-tenant seguro
-- Aplicar con un rol propietario en Supabase antes de activar el portal.
-- V1 es invite-only: las cuentas nuevas quedan inactivas hasta que un administrador
-- las asocia a exactamente una organización mediante un canal de servicio seguro.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'client' check (role in ('admin', 'team', 'client')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'client' check (type in ('internal', 'client', 'partner')),
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'enterprise')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_organizations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'member', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

-- Upgrade seguro si una versión histórica de las tablas ya existe.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_active boolean not null default false;
alter table public.organizations add column if not exists is_active boolean not null default true;
alter table public.user_organizations add column if not exists is_active boolean not null default true;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  summary text,
  report_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'archived')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid,
  title text,
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (agent_id, organization_id)
    references public.agents(id, organization_id) on delete set null
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid,
  name text not null,
  storage_path text not null,
  media_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, organization_id)
    references public.conversations(id, organization_id) on delete set null
);

create table if not exists public.connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider text not null,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'error')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_user_org_user_active on public.user_organizations(user_id, is_active);
create index if not exists idx_user_org_org_active on public.user_organizations(organization_id, is_active);
create index if not exists idx_reports_org on public.reports(organization_id);
create index if not exists idx_agents_org on public.agents(organization_id);
create index if not exists idx_conversations_org on public.conversations(organization_id);
create index if not exists idx_files_org on public.files(organization_id);
create index if not exists idx_connectors_org on public.connectors(organization_id);
create index if not exists idx_audit_org_created on public.audit_log(organization_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, is_active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.user_organizations uo
    join public.profiles p on p.id = uo.user_id
    join public.organizations o on o.id = uo.organization_id
    where uo.organization_id = org_id
      and uo.user_id = (select auth.uid())
      and uo.is_active = true
      and p.is_active = true
      and o.is_active = true
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

-- Elimina policies históricas inseguras antes de establecer el contrato V1.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "organizations_select_members" on public.organizations;
drop policy if exists "organizations_admin_all" on public.organizations;
drop policy if exists "organizations_update_owner" on public.organizations;
drop policy if exists "user_org_select_own_or_admin" on public.user_organizations;
drop policy if exists "user_org_admin_all" on public.user_organizations;
drop policy if exists "user_org_manage_by_owner" on public.user_organizations;
drop policy if exists "reports_select_org_members" on public.reports;
drop policy if exists "reports_admin_all" on public.reports;
drop policy if exists "reports_insert_members" on public.reports;
drop policy if exists "reports_update_creator_or_admin" on public.reports;
drop policy if exists "reports_delete_creator_or_admin" on public.reports;
drop policy if exists "audit_log_select_admin" on public.audit_log;
drop policy if exists "audit_log_select_own" on public.audit_log;
drop policy if exists "audit_log_insert_system" on public.audit_log;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.user_organizations enable row level security;
alter table public.user_organizations force row level security;
alter table public.reports enable row level security;
alter table public.reports force row level security;
alter table public.agents enable row level security;
alter table public.agents force row level security;
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.files enable row level security;
alter table public.files force row level security;
alter table public.connectors enable row level security;
alter table public.connectors force row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_settings force row level security;
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and is_active = true);

create policy "profiles_update_safe_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and is_active = true)
  with check (id = (select auth.uid()) and is_active = true);

create policy "organizations_select_members" on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy "user_organizations_select_self" on public.user_organizations
  for select to authenticated
  using (user_id = (select auth.uid()) and is_active = true);

create policy "reports_select_members" on public.reports for select to authenticated using (public.is_org_member(organization_id));
create policy "agents_select_members" on public.agents for select to authenticated using (public.is_org_member(organization_id));
create policy "conversations_select_members" on public.conversations for select to authenticated using (public.is_org_member(organization_id));
create policy "files_select_members" on public.files for select to authenticated using (public.is_org_member(organization_id));
create policy "connectors_select_members" on public.connectors for select to authenticated using (public.is_org_member(organization_id));
create policy "organization_settings_select_members" on public.organization_settings for select to authenticated using (public.is_org_member(organization_id));

revoke all on public.profiles from anon, authenticated;
revoke all on public.organizations from anon, authenticated;
revoke all on public.user_organizations from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.agents from anon, authenticated;
revoke all on public.conversations from anon, authenticated;
revoke all on public.files from anon, authenticated;
revoke all on public.connectors from anon, authenticated;
revoke all on public.organization_settings from anon, authenticated;
revoke all on public.audit_log from anon;
revoke all on public.audit_log from authenticated;

-- Defensa por columna: RLS limita filas; los grants impiden cambiar rol/estado/tenant.
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant select on public.user_organizations to authenticated;
revoke insert, update, delete on public.user_organizations from authenticated;
grant select on public.reports, public.agents, public.conversations, public.files, public.connectors, public.organization_settings to authenticated;
revoke insert, update, delete on public.reports, public.agents, public.conversations, public.files, public.connectors, public.organization_settings from authenticated;

commit;
