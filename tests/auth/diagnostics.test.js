import test from 'node:test';
import assert from 'node:assert/strict';

import { logAuthFailure } from '../../api/auth/_lib/diagnostics.js';
import { AuthorizationError } from '../../api/auth/_lib/authorization.js';
import { SupabaseRequestError } from '../../api/auth/_lib/supabase.js';

// Captura lo que el módulo escribe en el log sin dejar que ensucie la salida
// de la suite. Devuelve los registros ya parseados.
function capture(run) {
  const original = console.error;
  const lines = [];
  console.error = (line) => lines.push(line);
  try {
    run();
  } finally {
    console.error = original;
  }
  return lines.map((line) => JSON.parse(line));
}

test('el diagnóstico registra etapa, nombre, código y estado del error', () => {
  const [record] = capture(() => {
    logAuthFailure(
      'resolve_identity',
      new AuthorizationError('Organization membership required', {
        status: 403,
        code: 'membership_required',
      }),
    );
  });

  assert.equal(record.event, 'auth_failure');
  assert.equal(record.stage, 'resolve_identity');
  assert.equal(record.name, 'AuthorizationError');
  assert.equal(record.code, 'membership_required');
  assert.equal(record.status, 403);
});

test('distingue las etapas que el operador necesita separar al dar de alta una cuenta', () => {
  const records = capture(() => {
    logAuthFailure('sign_in', new SupabaseRequestError('bad creds', { status: 400, code: 'invalid_credentials' }));
    logAuthFailure('resolve_identity', new AuthorizationError('inactive', { status: 403, code: 'account_inactive' }));
    logAuthFailure('resolve_identity', new SupabaseRequestError('no relation', { status: 404, code: '42P01' }));
  });

  assert.deepEqual(
    records.map((r) => `${r.stage}:${r.code}`),
    ['sign_in:invalid_credentials', 'resolve_identity:account_inactive', 'resolve_identity:42P01'],
  );
});

test('ningún dato personal de `extra` llega al log', () => {
  // Regresión real: una versión previa permitía `extra.name` como string
  // arbitrario y con eso un correo entraba al log pese a que el encabezado del
  // archivo prometía lo contrario.
  const [record] = capture(() => {
    logAuthFailure('sign_in', new Error('x'), {
      email: 'daniel@dataseed.cl',
      password: 'hunter2',
      access_token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
      refresh_token: 'v1.MRj...',
      name: 'daniel@dataseed.cl',
      code: 'token=eyJhbGciOi',
      status: 'daniel@dataseed.cl',
      stage: 'daniel@dataseed.cl',
      event: 'daniel@dataseed.cl',
    });
  });

  const serialized = JSON.stringify(record);
  assert.doesNotMatch(serialized, /dataseed\.cl/);
  assert.doesNotMatch(serialized, /hunter2/);
  assert.doesNotMatch(serialized, /eyJhbGciOi/);
  assert.doesNotMatch(serialized, /MRj/);
  // Los campos derivados del error no son sobrescribibles desde `extra`.
  assert.equal(record.event, 'auth_failure');
  assert.equal(record.stage, 'sign_in');
  assert.equal(record.name, 'Error');
  assert.equal(record.code, 'unknown');
  assert.equal(record.status, null);
});

test('solo sobrevive el contexto numérico y booleano, que no puede transportar PII', () => {
  const [record] = capture(() => {
    logAuthFailure('logout_revoke', new Error('x'), {
      intentos: 3,
      expired: true,
      providerFailed: false,
      latencia_ms: 812,
      nota: 'texto libre que no debe pasar',
      nan: Number.NaN,
      infinito: Number.POSITIVE_INFINITY,
    });
  });

  assert.equal(record.intentos, 3);
  assert.equal(record.expired, true);
  assert.equal(record.providerFailed, false);
  assert.equal(record.latencia_ms, 812);
  assert.equal('nota' in record, false);
  assert.equal('nan' in record, false, 'NaN no es serializable de forma útil');
  assert.equal('infinito' in record, false, 'Infinity se serializa como null en JSON');
});

test('el log nunca rompe el flujo de autenticación', () => {
  // Se invoca desde dentro de un catch: si lanza, el endpoint devuelve 500 en
  // vez del 401/403 previsto. Debe tragarse cualquier entrada malformada.
  const casos = [
    ['extra nulo', () => logAuthFailure('sign_in', new Error('x'), null)],
    ['extra primitivo', () => logAuthFailure('sign_in', new Error('x'), 42)],
    ['getter que lanza', () => logAuthFailure('sign_in', new Error('x'), {
      get intentos() { throw new Error('getter roto'); },
    })],
    ['error nulo', () => logAuthFailure('sign_in', null)],
    ['etapa no string', () => logAuthFailure(null, new Error('x'))],
    ['sin argumentos', () => logAuthFailure()],
  ];

  for (const [nombre, ejecutar] of casos) {
    const original = console.error;
    console.error = () => {};
    try {
      assert.doesNotThrow(ejecutar, `logAuthFailure lanzó con ${nombre}`);
    } finally {
      console.error = original;
    }
  }
});

test('una etapa no string queda etiquetada como desconocida en vez de perderse', () => {
  const [record] = capture(() => logAuthFailure(null, new Error('x')));
  assert.equal(record.stage, 'unknown');
});
