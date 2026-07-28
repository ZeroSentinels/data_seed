import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/20260723_secure_multitenant_auth.sql', import.meta.url);

async function sql() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase().replace(/\s+/g, ' ');
}

const tenantTables = [
  'organizations',
  'user_organizations',
  'reports',
  'agents',
  'conversations',
  'files',
  'connectors',
  'organization_settings',
];

const resourceTables = [
  'reports',
  'agents',
  'conversations',
  'files',
  'connectors',
  'organization_settings',
];

test('migration creates the complete tenant boundary and active memberships', async () => {
  const source = await sql();
  assert.match(source, /create table if not exists public\.profiles/);
  assert.match(source, /create table if not exists public\.organizations/);
  assert.match(source, /create table if not exists public\.user_organizations/);
  assert.match(source, /alter table public\.user_organizations add column if not exists is_active boolean/);
  for (const table of resourceTables) {
    assert.match(source, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(source, new RegExp(`organization_id uuid not null references public\\.organizations`));
  }
});

test('every tenant table enables and forces RLS', async () => {
  const source = await sql();
  for (const table of ['profiles', ...tenantTables]) {
    assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(source, new RegExp(`alter table public\\.${table} force row level security`));
  }
});

test('resource reads are scoped to authenticated organization membership', async () => {
  const source = await sql();
  assert.match(source, /create or replace function public\.is_org_member\(org_id uuid\)/);
  assert.match(source, /uo\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(source, /uo\.is_active = true/);
  for (const table of resourceTables) {
    assert.match(
      source,
      new RegExp(`create policy "${table}_select_members" on public\\.${table} for select to authenticated using \\(public\\.is_org_member\\(organization_id\\)\\)`),
    );
  }
});

test('authenticated users cannot self-promote, move tenants or forge audit records', async () => {
  const source = await sql();
  assert.match(source, /revoke update on public\.profiles from authenticated/);
  assert.match(source, /grant update \(full_name, avatar_url\) on public\.profiles to authenticated/);
  assert.match(source, /revoke insert, update, delete on public\.user_organizations from authenticated/);
  assert.match(source, /drop policy if exists "audit_log_insert_system" on public\.audit_log/);
  assert.match(source, /revoke all on public\.audit_log from authenticated/);
  assert.doesNotMatch(source, /on public\.audit_log for insert to authenticated/);
  assert.doesNotMatch(source, /on public\.user_organizations for all to authenticated/);
  assert.doesNotMatch(source, /with check \(true\)/);
});

test('onboarding is invite-only and does not create a client-controlled organization', async () => {
  const source = await sql();
  assert.match(source, /insert into public\.profiles \(id, email, full_name, is_active\)/);
  assert.match(source, /values \([^;]*false\s*\)/);
  assert.doesNotMatch(source, /personal/);
  assert.doesNotMatch(source, /insert into public\.user_organizations[\s\S]*new\.id/);
});
