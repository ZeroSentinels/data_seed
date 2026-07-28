import {
  getMemberships,
  getProfile,
  getUser,
} from './supabase.js';

export class AuthorizationError extends Error {
  constructor(message, { status = 403, code = 'forbidden' } = {}) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
    this.code = code;
  }
}

const defaultProvider = { getUser, getProfile, getMemberships };

export async function resolveIdentity(accessToken, {
  provider = defaultProvider,
  providerOptions,
} = {}) {
  if (!accessToken) {
    throw new AuthorizationError('Authentication required', {
      status: 401,
      code: 'authentication_required',
    });
  }

  const user = await provider.getUser(accessToken, providerOptions);
  if (!user?.id) {
    throw new AuthorizationError('Invalid authenticated user', {
      status: 401,
      code: 'invalid_session',
    });
  }
  if (!user.email_confirmed_at) {
    throw new AuthorizationError('Email confirmation required', {
      status: 403,
      code: 'email_unconfirmed',
    });
  }

  const [profile, memberships] = await Promise.all([
    provider.getProfile(accessToken, user.id, providerOptions),
    provider.getMemberships(accessToken, user.id, providerOptions),
  ]);

  if (!profile || profile.id !== user.id || profile.is_active !== true) {
    throw new AuthorizationError('Account is inactive', {
      status: 403,
      code: 'account_inactive',
    });
  }

  if (!Array.isArray(memberships) || memberships.length === 0) {
    throw new AuthorizationError('Organization membership required', {
      status: 403,
      code: 'membership_required',
    });
  }
  if (memberships.length !== 1) {
    throw new AuthorizationError('Exactly one active organization is required in V1', {
      status: 409,
      code: 'membership_ambiguous',
    });
  }

  const membership = memberships[0];
  const organization = membership?.organizations;
  if (
    !membership?.organization_id ||
    membership.is_active !== true ||
    !organization?.id ||
    organization.is_active !== true ||
    organization.id !== membership.organization_id
  ) {
    throw new AuthorizationError('Invalid organization membership', {
      status: 403,
      code: 'invalid_membership',
    });
  }

  return Object.freeze({
    user: Object.freeze({ id: user.id, email: user.email || '' }),
    profile: Object.freeze({
      id: profile.id,
      email: profile.email || user.email || '',
      full_name: profile.full_name || '',
      role: profile.role || 'client',
    }),
    membership: Object.freeze({ role: membership.role || 'viewer' }),
    organization: Object.freeze({
      id: organization.id,
      name: organization.name || 'Organización',
      type: organization.type || 'client',
      plan: organization.plan || 'free',
    }),
  });
}

export function assertOrganizationAccess(identity, resourceOrganizationId) {
  if (!identity?.organization?.id || identity.organization.id !== resourceOrganizationId) {
    throw new AuthorizationError('Cross-tenant access denied', {
      status: 403,
      code: 'cross_tenant_denied',
    });
  }
}
