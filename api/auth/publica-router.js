// Único punto de entrada de Vercel para /api/auth/publica/* — ver el rewrite
// "/api/auth/publica/(.*)" -> "/api/auth/publica-router?path=$1" en
// vercel.json (mismo mecanismo probado que ya usa "/portal" -> "/api/portal").
//
// Por qué existe: el plan Hobby de Vercel limita a 12 funciones serverless
// por deployment. Con un archivo por endpoint (login, signup, logout,
// session, forgot-password, google/start, google/callback) el proyecto
// pasaba de 6 a 13 y el deploy fallaba (medido: "Build Failed" en ~4s
// uniformes en todos los commits de la rama, contra ~8s de un deploy que sí
// construye).
//
// Primer intento (revertido): una ruta dinámica de Vercel
// api/auth/publica/[...action].js, con el segmento de ruta en
// req.query.action. En producción, TODAS las rutas devolvían 404 propio
// (curl medido contra /login, /session, /google/start) — el enrutamiento
// dinámico por corchetes no se comportó como en Next.js para este proyecto
// sin framework. Se reemplaza por el patrón de rewrite explícito de
// vercel.json + un query param plano ("path"), que es el mismo mecanismo ya
// probado y funcionando para "/portal".
//
// La lógica de cada endpoint no se tocó: vive en
// api/auth/_lib/publica-handlers/ (bajo `_lib`, que Vercel no cuenta como
// función). Las URLs que ve el navegador no cambian.
import loginHandler from './_lib/publica-handlers/login.js';
import signupHandler from './_lib/publica-handlers/signup.js';
import logoutHandler from './_lib/publica-handlers/logout.js';
import sessionHandler from './_lib/publica-handlers/session.js';
import forgotPasswordHandler from './_lib/publica-handlers/forgot-password.js';
import googleStartHandler from './_lib/publica-handlers/google-start.js';
import googleCallbackHandler from './_lib/publica-handlers/google-callback.js';
import { sendJson } from './_lib/http.js';

export const config = { runtime: 'nodejs' };

const routes = {
  login: loginHandler,
  signup: signupHandler,
  logout: logoutHandler,
  session: sessionHandler,
  'forgot-password': forgotPasswordHandler,
  'google/start': googleStartHandler,
  'google/callback': googleCallbackHandler,
};

export default async function publicaAuthRouter(req, res) {
  const path = String(req.query?.path || '').replace(/\/+$/, '');
  // Object.hasOwn y no `routes[path]` a secas: `routes` es un objeto literal,
  // asi que hereda de Object.prototype y una busqueda por indice resuelve sus
  // miembros. `routes['constructor']` devolvia la funcion Object -- verdadera,
  // asi que pasaba el chequeo de handler y se invocaba como si fuera uno.
  //
  // Medido en produccion el 2026-09-08, sin autenticacion de por medio:
  //   /api/auth/publica/constructor    -> sin respuesta, corta a los 25 s
  //   /api/auth/publica/toString       -> sin respuesta, corta a los 25 s
  //   /api/auth/publica/__proto__      -> 500
  //   /api/auth/publica/hasOwnProperty -> 500
  // Los dos primeros son el problema real: Object(req, res) no escribe nada en
  // la respuesta, asi que la invocacion queda colgada hasta el timeout de la
  // plataforma. Anonimo, repetible y sin limite de tasa = consumo de
  // funcion-segundos a pedido, en un proyecto que ya choco una vez con los
  // limites del plan.
  const handler = Object.hasOwn(routes, path) ? routes[path] : null;
  if (typeof handler !== 'function') {
    return sendJson(res, 404, { error: 'No encontrado.' });
  }
  return handler(req, res);
}
