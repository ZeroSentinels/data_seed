// PKCE para el login con Google de Pública, sin supabase-js: Node trae
// crypto nativo, no agrega dependencias. Ver api/auth/publica/google/start.js
// y api/auth/publica/google/callback.js.
import { randomBytes, createHash } from 'node:crypto';

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function generateCodeVerifier() {
  return base64url(randomBytes(32));
}

export function generateCodeChallenge(verifier) {
  return base64url(createHash('sha256').update(verifier).digest());
}
