const DEFAULT_TIMEOUT_MS = 10_000;

export class SupabaseRequestError extends Error {
  constructor(message, { status = 500, code = 'supabase_error' } = {}) {
    super(message);
    this.name = 'SupabaseRequestError';
    this.status = status;
    this.code = code;
  }
}

function getConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = String(env.SUPABASE_ANON_KEY || '');
  if (!url.startsWith('https://') || !anonKey) {
    throw new SupabaseRequestError('Supabase is not configured', {
      status: 503,
      code: 'missing_config',
    });
  }
  return { url, anonKey };
}

async function request(path, {
  method = 'GET',
  body,
  accessToken,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const { url, anonKey } = getConfig(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    apikey: anonKey,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const response = await fetchImpl(`${url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new SupabaseRequestError('Invalid Supabase response', {
          status: 502,
          code: 'invalid_response',
        });
      }
    }
    if (!response.ok) {
      throw new SupabaseRequestError(
        data.error_description || data.msg || data.message || 'Supabase request failed',
        {
          status: response.status,
          code: data.error_code || data.code || 'supabase_error',
        },
      );
    }
    return data;
  } catch (error) {
    if (error instanceof SupabaseRequestError) throw error;
    if (error?.name === 'AbortError') {
      throw new SupabaseRequestError('Supabase request timed out', {
        status: 504,
        code: 'timeout',
      });
    }
    throw new SupabaseRequestError('Supabase is unavailable', {
      status: 502,
      code: 'network_error',
    });
  } finally {
    clearTimeout(timer);
  }
}

export function signInWithPassword(credentials, options = {}) {
  return request('/auth/v1/token?grant_type=password', {
    ...options,
    method: 'POST',
    body: credentials,
  });
}

export function refreshSession(refreshToken, options = {}) {
  return request('/auth/v1/token?grant_type=refresh_token', {
    ...options,
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}

export function getUser(accessToken, options = {}) {
  return request('/auth/v1/user', {
    ...options,
    accessToken,
  });
}

export async function getProfile(accessToken, userId, options = {}) {
  const params = new URLSearchParams({
    select: 'id,email,full_name,role,is_active',
    id: `eq.${userId}`,
    limit: '1',
  });
  const rows = await request(`/rest/v1/profiles?${params}`, {
    ...options,
    accessToken,
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

export function getMemberships(accessToken, userId, options = {}) {
  const params = new URLSearchParams({
    select: 'organization_id,role,is_active,organizations(id,name,type,plan,is_active)',
    user_id: `eq.${userId}`,
    is_active: 'eq.true',
  });
  return request(`/rest/v1/user_organizations?${params}`, {
    ...options,
    accessToken,
  });
}

export function sendPasswordRecovery(email, redirectTo, options = {}) {
  return request('/auth/v1/recover', {
    ...options,
    method: 'POST',
    body: { email, redirect_to: redirectTo },
  });
}

export function signOut(accessToken, options = {}) {
  return request('/auth/v1/logout', {
    ...options,
    method: 'POST',
    accessToken,
  });
}
