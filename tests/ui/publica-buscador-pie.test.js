import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

// Regresión [BUG 2026-09-08, visto en producción]: el pie del buscador mostraba
// la salvedad de Compra Ágil DOS VECES — la redacción obligatoria de la Sección
// 3 ("Nota de cobertura", con acentos) y la que manda el backend en
// meta.limitaciones ("Limitación adicional (media)", SIN acentos). El descarte
// comparaba `desc.includes('Compra Ágil')` con tilde, así que nunca calzaba con
// el texto del backend. Una salvedad repetida en la cara del cliente es un bug
// de producción, no cosmética.
test('el descarte de Compra Ágil en el pie no depende de los acentos', async () => {
  const js = await read('site/publica-buscador.js');

  // La comparación con el literal acentuado es exactamente el bug.
  assert.doesNotMatch(js, /includes\('Compra Ágil'\)/);

  const linea = js.split('\n').find((l) => l.includes('const sinAcentos'));
  assert.ok(linea, 'site/publica-buscador.js debe normalizar antes de comparar');

  // Se evalúa la función real del archivo, no una copia: si alguien cambia la
  // normalización, esta prueba lo ve.
  // eslint-disable-next-line no-eval
  const sinAcentos = eval(`(${linea.split('=').slice(1).join('=').trim().replace(/;$/, '')})`);

  for (const texto of [
    'Compra Agil no aparece aca porque no genera una licitacion',
    'Compra Ágil no aparece acá porque no genera una licitación',
    'COMPRA ÁGIL',
  ]) {
    assert.equal(sinAcentos(texto).includes('compra agil'), true,
      `debería reconocer "${texto}" como la salvedad de Compra Ágil`);
  }

  assert.equal(sinAcentos('La busqueda encuentra por palabras y por rubro oficial UNSPSC').includes('compra agil'), false);
});

// El texto que sobrevive tiene que ser el obligatorio, no el del backend: la
// Sección 3 fija la redacción y no puede depender de cómo la escriba mp-api.
test('el pie conserva la redacción obligatoria de Compra Ágil', async () => {
  const js = await read('site/publica-buscador.js');
  assert.match(js, /Compra Ágil no aparece acá porque no genera una licitación: es un mecanismo de compra directa\. Sus órdenes sí están en la base\./);
});
