import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

// site/publica-buscador.js no se puede importar directo (module.exports
// condicional, repo con "type":"module" — ver
// tests/ui/publica-buscador-pie.test.js para el mismo patrón).

test('publica-buscador: el select de orden existe con las 3 opciones esperadas', async () => {
  const html = await read('site/publica-buscador.html');
  assert.match(html, /id="filterOrden"/);
  assert.match(html, /<option value="reciente">/);
  assert.match(html, /<option value="cierre">/);
  assert.match(html, /<option value="monto">/);
});

test('publica-buscador: el cambio de orden se manda al servidor en el body de /api/buscar', async () => {
  const js = await read('site/publica-buscador.js');

  // Se agrega al payload existente, no lo reemplaza.
  assert.match(js, /orden: payload\.orden \|\| null/);
  assert.match(js, /orden: this\.filtros\.orden \|\| null/);

  // El estado por defecto coincide con ORDEN_DEFECTO del backend.
  assert.match(js, /orden: 'reciente'/);

  // El resto del body existente sigue ahí, sin tocar.
  assert.match(js, /texto: payload\.texto \|\| ''/);
  assert.match(js, /solo_abiertas: payload\.solo_abiertas/);
  assert.match(js, /region: payload\.region \|\| null/);
});

test('publica-buscador: cambiar el orden dispara una búsqueda nueva (no un simple re-render)', async () => {
  const js = await read('site/publica-buscador.js');
  const bloque = js.slice(js.indexOf("filterOrden.addEventListener('change'"));
  const finBloque = bloque.indexOf('});') + 3;
  const handler = bloque.slice(0, finBloque);
  assert.match(handler, /this\.filtros\.orden = e\.target\.value/);
  assert.match(handler, /this\.aplicarFiltrosYRenderizar\(\)/);
});
