import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

// site/publica-buscador.js no se puede importar directo (module.exports
// condicional, repo con "type":"module" — ver
// tests/ui/publica-buscador-pie.test.js para el mismo patrón). Estos tests
// verifican markup/wiring por texto, igual que el resto de tests/ui/ para
// este archivo.

test('nav rail: existen las 4 secciones (Buscador/Dashboard/Favoritas/Agente) y Agente está deshabilitada', async () => {
  const html = await read('site/publica-buscador.html');
  assert.match(html, /data-section="buscador"[^>]*aria-current="page"/);
  assert.match(html, /data-section="dashboard"/);
  assert.match(html, /data-section="favoritas"/);
  assert.match(html, /data-section="agente"[^>]*disabled/);
  assert.match(html, /Próximamente/);
});

test('nav rail: el botón de cerrar sesión sigue con el mismo id, ahora dentro de "Cuenta"', async () => {
  const html = await read('site/publica-buscador.html');
  const bloqueCuenta = html.slice(html.indexOf('class="rail-account"'), html.indexOf('</nav>'));
  assert.match(bloqueCuenta, /id="publicaLogoutButton"/);
  // Ya no está en el header.
  const bloqueHeader = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.doesNotMatch(bloqueHeader, /id="publicaLogoutButton"/);
});

test('nav rail: toggle de colapsar existe y aplica el estado guardado antes del primer paint', async () => {
  const html = await read('site/publica-buscador.html');
  assert.match(html, /id="railToggle"/);
  assert.match(html, /publica-rail-colapsado/);
  assert.match(html, /data-rail-colapsado/);
});

test('paneles: los 4 existen con data-panel correcto, y solo Buscador arranca visible', async () => {
  const html = await read('site/publica-buscador.html');
  for (const nombre of ['buscador', 'dashboard', 'favoritas', 'agente']) {
    assert.match(html, new RegExp(`data-panel="${nombre}"`));
  }
  const buscadorMatch = html.match(/id="panel-buscador"[^>]*>/);
  assert.ok(buscadorMatch, 'panel-buscador debe existir');
  assert.doesNotMatch(buscadorMatch[0], /hidden/);

  for (const id of ['panel-dashboard', 'panel-favoritas', 'panel-agente']) {
    const match = html.match(new RegExp(`id="${id}"[^>]*>`));
    assert.ok(match, `${id} debe existir`);
    assert.match(match[0], /hidden/, `${id} debe arrancar oculto`);
  }
});

test('Dashboard: #metricsSidebar sigue existiendo con el mismo id, reubicado dentro de panel-dashboard', async () => {
  const html = await read('site/publica-buscador.html');
  const bloqueDashboard = html.slice(html.indexOf('id="panel-dashboard"'), html.indexOf('</section>', html.indexOf('id="panel-dashboard"')));
  assert.match(bloqueDashboard, /id="metricsSidebar"/);
});

test('results-layout ya no reserva una segunda columna para metricsSidebar (se movió a Dashboard)', async () => {
  const css = await read('site/publica-buscador.css');
  const bloque = css.slice(css.indexOf('.results-layout {'), css.indexOf('}', css.indexOf('.results-layout {')));
  assert.match(bloque, /grid-template-columns:\s*1fr;/);
});

test('generarHtmlTarjeta: agrega el botón de favorito sin tocar el resto de la fila de encabezado', async () => {
  const js = await read('site/publica-buscador.js');
  assert.match(js, /favoritos = null\) \{/);
  assert.match(js, /class="btn-favorito/);
  assert.match(js, /\$\{botonFavoritoHtml\}/);
  // La fila de encabezado sigue teniendo título + urgencia-badge, con el
  // botón agregado, no reemplazando nada.
  assert.match(js, /card-header-row">\s*<h2 class="tender-title">/);
});

test('generarHtmlTarjetaFavorito: reutiliza las clases visuales existentes (mismo estilo, sin sistema nuevo)', async () => {
  const js = await read('site/publica-buscador.js');
  assert.match(js, /function generarHtmlTarjetaFavorito/);
  const inicio = js.indexOf('function generarHtmlTarjetaFavorito');
  const fin = js.indexOf('\n}', inicio) + 2;
  const cuerpo = js.slice(inicio, fin);
  assert.match(cuerpo, /class="tender-card"/);
  assert.match(cuerpo, /class="card-header-row"/);
  assert.match(cuerpo, /class="urgencia-badge/);
  assert.match(cuerpo, /class="btn-favorito is-active"/);
  assert.match(cuerpo, /class="btn-ver-detalle"/);
});

test('favoritas: se cargan/guardan contra /api/auth/publica/favorites, sin tocar buscador_perfil ni certificaciones', async () => {
  const js = await read('site/publica-buscador.js');
  assert.match(js, /\/api\/auth\/publica\/favorites/);
  assert.match(js, /cargarFavoritos\(\)/);
  assert.match(js, /guardarFavoritos\(\)/);
  assert.match(js, /alternarFavorito\(/);
});

test('activarSeccion: cambia panel visible y estado activo del rail, sin disparar una búsqueda', async () => {
  const js = await read('site/publica-buscador.js');
  const inicio = js.indexOf('activarSeccion(nombre) {');
  assert.ok(inicio !== -1, 'activarSeccion debe existir');
  const fin = js.indexOf('\n  }', inicio) + 4;
  const cuerpo = js.slice(inicio, fin);
  assert.match(cuerpo, /panel\.hidden = panel\.dataset\.panel !== nombre/);
  assert.doesNotMatch(cuerpo, /aplicarFiltrosYRenderizar|buscarLicitacionesBackend/);
});
