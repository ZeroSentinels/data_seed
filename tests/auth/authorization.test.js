import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AuthorizationError,
  assertOrganizationAccess,
  resolveIdentity,
} from '../../api/auth/_lib/authorization.js';

function provider({ active = true, memberships = [], confirmed = true } = {}) {
  return {
    getUser: async () => ({
      id: 'user-1',
      email: 'client@example.com',
      email_confirmed_at: confirmed ? '2026-01-01T00:00:00Z' : null,
    }),
    getProfile: async () => ({
      id: 'user-1',
      email: 'client@example.com',
      full_name: 'Client User',
      role: 'client',
      is_active: active,
    }),
    getMemberships: async () => memberships,
  };
}

const membershipA = {
  organization_id: 'org-a',
  role: 'member',
  is_active: true,
  organizations: { id: 'org-a', name: 'Tenant A', type: 'client', plan: 'pro', is_active: true },
};

const membershipB = {
  organization_id: 'org-b',
  role: 'viewer',
  is_active: true,
  organizations: { id: 'org-b', name: 'Tenant B', type: 'client', plan: 'starter', is_active: true },
};

test('resolveIdentity derives the tenant from one backend membership', async () => {
  const identity = await resolveIdentity('access-token', {
    provider: provider({ memberships: [membershipA] }),
  });

  assert.equal(identity.user.id, 'user-1');
  assert.equal(identity.organization.id, 'org-a');
  assert.equal(identity.membership.role, 'member');
  assert.equal(identity.profile.full_name, 'Client User');
});

test('resolveIdentity denies users without an active membership', async () => {
  await assert.rejects(
    resolveIdentity('access-token', { provider: provider({ memberships: [] }) }),
    (error) => error instanceof AuthorizationError && error.code === 'membership_required' && error.status === 403,
  );
});

test('resolveIdentity fails closed when a user has multiple memberships in V1', async () => {
  await assert.rejects(
    resolveIdentity('access-token', { provider: provider({ memberships: [membershipA, membershipB] }) }),
    (error) => error instanceof AuthorizationError && error.code === 'membership_ambiguous' && error.status === 409,
  );
});

test('resolveIdentity denies inactive or unconfirmed users', async () => {
  await assert.rejects(
    resolveIdentity('access-token', { provider: provider({ active: false, memberships: [membershipA] }) }),
    (error) => error instanceof AuthorizationError && error.code === 'account_inactive',
  );
  await assert.rejects(
    resolveIdentity('access-token', { provider: provider({ confirmed: false, memberships: [membershipA] }) }),
    (error) => error instanceof AuthorizationError && error.code === 'email_unconfirmed',
  );
});

test('resolveIdentity rejects malformed cross-tenant membership data', async () => {
  const malformed = { ...membershipA, organizations: { ...membershipA.organizations, id: 'org-b' } };
  await assert.rejects(
    resolveIdentity('access-token', { provider: provider({ memberships: [malformed] }) }),
    (error) => error instanceof AuthorizationError && error.code === 'invalid_membership',
  );
});

test('resolveIdentity rejects inactive memberships', async () => {
  const inactive = { ...membershipA, is_active: false };
  await assert.rejects(
    resolveIdentity('access-token', { provider: provider({ memberships: [inactive] }) }),
    (error) => error instanceof AuthorizationError && error.code === 'invalid_membership',
  );
});

test('resolveIdentity rejects inactive organizations', async () => {
  const inactiveOrganization = {
    ...membershipA,
    organizations: { ...membershipA.organizations, is_active: false },
  };
  await assert.rejects(
    resolveIdentity('access-token', { provider: provider({ memberships: [inactiveOrganization] }) }),
    (error) => error instanceof AuthorizationError && error.code === 'invalid_membership',
  );
});

test('assertOrganizationAccess rejects resources belonging to another tenant', () => {
  const identity = { organization: { id: 'org-a' } };
  assert.doesNotThrow(() => assertOrganizationAccess(identity, 'org-a'));
  assert.throws(
    () => assertOrganizationAccess(identity, 'org-b'),
    (error) => error instanceof AuthorizationError && error.code === 'cross_tenant_denied' && error.status === 403,
  );
});
