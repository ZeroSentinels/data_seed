// Diagnóstico de autenticación: deja rastro en el log del servidor sin cambiar
// la respuesta que ve el navegador. Los mensajes al cliente siguen siendo
// genéricos a propósito (no enumerar cuentas); el operador necesita el código.
//
// Nunca registra tokens, contraseñas ni correos. Eso se garantiza por
// construcción, no por convención: de `extra` solo sobreviven números y
// booleanos, que no pueden transportar un correo ni un token. Etapa, nombre,
// código y estado se derivan del error y no son sobrescribibles — una versión
// previa permitía `extra.name` y con eso un correo entraba al log.

const RESERVED_KEYS = new Set(['event', 'stage', 'name', 'code', 'status']);

export function logAuthFailure(stage, error, extra = {}) {
  const record = {
    event: 'auth_failure',
    stage: typeof stage === 'string' ? stage : 'unknown',
    name: error?.name || 'Error',
    code: error?.code || 'unknown',
    status: Number.isInteger(error?.status) ? error.status : null,
  };
  for (const [key, value] of Object.entries(extra)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) record[key] = value;
    else if (typeof value === 'boolean') record[key] = value;
  }
  try {
    console.error(JSON.stringify(record));
  } catch {
    // El log no debe romper el flujo de autenticación.
  }
}
