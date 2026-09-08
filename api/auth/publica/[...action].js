// Único punto de entrada de Vercel para /api/auth/publica/*.
//
// Por qué un solo archivo: el plan Hobby de Vercel limita a 12 funciones
// serverless por deployment. Con un archivo por endpoint (login, signup,
// logout, session, forgot-password, google/start, google/callback) el
// proyecto pasaba de 6 a 13 y el deploy fallaba (medido: "Build Failed" en
// ~4s en todos los commits de la rama, uniforme, contra ~8s de un deploy
// que sí construye). La lógica de cada endpoint no se tocó: solo se movió a
// api/auth/_lib/publica-handlers/ (bajo `_lib`, que Vercel no cuenta como
// función) y este archivo la despacha según el segmento de ruta. Las URLs
// que ve el navegador no cambian.
import loginHandler from '../_lib/publica-handlers/login.js';
import signupHandler from '../_lib/publica-handlers/signup.js';
import logoutHandler from '../_lib/publica-handlers/logout.js';
import sessionHandler from '../_lib/publica-handlers/session.js';
import forgotPasswordHandler from '../_lib/publica-handlers/forgot-password.js';
import googleStartHandler from '../_lib/publica-handlers/google-start.js';
import googleCallbackHandler from '../_lib/publica-handlers/google-callback.js';
import { sendJson } from '../_lib/http.js';

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

export default async function publicaAuthDispatcher(req, res) {
  const segments = req.query?.action;
  const path = Array.isArray(segments) ? segments.join('/') : String(segments || '');
  const handler = routes[path];
  if (!handler) {
    return sendJson(res, 404, { error: 'No encontrado.' });
  }
  return handler(req, res);
}
