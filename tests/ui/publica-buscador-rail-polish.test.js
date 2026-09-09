import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

// Tests del pulido visual del nav rail: altura completa del sidebar,
// Dashboard a ancho completo en grilla, y el acceso a Configuración. Mismo
// patrón de lectura-por-texto que tests/ui/publica-buscador-rail.test.js
// (el archivo no se puede importar directo, ver ese archivo).

test('pub-shell ya no fuerza min-height:0 (causaba que el rail se cortara antes de llegar al pie con resultados largos)', async () => {
  const css = await read('site/publica-buscador.css');
  const inicio = css.indexOf('.pub-shell {');
  const fin = css.indexOf('}', inicio);
  const bloque = css.slice(inicio, fin).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(bloque, /min-height:\s*0/);
});

test('Dashboard: el hook data-panel-activo saca el max-width de .pub-main solo para esa sección', async () => {
  const css = await read('site/publica-buscador.css');
  assert.match(css, /html\[data-panel-activo="dashboard"\]\s*\.pub-main\s*\{[^}]*max-width:\s*none/);
});

test('Dashboard: .sidebar-inner queda en grid dentro de la versión standalone (sin tocar renderizarMetricasLateral)', async () => {
  const css = await read('site/publica-buscador.css');
  assert.match(css, /\.metrics-sidebar-standalone \.sidebar-inner\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.metrics-sidebar-standalone \.sidebar-header\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
});

test('activarSeccion: además de mostrar/ocultar paneles, marca data-panel-activo en <html>', async () => {
  const js = await read('site/publica-buscador.js');
  const inicio = js.indexOf('activarSeccion(nombre) {');
  const fin = js.indexOf('\n  }', inicio) + 4;
  const cuerpo = js.slice(inicio, fin);
  assert.match(cuerpo, /setAttribute\('data-panel-activo', nombre\)/);
});

test('renderizarMetricasLateral: agrega barra de proporción a ventana de cierre sin sacar los conteos existentes', async () => {
  const js = await read('site/publica-buscador.js');
  const inicio = js.indexOf('function renderizarMetricasLateral');
  const fin = js.indexOf('\n}', inicio) + 2;
  const cuerpo = js.slice(inicio, fin);
  assert.match(cuerpo, /class="cierre-count">\$\{c3\}<\/span>/);
  assert.match(cuerpo, /class="cierre-bar-fill fill-rojo"/);
  assert.match(cuerpo, /class="cierre-bar-fill fill-ambar"/);
  assert.match(cuerpo, /class="cierre-bar-fill fill-gris"/);
});

test('rail-account: hay un botón de Configuración con ícono de rueda, arriba del botón de logout', async () => {
  const html = await read('site/publica-buscador.html');
  const bloque = html.slice(html.indexOf('class="rail-account"'), html.indexOf('</nav>'));
  const idxConfig = bloque.indexOf('id="railConfigButton"');
  const idxLogout = bloque.indexOf('id="publicaLogoutButton"');
  assert.ok(idxConfig !== -1, 'debe existir railConfigButton');
  assert.ok(idxLogout !== -1, 'debe seguir existiendo publicaLogoutButton');
  assert.ok(idxConfig < idxLogout, 'Configuración debe ir arriba de Cerrar sesión');
});

test('Configuración no duplica #certRow: navega a Buscador y hace foco ahí en vez de repetir los checkboxes', async () => {
  const html = await read('site/publica-buscador.html');
  // Solo debe existir un juego de ids de certificaciones en todo el documento.
  const ids = ['certOs10', 'certIso9001', 'certIso45001'];
  for (const id of ids) {
    const matches = html.match(new RegExp(`id="${id}"`, 'g')) || [];
    assert.equal(matches.length, 1, `${id} no debe estar duplicado`);
  }

  const js = await read('site/publica-buscador.js');
  const inicio = js.indexOf('railConfigButton.addEventListener');
  assert.ok(inicio !== -1, 'debe wirear el click del botón de Configuración');
  const fin = js.indexOf('\n    }', inicio) + 6;
  const cuerpo = js.slice(inicio, fin);
  assert.match(cuerpo, /activarSeccion\('buscador'\)/);
  assert.match(cuerpo, /getElementById\('certRow'\)/);
});
