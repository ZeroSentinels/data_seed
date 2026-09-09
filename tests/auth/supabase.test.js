import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SupabaseRequestError,
  getMemberships,
  getOrganizationSettings,
  getProfile,
  getUser,
  provisionSelfServeOrg,
  refreshSession,
  savePublicaSearchProfile,
  sendPasswordRecovery,
  signInWithPassword,
  signOut,
} from '../../api/auth/_lib/supabase.js';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test_key',
};

function fakeFetchQueue(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected fetch');
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

test('signInWithPassword calls Supabase Auth without exposing a service key', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([{
    body: { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } },
  }]);

  const session = await signInWithPassword({ email: 'user@example.com', password: 'secret' }, { env, fetchImpl });

  assert.equal(session.access_token, 'a');
  assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_test_key');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'user@example.com', password: 'secret' });
});

test('Supabase errors are represented by a typed request error', async () => {
  const { fetchImpl } = fakeFetchQueue([{ status: 400, body: { error_description: 'Invalid login credentials' } }]);
  await assert.rejects(
    signInWithPassword({ email: 'user@example.com', password: 'wrong' }, { env, fetchImpl }),
    (error) => error instanceof SupabaseRequestError && error.status === 400,
  );
});

test('refreshSession exchanges only the HttpOnly refresh token', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([{ body: { access_token: 'new-a', refresh_token: 'new-r', expires_in: 3600 } }]);
  await refreshSession('refresh-token', { env, fetchImpl });
  assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(JSON.parse(calls[0].options.body), { refresh_token: 'refresh-token' });
});

test('getUser validates the access token with Supabase Auth', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([{ body: { id: 'u1', email: 'user@example.com' } }]);
  const user = await getUser('access-token', { env, fetchImpl });
  assert.equal(user.id, 'u1');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-token');
  assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/user');
});

test('profile and memberships are queried using the authenticated user JWT', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([
    { body: [{ id: 'u1', email: 'user@example.com', full_name: 'User', role: 'client', is_active: true }] },
    { body: [{ organization_id: 'org-a', role: 'member', is_active: true, organizations: { id: 'org-a', name: 'Tenant A', type: 'client', plan: 'pro', is_active: true } }] },
  ]);

  const profile = await getProfile('access-token', 'u1', { env, fetchImpl });
  const memberships = await getMemberships('access-token', 'u1', { env, fetchImpl });

  assert.equal(profile.id, 'u1');
  assert.equal(memberships[0].organization_id, 'org-a');
  assert.match(calls[0].url, /\/rest\/v1\/profiles\?/);
  assert.match(calls[0].url, /id=eq\.u1/);
  assert.match(calls[1].url, /\/rest\/v1\/user_organizations\?/);
  assert.match(calls[1].url, /is_active=eq\.true/);
  assert.match(decodeURIComponent(calls[1].url), /organizations\(id,name,type,plan,is_active\)/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');
});

test('provisionSelfServeOrg calls the security-definer RPC with the user JWT, never a service key', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([
    { body: [{ organization_id: 'org-a', organization_name: 'Empresa Nueva', created: true }] },
  ]);
  const result = await provisionSelfServeOrg('access-token', 'Empresa Nueva', { env, fetchImpl });
  assert.equal(result.organization_id, 'org-a');
  assert.equal(result.created, true);
  assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/provision_self_serve_org');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-token');
  assert.equal(calls[0].options.headers.apikey, env.SUPABASE_ANON_KEY);
  assert.deepEqual(JSON.parse(calls[0].options.body), { org_name: 'Empresa Nueva' });
});

test('getOrganizationSettings reads the row scoped to the organization, with the user JWT', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([
    { body: [{ settings: { buscador_perfil: { region: 'Metropolitana', monto: '', soloAbiertas: true } } }] },
  ]);
  const row = await getOrganizationSettings('access-token', 'org-a', { env, fetchImpl });
  assert.equal(row.settings.buscador_perfil.region, 'Metropolitana');
  assert.match(calls[0].url, /\/rest\/v1\/organization_settings\?/);
  assert.match(calls[0].url, /organization_id=eq\.org-a/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-token');
});

test('getOrganizationSettings returns null when the organization has no row yet', async () => {
  const { fetchImpl } = fakeFetchQueue([{ body: [] }]);
  const row = await getOrganizationSettings('access-token', 'org-a', { env, fetchImpl });
  assert.equal(row, null);
});

test('savePublicaSearchProfile calls the security-definer RPC with the user JWT, never a service key', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([{ body: null }]);
  await savePublicaSearchProfile('access-token', { region: 'Metropolitana' }, { env, fetchImpl });
  assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/save_publica_search_profile');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-token');
  assert.equal(calls[0].options.headers.apikey, env.SUPABASE_ANON_KEY);
  assert.deepEqual(JSON.parse(calls[0].options.body), { perfil: { region: 'Metropolitana' } });
});

test('password recovery and logout use provider endpoints', async () => {
  const { calls, fetchImpl } = fakeFetchQueue([{ body: {} }, { body: {} }]);
  await sendPasswordRecovery('user@example.com', 'https://dataseed.cl/site/login.html', { env, fetchImpl });
  await signOut('access-token', { env, fetchImpl });
  assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/recover');
  assert.equal(calls[1].url, 'https://project.supabase.co/auth/v1/logout');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');
});
