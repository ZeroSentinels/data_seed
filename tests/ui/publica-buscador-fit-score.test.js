import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootUrl), 'utf8');

// site/publica-buscador.js es un script sin `import`/`export` de ES modules
// (usa `module.exports` condicional, pensado para <script> de navegador o
// require() de CommonJS) y este repo corre con "type": "module" — no se
// puede importar directo. Mismo patrón que ya usa
// tests/ui/publica-buscador-pie.test.js: se extrae el código fuente real y
// se evalúa, para probar la función real del archivo, no una copia pegada acá.
async function cargarFitScore() {
  const js = await read('site/publica-buscador.js');
  const inicio = js.indexOf('const PALABRAS_CLAVE_CERTIFICACIONES');
  assert.ok(inicio !== -1, 'PALABRAS_CLAVE_CERTIFICACIONES no está en el archivo');
  const inicioFuncion = js.indexOf('function calcularCoincidenciasCertificaciones', inicio);
  const finFuncion = js.indexOf('\n}', inicioFuncion) + 2;
  const bloque = js.slice(inicio, finFuncion);

  // eslint-disable-next-line no-eval
  return eval(`(function () { ${bloque}
    return { PALABRAS_CLAVE_CERTIFICACIONES, calcularCoincidenciasCertificaciones };
  })()`);
}

test('calcularCoincidenciasCertificaciones solo compara contra certificaciones declaradas por el cliente', async () => {
  const { calcularCoincidenciasCertificaciones } = await cargarFitScore();

  const item = { nombre: 'Contratación de curso OS10 y certificación ISO 9001 para faena minera' };

  assert.deepEqual(
    calcularCoincidenciasCertificaciones(item, { os10: true, iso9001: false, iso45001: false }),
    ['OS10'],
  );
  assert.deepEqual(
    calcularCoincidenciasCertificaciones(item, { os10: true, iso9001: true, iso45001: false }),
    ['OS10', 'ISO 9001'],
  );
  assert.deepEqual(calcularCoincidenciasCertificaciones(item, null), []);
  assert.deepEqual(calcularCoincidenciasCertificaciones(item, {}), []);
});

test('calcularCoincidenciasCertificaciones es insensible a mayúsculas y a guión/espacio ("OS-10", "iso9001")', async () => {
  const { calcularCoincidenciasCertificaciones } = await cargarFitScore();

  assert.deepEqual(
    calcularCoincidenciasCertificaciones({ nombre: 'Exige os-10 vigente' }, { os10: true }),
    ['OS10'],
  );
  assert.deepEqual(
    calcularCoincidenciasCertificaciones({ nombre: 'Requiere iso9001 al proveedor' }, { iso9001: true }),
    ['ISO 9001'],
  );
});

test('calcularCoincidenciasCertificaciones no encuentra nada si el título no menciona la certificación', async () => {
  const { calcularCoincidenciasCertificaciones } = await cargarFitScore();

  assert.deepEqual(
    calcularCoincidenciasCertificaciones(
      { nombre: 'Adquisición de insumos de aseo' },
      { os10: true, iso9001: true, iso45001: true },
    ),
    [],
  );
});

test('publica-buscador: el fit score es honesto — aclara que es aproximado y no verifica el pliego', async () => {
  const js = await read('site/publica-buscador.js');
  assert.match(js, /no es una verificaci[oó]n del pliego real/);
  assert.match(js, /aproximado, no verifica el pliego/);
});

test('publica-buscador: el bloque de certificaciones existe en el HTML, con los 3 checkboxes', async () => {
  const html = await read('site/publica-buscador.html');
  assert.match(html, /id="certOs10"/);
  assert.match(html, /id="certIso9001"/);
  assert.match(html, /id="certIso45001"/);
});

test('publica-buscador: certificaciones se cargan y guardan contra /api/auth/publica/certifications', async () => {
  const js = await read('site/publica-buscador.js');
  assert.match(js, /\/api\/auth\/publica\/certifications/);
  assert.match(js, /cargarPerfilCertificaciones/);
  assert.match(js, /guardarPerfilCertificaciones/);
});
