// Aprovisiona la organización de un usuario nuevo de Pública (signup
// self-serve por email/password o primer login con Google).
//
// Regla de negocio confirmada (2026-09-06): si el usuario no tiene ninguna
// organización activa, se le crea una propia automáticamente con plan
// 'free', y queda como 'admin' de esa organización. No se inventa ninguna
// otra regla más allá de esta.
//
// Decisión de seguridad (2026-09-08, ver docs/security/service-role-key-decision.md):
// esto NO usa SUPABASE_SERVICE_ROLE_KEY. Llama a una función `security definer`
// en la base (supabase/migrations/20260908_publica_self_serve_provisioning.sql)
// con la clave anon + el access_token del propio usuario recién autenticado.
// El bypass de RLS necesario para crear la organización vive dentro de esa
// función, acotado a esa única operación — no en el runtime de Node.
import { provisionSelfServeOrg, SupabaseRequestError } from './supabase.js';

export class ProvisioningError extends Error {
  constructor(message, { status = 500, code = 'provisioning_error' } = {}) {
    super(message);
    this.name = 'ProvisioningError';
    this.status = status;
    this.code = code;
  }
}

// Idempotente: si el usuario ya tiene una organización activa, la función de
// base de datos la devuelve tal cual y no crea nada nuevo.
export async function ensureOrganizationForUser({ accessToken, empresa } = {}, { env = process.env } = {}) {
  if (!accessToken) {
    throw new ProvisioningError('accessToken es requerido', { status: 400, code: 'invalid_input' });
  }

  let row;
  try {
    row = await provisionSelfServeOrg(accessToken, empresa || null, { env });
  } catch (error) {
    if (error instanceof SupabaseRequestError) {
      throw new ProvisioningError(error.message, { status: error.status, code: error.code });
    }
    throw new ProvisioningError('Supabase is unavailable', { status: 502, code: 'network_error' });
  }

  if (!row?.organization_id) {
    throw new ProvisioningError('No se pudo crear la organización', {
      status: 502,
      code: 'organization_create_failed',
    });
  }

  return { created: Boolean(row.created), organizationId: row.organization_id };
}
