/**
 * =========================================================================
 * PÚBLICA BY DATASEED — BUSCADOR DE LICITACIONES PÚBLICAS
 * Lógica de búsqueda, renderizado, métricas laterales y detalle de la licitación
 * según SPEC-buscador-publica.md (incluyendo sección 4-bis)
 * =========================================================================
 */

// =========================================================================
// 1. CONTRATO CON EL BACKEND REAL (Sección 4 y 4-bis de la spec)
// =========================================================================

/**
 * Endpoint real en producción:
 * POST /api/buscar
 * Content-Type: application/json
 * Body: { texto, solo_abiertas, region, limite, desde }
 * Respuesta: { total, resultados, metricas, meta }
 */
async function buscarLicitacionesBackend(payload) {
  const response = await fetch('/api/buscar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      texto: payload.texto || '',
      solo_abiertas: payload.solo_abiertas !== undefined ? payload.solo_abiertas : true,
      region: payload.region || null,
      limite: payload.limite || 50,
      desde: payload.desde || 0
    })
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} en backend: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Endpoint real en producción — Sección 4-bis.2:
 * GET /api/licitacion/{codigo}
 * Respuesta: { codigo, items, referencia_historica, url_ficha, meta }
 */
async function obtenerDetalleLicitacionBackend(codigo) {
  const response = await fetch(`/api/licitacion/${encodeURIComponent(codigo)}`);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al obtener detalle de ${codigo}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Obtiene el detalle de la licitación de una licitación (items + referencia histórica).
 * Cachea por código para no repetir la llamada si el usuario reabre el modal.
 */
async function obtenerDetalleLicitacion(codigo, cacheDetalles = null) {
  if (cacheDetalles && cacheDetalles[codigo]) {
    return cacheDetalles[codigo];
  }

  try {
    return await obtenerDetalleLicitacionBackend(codigo);
  } catch (err) {
    console.warn(`No se pudo obtener detalle para ${codigo}:`, err);
    return null;
  }
}

// =========================================================================
// 2. GLOSARIO DE TIPOS DE LICITACIÓN (Sección 3 de la spec)
// =========================================================================
const GLOSARIO_TIPOS = {
  'LE': 'Licitación Pública (100 a 1.000 UTM)',
  'LP': 'Licitación Pública (1.000 a 2.000 UTM)',
  'L1': 'Licitación Pública (menor a 100 UTM)',
  'LR': 'Licitación Pública (mayor a 5.000 UTM)',
  'LQ': 'Licitación Pública (tramos mayores)',
  'LS': 'Licitación Pública (tramos mayores)',
  'CO': 'Obras públicas',
  'O1': 'Obras públicas (O1)',
  'O2': 'Obras públicas (O2)',
  'B2': 'Tramos especiales (B2)',
  'E2': 'Tramos especiales (E2)',
  'H2': 'Tramos especiales (H2)',
  'I2': 'Tramos especiales (I2)'
};

function obtenerNombreTipo(sigla) {
  if (!sigla) return 'Licitación Pública';
  return GLOSARIO_TIPOS[sigla.toUpperCase()] || `Licitación Pública (${sigla})`;
}

// =========================================================================
// 1-bis. LAS 16 REGIONES OFICIALES (para el filtro de región)
// =========================================================================
// [MEDIDO 2026-09-05] region_comprador en la base real trae, mezclados con las
// 16 regiones, nombres de comuna, nombres de organismo mal cargados y un
// artefacto de parseo ("AwardCriteria.Text14"), ademas de espacios finales
// inconsistentes. Poblar el <select> con lo que devuelve la base mostraria
// esa basura al usuario. Esta lista son los 16 valores oficiales medidos
// directo de la base (sin el espacio final); el backend compara con trim() en
// los dos lados, asi que estos valores encuentran las filas sucias igual.
const REGIONES_OFICIALES = [
  'Región de Arica y Parinacota',
  'Región de Tarapacá',
  'Región de Antofagasta',
  'Región de Atacama',
  'Región de Coquimbo',
  'Región de Valparaíso',
  'Región Metropolitana de Santiago',
  'Región del Libertador General Bernardo O´Higgins',
  'Región del Maule',
  'Región del Ñuble',
  'Región del Biobío',
  'Región de la Araucanía',
  'Región de Los Ríos',
  'Región de los Lagos',
  'Región Aysén del General Carlos Ibáñez del Campo',
  'Región de Magallanes y de la Antártica'
];

// =========================================================================
// 3. NORMALIZACIÓN DE TEXTO EN MAYÚSCULAS Y ACRÓNIMOS (Sección 3 y 6.3)
// =========================================================================
const ACRONIMOS = new Set([
  'IA', 'AI', 'BI', 'TI', 'IT', 'MOP', 'JUNAEB', 'CONAF', 'GORE', 'SEREMI',
  'MINVU', 'MINSAL', 'INDAP', 'FOSIS', 'SENCE', 'SAG', 'SII', 'UTM', 'UF',
  'CLP', 'USD', 'API', 'ERP', 'CRM', 'SaaS', 'PaaS', 'IaaS', 'GPS', 'PDF',
  'SQL', 'OCR', 'RUT', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX',
  'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'UNSPSC'
]);

const ENLACES_ESPANOL = new Set([
  'de', 'del', 'en', 'y', 'o', 'a', 'para', 'por', 'con', 'las', 'los', 'el', 'la', 'un', 'una'
]);

function normalizarTextoVisual(texto) {
  if (!texto || typeof texto !== 'string') return '';
  const textoTrim = texto.trim();
  const esTodoMayusculas = textoTrim === textoTrim.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(textoTrim);

  if (!esTodoMayusculas) {
    return textoTrim;
  }

  const tokens = textoTrim.toLowerCase().split(/(\s+|[-/])/);
  let primeraPalabra = true;

  const resultado = tokens.map((token) => {
    if (/^\s+$/.test(token) || token === '-' || token === '/') {
      return token;
    }

    const limpio = token.replace(/[^a-záéíóúñ0-9]/gi, '').toUpperCase();
    if (ACRONIMOS.has(limpio)) {
      return token.toUpperCase();
    }

    if (!primeraPalabra && ENLACES_ESPANOL.has(token.toLowerCase())) {
      return token.toLowerCase();
    }

    primeraPalabra = false;
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  });

  return resultado.join('');
}

/**
 * Elimina tildes y pasa a minúsculas para comparaciones insensibles a diacríticos
 */
function quitarTildes(str) {
  if (!str || typeof str !== 'string') return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * La spec nunca pidió un buscador real en el cliente: los 8 items de datos-ejemplo.json
 * SON la respuesta que el backend ya calculó. No se filtra por texto en el cliente.
 */
function coincideBusqueda(item, query) {
  // Los resultados provienen precalculados del servidor. No se filtra por texto.
  return true;
}

/**
 * Filtra el conjunto traído por los filtros secundarios (Sólo abiertas, Región, Monto).
 * No filtra por texto en el cliente; coincideBusqueda() preserva la muestra del servidor.
 */
function filtrarResultados(dataset, filtros, fechaBase = '2026-09-03') {
  if (!Array.isArray(dataset)) return [];

  return dataset.filter(item => {
    // 0. Búsqueda de texto: delegada a coincideBusqueda (la cual no filtra en cliente)
    if (!coincideBusqueda(item, filtros.texto)) {
      return false;
    }

    // 1. Filtro Sólo abiertas (evaluado contra la fecha de cierre y estado)
    const cierre = evaluarCierre(item.fecha_cierre, fechaBase);
    const estaCerrada = cierre.esCerrada || (item.estado && item.estado.toLowerCase() === 'cerrada');
    if (filtros.soloAbiertas && estaCerrada) {
      return false;
    }

    // 2. Filtro Región
    if (filtros.region && (item.region_comprador || '').trim() !== filtros.region.trim()) {
      return false;
    }

    // 3. Filtro Monto
    if (filtros.monto) {
      const monto = item.monto_estimado_clp;
      const tieneMonto = monto !== null && monto !== undefined && !isNaN(monto);

      if (filtros.monto === 'con_monto' && !tieneMonto) {
        return false;
      }
      if (filtros.monto === 'sin_monto' && tieneMonto) {
        return false;
      }
      if (filtros.monto === 'mayor_10m') {
        if (!tieneMonto || monto < 10000000) return false;
      }
      if (filtros.monto === 'menor_10m') {
        if (!tieneMonto || monto >= 10000000) return false;
      }
    }

    return true;
  });
}

/**
 * Genera el texto del contador con concordancia gramatical y detalle de muestra.
 */
function formatearContadorResultados(itemsCount, soloAbiertas, region, monto, totalServidor = 83) {
  const sinFiltrosSecundarios = !region && !monto;

  if (sinFiltrosSecundarios) {
    if (soloAbiertas) {
      return `${totalServidor} licitaciones encontradas <span class="results-count-detail">(${itemsCount} abiertas en muestra)</span>`;
    } else {
      return `${totalServidor} licitaciones encontradas <span class="results-count-detail">(${itemsCount} en muestra, cerradas incluidas)</span>`;
    }
  } else {
    if (itemsCount === 1) {
      return `1 licitación encontrada`;
    } else {
      return `${itemsCount} licitaciones encontradas`;
    }
  }
}

// =========================================================================
// 4. CÁLCULO DE DÍAS RESTANTES Y ESTADO DE CIERRE (Sección 6.3 y 6.4)
// =========================================================================
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function limpiarFechaStr(str) {
  if (!str || typeof str !== 'string') return '';
  return str.split('T')[0].split(' ')[0].trim();
}

function formatearFechaCorta(fechaStr) {
  if (!fechaStr) return '';
  const limpia = limpiarFechaStr(fechaStr);
  const partes = limpia.split('-');
  if (partes.length !== 3) return fechaStr;
  const dia = parseInt(partes[2], 10);
  const mesIndex = parseInt(partes[1], 10) - 1;
  const anio = partes[0];
  const mes = MESES_CORTOS[mesIndex] || partes[1];
  return `${dia} ${mes} ${anio}`;
}

function formatearFechaLarga(fechaStr) {
  if (!fechaStr) return '';
  const limpia = limpiarFechaStr(fechaStr);
  const partes = limpia.split('-');
  if (partes.length !== 3) return fechaStr;
  const dia = parseInt(partes[2], 10);
  const mesIndex = parseInt(partes[1], 10) - 1;
  const anio = partes[0];
  const mes = MESES_LARGOS[mesIndex] || partes[1];
  return `${dia} de ${mes} de ${anio}`;
}

/**
 * Calcula la diferencia en días entre la fecha de cierre y la fecha de corte as_of.
 * Reglas exactas de la spec:
 * - Más de 7 días: gris
 * - 3 a 7 días: ámbar
 * - Menos de 3 días: rojo
 * - Ya cerrada: gris tachado
 */
function evaluarCierre(fechaCierreStr, fechaBaseStr = '2026-09-03') {
  if (!fechaCierreStr) {
    return {
      texto: 'Fecha de cierre no informada',
      claseCss: 'urgencia-gris',
      esCerrada: false,
      dias: null
    };
  }

  const fCierreLimpia = limpiarFechaStr(fechaCierreStr);
  const fBaseLimpia = limpiarFechaStr(fechaBaseStr);

  const [y1, m1, d1] = fCierreLimpia.split('-').map(Number);
  const [y0, m0, d0] = fBaseLimpia.split('-').map(Number);

  const dateCierre = new Date(Date.UTC(y1, m1 - 1, d1));
  const dateBase = new Date(Date.UTC(y0, m0 - 1, d0));

  const diffMs = dateCierre.getTime() - dateBase.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const fechaFormateada = formatearFechaCorta(fechaCierreStr);

  if (diffDias < 0) {
    return {
      texto: `Cerrada el ${fechaFormateada}`,
      claseCss: 'urgencia-cerrada',
      esCerrada: true,
      dias: diffDias
    };
  }

  let textoUrgencia = '';
  if (diffDias === 0) {
    textoUrgencia = `Cierra hoy · ${fechaFormateada}`;
  } else if (diffDias === 1) {
    textoUrgencia = `Cierra mañana · ${fechaFormateada}`;
  } else {
    textoUrgencia = `Cierra en ${diffDias} días · ${fechaFormateada}`;
  }

  if (diffDias < 3) {
    return {
      texto: textoUrgencia,
      claseCss: 'urgencia-rojo',
      esCerrada: false,
      dias: diffDias
    };
  } else if (diffDias <= 7) {
    return {
      texto: textoUrgencia,
      claseCss: 'urgencia-ambar',
      esCerrada: false,
      dias: diffDias
    };
  } else {
    return {
      texto: textoUrgencia,
      claseCss: 'urgencia-gris',
      esCerrada: false,
      dias: diffDias
    };
  }
}

// =========================================================================
// 5. FORMATEO DE MONTO (Sección 0, 3 y 6.3)
// Regla: Si falta, decir "Monto no publicado por el organismo". Nunca $0 ni —
// =========================================================================
function formatearMonto(montoClp) {
  if (montoClp === null || montoClp === undefined || isNaN(montoClp)) {
    return {
      html: `<span class="monto-no-publicado">Monto no publicado por el organismo</span>`,
      tieneMonto: false,
      valor: 0
    };
  }

  const formateado = `$${Number(montoClp).toLocaleString('es-CL')}`;
  return {
    html: `<span class="monto-publicado">${formateado}</span>`,
    tieneMonto: true,
    valor: Number(montoClp)
  };
}

// =========================================================================
// 6. REGLA DEL UMBRAL (Sección 4-bis.3) Y PSICOLOGÍA DE VENTAS (Sección 2.4)
// =========================================================================
/**
 * Reglas duras de la Sección 4-bis.3:
 * 1. n_licitaciones viaja SIEMPRE. Ningún número de referencia se muestra sin él.
 * 2. Con n < 3: PROHIBIDO el lenguaje estadístico. No "mediana", no "promedio",
 *    no "rango de mercado". Se dice "único antecedente" (n=1) o "2 antecedentes" (n=2),
 *    y se muestra el valor como dato puntual.
 * 3. Con n = 0: alcance: "sin_datos". No se rellena con el rubro sin avisar.
 * 4. El alcance se muestra SIEMPRE: "este organismo y rubro" vs "el rubro en general".
 * 5. Psicología de ventas (2.4 punto 2): Si oferentes_mediana <= 2, se destaca como oportunidad
 *    comercial ("Baja competencia: casi no compite nadie").
 */
function formatearReferenciaHistorica(refHistorica) {
  if (!refHistorica || refHistorica.alcance === 'sin_datos' || !refHistorica.n_licitaciones) {
    return {
      tieneDatos: false,
      n: 0,
      alcance: 'sin_datos',
      alcanceTexto: 'Sin antecedentes históricos disponibles',
      esEstadistico: false,
      esBajaCompetencia: false,
      textoResumen: 'Sin antecedentes históricos registrados en la base',
      html: `<div class="ref-hist-empty">Sin antecedentes históricos registrados para este criterio.</div>`
    };
  }

  const n = refHistorica.n_licitaciones;
  const esOrganismo = refHistorica.alcance === 'organismo_y_rubro';
  const alcanceTexto = esOrganismo ? 'este organismo y rubro' : 'el rubro en general';
  const esBajaCompetencia = refHistorica.oferentes_mediana !== null &&
    refHistorica.oferentes_mediana !== undefined &&
    refHistorica.oferentes_mediana <= 2;

  // CASO n < 3: PROHIBIDO LENGUAJE ESTADÍSTICO (Regla del Umbral)
  if (n < 3) {
    const nTexto = n === 1 ? 'único antecedente' : '2 antecedentes';
    const tieneMonto = refHistorica.monto_mediana_clp !== null && refHistorica.monto_mediana_clp !== undefined;
    const montoPuntual = tieneMonto
      ? `$${Number(refHistorica.monto_mediana_clp).toLocaleString('es-CL')}`
      : 'Monto no registrado';
    const oferentesPuntual = (refHistorica.oferentes_mediana !== null && refHistorica.oferentes_mediana !== undefined)
      ? `${Number(refHistorica.oferentes_mediana).toLocaleString('es-CL')} ${refHistorica.oferentes_mediana === 1 ? 'oferente' : 'oferentes'}`
      : null;

    const textoResumen = `${nTexto.charAt(0).toUpperCase() + nTexto.slice(1)} en ${alcanceTexto}: ${montoPuntual}${oferentesPuntual ? ` · ${oferentesPuntual}` : ''}`;

    return {
      tieneDatos: true,
      n,
      nTexto,
      alcance: refHistorica.alcance,
      alcanceTexto,
      esEstadistico: false,
      montoPuntual,
      rangoTexto: null,
      oferentesTexto: oferentesPuntual,
      esBajaCompetencia,
      textoResumen,
      html: `
        <div class="ref-historica-box ref-puntual" data-n="${n}">
          <div class="ref-meta-line">
            <span class="ref-badge-n">${nTexto}</span>
            <span class="ref-badge-alcance">en ${alcanceTexto}</span>
            ${esBajaCompetencia ? `<span class="ref-badge-low-comp"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg> Oportunidad: baja competencia (${oferentesPuntual || '1-2 oferentes'})</span>` : ''}
          </div>
          <div class="ref-data-row">
            <div class="ref-data-item">
              <span class="ref-item-label">Monto registrado:</span>
              <span class="ref-item-value">${montoPuntual}</span>
            </div>
            ${oferentesPuntual ? `
              <div class="ref-data-item">
                <span class="ref-item-label">Oferentes registrados:</span>
                <span class="ref-item-value">${oferentesPuntual}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `
    };
  }

  // ESCALONES 2 Y 3: n >= 3 -> LENGUAJE ESTADÍSTICO PERMITIDO (§4-bis.3 y §4-bis.3-bis)
  const nTexto = `${n} antecedentes`;
  const tieneMediana = refHistorica.monto_mediana_clp !== null && refHistorica.monto_mediana_clp !== undefined;
  const medianaFormateada = tieneMediana
    ? `$${Number(refHistorica.monto_mediana_clp).toLocaleString('es-CL')}`
    : 'No registrada';

  // Rango por percentiles (§4-bis.3-bis): SÓLO si n >= 10. Con n < 10 está prohibido mostrar rango.
  let rangoTexto = null;
  if (n >= 10) {
    const p10 = refHistorica.monto_p10_clp;
    const p90 = refHistorica.monto_p90_clp;

    if (p10 !== null && p10 !== undefined && p90 !== null && p90 !== undefined && p10 < p90) {
      const p10Formateado = `$${Number(p10).toLocaleString('es-CL')}`;
      const p90Formateado = `$${Number(p90).toLocaleString('es-CL')}`;
      // Regla §4-bis.3-bis: La etiqueta dice "rango habitual" o "8 de cada 10 casos", nunca "rango" solo
      rangoTexto = `rango habitual: ${p10Formateado} a ${p90Formateado}`;
    }
  }

  const numOferentes = (refHistorica.oferentes_mediana !== null && refHistorica.oferentes_mediana !== undefined)
    ? Number(refHistorica.oferentes_mediana).toLocaleString('es-CL')
    : null;
  const oferentesMedianaTexto = numOferentes
    ? `${numOferentes} ${refHistorica.oferentes_mediana === 1 ? 'oferente mediana' : 'oferentes mediana'}`
    : null;
  const oferentesValorLimpio = numOferentes
    ? `${numOferentes} ${refHistorica.oferentes_mediana === 1 ? 'oferente' : 'oferentes'}`
    : null;

  const rangoSnippet = rangoTexto ? ` (${rangoTexto})` : '';
  const textoResumen = `Mediana histórica en ${alcanceTexto} (${n} antecedentes): ${medianaFormateada}${rangoSnippet}${oferentesMedianaTexto ? ` · ${oferentesMedianaTexto} (n=${n})` : ''}`;

  return {
    tieneDatos: true,
    n,
    nTexto,
    alcance: refHistorica.alcance,
    alcanceTexto,
    esEstadistico: true,
    mediana: medianaFormateada,
    rangoTexto,
    oferentesTexto: oferentesMedianaTexto,
    esBajaCompetencia,
    textoResumen,
    html: `
      <div class="ref-historica-box ref-estadistica" data-n="${n}">
        <div class="ref-meta-line">
          <span class="ref-badge-n">${nTexto}</span>
          <span class="ref-badge-alcance">en ${alcanceTexto}</span>
          ${esBajaCompetencia ? `<span class="ref-badge-low-comp"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg> Oportunidad: baja competencia (${oferentesMedianaTexto})</span>` : ''}
        </div>
        <div class="ref-data-row">
          <div class="ref-data-item">
            <span class="ref-item-label">Mediana histórica:</span>
            <span class="ref-item-value">${medianaFormateada}</span>
            ${rangoTexto ? `<span class="ref-item-range">(${rangoTexto})</span>` : ''}
          </div>
          ${oferentesValorLimpio ? `
            <div class="ref-data-item">
              <span class="ref-item-label">Competencia mediana:</span>
              <span class="ref-item-value">${oferentesValorLimpio}</span>
              <span class="ref-item-n">(n=${n})</span>
            </div>
          ` : ''}
        </div>
      </div>
    `
  };
}

// =========================================================================
// 7. ÍTEMS MASTICADOS (Sección 4-bis.2)
// =========================================================================
/**
 * Formatea los ítems adquiridos con producto, cantidad, unidad y código UNSPSC.
 */
function formatearItemsMasticados(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      cantidadTotal: 0,
      htmlLista: '<li class="item-detalle-empty">Sin detalle de ítems disponible</li>',
      itemsResumen: 'Sin detalle de ítems'
    };
  }

  const itemsHtml = items.map(it => {
    const nombre = normalizarTextoVisual(it.nombre_producto || 'Producto sin especificar');
    const cantidad = Number(it.cantidad || 1).toLocaleString('es-CL');
    const unidad = it.unidad_medida || 'Unidad';
    const unspsc = it.unspsc_commodity ? `UNSPSC ${it.unspsc_commodity}` : null;

    return `
      <li class="item-detalle-row">
        <div class="item-detalle-main">
          <span class="item-detalle-bullet">•</span>
          <span class="item-detalle-nombre">${nombre}</span>
          <span class="item-detalle-qty">· ${cantidad} ${unidad}</span>
        </div>
        ${unspsc ? `<span class="item-detalle-unspsc">${unspsc}</span>` : ''}
      </li>
    `;
  }).join('');

  const itemsResumen = items.map(it => {
    const nombre = normalizarTextoVisual(it.nombre_producto || '');
    const cantidad = Number(it.cantidad || 1).toLocaleString('es-CL');
    const unidad = it.unidad_medida || 'Unidad';
    return `${nombre} (${cantidad} ${unidad})`;
  }).join(', ');

  return {
    cantidadTotal: items.length,
    htmlLista: itemsHtml,
    itemsResumen
  };
}

// =========================================================================
// 8. GENERACIÓN VISUAL DE TARJETA DE RESULTADO (Sección 6.3 y 4-bis)
// 7 capas visuales obligatorias en orden de peso visual:
// 1. Nombre, 2. Cierre y días restantes, 3. Monto, 4. Organismo y región,
// 5. Tipo, 6. Código, 7. Enlace a Mercado Público (secundario).
// Más las adiciones de Sección 4-bis:
// - Detalle de la licitación (Ítems que compran de verdad)
// - Referencia histórica debajo de "Monto no publicado" (llenar el vacío del competidor)
// - Botón principal: "Ver detalle de la licitación"
// =========================================================================
function generarHtmlTarjeta(item, fechaBase = '2026-09-03', detalle = null) {
  if (!item) return '';

  // 1. Nombre normalizado (formato visual normal, no mayúsculas)
  const nombreNormalizado = normalizarTextoVisual(item.nombre);

  // 2. Cierre y días restantes
  const cierre = evaluarCierre(item.fecha_cierre, fechaBase);

  // 3. Monto
  const monto = formatearMonto(item.monto_estimado_clp);

  // 4. Organismo y región
  const organismoNormalizado = normalizarTextoVisual(item.organismo_nombre);
  const regionTexto = item.region_comprador || 'Región no informada';

  // 5. Tipo como nombre completo
  const tipoCompleto = obtenerNombreTipo(item.tipo);

  // 6. Código chiquito para copiar
  const codigo = item.codigo || 'S/C';

  // 7. Enlace a Mercado Público (patrón oficial medido en producción)
  const urlMp = (detalle && detalle.url_ficha) || item.url_ficha || `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${encodeURIComponent(codigo)}`;

  // 8. Detalle de la licitación (Sección 4-bis): ítems y referencia histórica
  const det = detalle || item.detalle || null;
  let bloqueReferenciaHtml = '';
  let bloqueItemsHtml = '';

  if (det) {
    if (det.referencia_historica) {
      const ref = formatearReferenciaHistorica(det.referencia_historica);
      // Psicología de ventas (2.4 punto 1): Llenar el vacío del competidor
      // Donde hoy dice "Monto no publicado por el organismo", agregá debajo la referencia histórica.
      const tituloBloque = !monto.tieneMonto
        ? 'DataSeed referencia histórica (compras previas en la base):'
        : 'Referencia histórica en compras públicas:';

      bloqueReferenciaHtml = `
        <div class="card-ref-historica-container ${!monto.tieneMonto ? 'card-ref-fill-void' : ''}">
          <div class="card-ref-title">
            <span class="card-ref-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
            <span>${tituloBloque}</span>
          </div>
          ${ref.html}
        </div>
      `;
    }

    if (det.items && det.items.length > 0) {
      const itemsFormat = formatearItemsMasticados(det.items);
      bloqueItemsHtml = `
        <div class="card-items-detalle">
          <div class="items-detalle-tag">
            <span class="items-detalle-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>
            <span>Lo que compran de verdad (${itemsFormat.cantidadTotal} ${itemsFormat.cantidadTotal === 1 ? 'ítem' : 'ítems'}):</span>
          </div>
          <ul class="items-detalle-ul">
            ${itemsFormat.htmlLista}
          </ul>
        </div>
      `;
    }
  }

  return `
    <article class="tender-card" data-codigo="${codigo}">
      <!-- Fila 1: 1. Nombre y 2. Cierra en X días -->
      <div class="card-header-row">
        <h2 class="tender-title">${nombreNormalizado}</h2>
        <div class="urgencia-badge ${cierre.claseCss}" title="Fecha límite: ${formatearFechaCorta(item.fecha_cierre)}">
          <span class="badge-dot"></span>
          <span>${cierre.texto}</span>
        </div>
      </div>

      <!-- Fila 2: 3. Monto y 4. Organismo + Región -->
      <div class="card-middle-row">
        <div class="tender-monto">
          ${monto.html}
        </div>
        <div class="tender-buyer-info">
          <span class="buyer-organismo">${organismoNormalizado}</span>
          <span class="buyer-sep">·</span>
          <span class="buyer-region">${regionTexto}</span>
        </div>
      </div>

      <!-- 4-bis.3 Referencia histórica (Llena el vacío o compara) -->
      ${bloqueReferenciaHtml}

      <!-- 4-bis.2 Ítems solicitados: Lo que están comprando de verdad -->
      ${bloqueItemsHtml}

      <!-- Fila 3: 5. Tipo, 6. Código y 7. Destino Principal detallado + Mercado Público secundario -->
      <div class="card-footer-row">
        <div class="card-meta-left">
          <span class="tender-tipo-badge" title="Código de tipo: ${item.tipo || ''}">
            ${tipoCompleto}
          </span>
          <div class="tender-codigo-container" title="Código de licitación">
            <span class="tender-codigo-text">${codigo}</span>
            <button type="button" class="btn-copy-code" data-code="${codigo}" aria-label="Copiar código ${codigo}">
              Copiar
            </button>
          </div>
        </div>

        <div class="card-actions-right">
          <!-- Destino principal nuevo (Sección 2.2): Detalle de la licitación -->
          <button type="button" class="btn-ver-detalle" data-codigo="${codigo}" aria-label="Ver detalle de la licitación de ${codigo}">
            <span>Ver detalle de la licitación</span>
          </button>

          <!-- Salida secundaria: Enlace a Mercado Público -->
          <a href="${urlMp}" target="_blank" rel="noopener noreferrer" class="link-mercado-publico" title="Ficha original no procesada en Mercado Público">
            <span>Ver en Mercado Público</span>
            <span class="icon-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </article>
  `;
}

// =========================================================================
// 9. LATERAL DE MÉTRICAS GLOBALES DEL FILTRO (Sección 4-bis.1)
// =========================================================================
/**
 * Renderiza el lateral con las métricas globales del mercado para el filtro vigente.
 * Reglas duras:
 * - monto.suma_clp NUNCA se muestra sola. Va siempre junto a n_con_monto.
 * - n_oculto_por_organismo rotulado como "no publican presupuesto", NUNCA "sin dato".
 * - cierre.* calculado contra meta.as_of.
 * - competencia.oferentes_mediana NO se muestra sin su n.
 * - Psicología de ventas: convierte una lista en un mercado visible.
 */
function renderizarMetricasLateral(metricas, meta) {
  if (!metricas) return '';

  const fechaCorte = meta && meta.as_of ? formatearFechaCorta(meta.as_of) : '3 sep 2026';

  // 1. Presupuesto
  const sumaClp = metricas.monto && metricas.monto.suma_clp !== undefined
    ? `$${Number(metricas.monto.suma_clp).toLocaleString('es-CL')}`
    : '$0';
  const nConMonto = metricas.monto ? metricas.monto.n_con_monto : 0;
  const nOculto = metricas.monto ? metricas.monto.n_oculto_por_organismo : 0;
  const medianaClp = metricas.monto && metricas.monto.mediana_clp !== undefined
    ? `$${Number(metricas.monto.mediana_clp).toLocaleString('es-CL')}`
    : null;

  // 2. Ventana de cierre
  const c3 = metricas.cierre ? (metricas.cierre.en_3_dias || 0) : 0;
  const c7 = metricas.cierre ? (metricas.cierre.en_7_dias || 0) : 0;
  const cMas7 = metricas.cierre ? (metricas.cierre.mas_de_7 || 0) : 0;

  // 3. Competencia
  // El backend aplica la regla del umbral y declara si el dato alcanza para
  // llamarse "mediana" (docs/architecture/publica-buscador.md §4.1c y §5.1).
  // El frontend NO decide el rótulo: lo lee.
  //
  // [BUG 2026-09-07] Buscar "fermin" -- una palabra sin significado de rubro --
  // devolvía CERO resultados y esta tarjeta decía "2 oferentes mediana, medido
  // sobre 4 licitaciones del rubro". Dos mentiras: "mediana" sobre n=4 es
  // precisión falsa, y "del rubro" era literalmente incorrecto (eran transporte
  // escolar, luminarias y un laboratorio, unidas por el nombre propio "Liceo
  // Fermín del Real"). El backend nunca dijo "rubro": lo agregaba este archivo.
  const comp = metricas.competencia || {};
  const compMediana = comp.oferentes_mediana !== undefined ? comp.oferentes_mediana : null;
  const compN = comp.n || 0;
  const compSuficiente = comp.suficiente_para_mediana === true;

  // 4. Rankings
  const topOrganismos = Array.isArray(metricas.top_organismos) ? metricas.top_organismos : [];
  const topRegiones = Array.isArray(metricas.top_regiones) ? metricas.top_regiones : [];

  return `
    <div class="sidebar-inner">
      <div class="sidebar-header">
        <div class="sidebar-badge">Visión de Mercado</div>
        <h3 class="sidebar-title">Métricas del filtro</h3>
        <p class="sidebar-subtitle">Datos consolidados para las licitaciones disponibles (corte al ${fechaCorte}).</p>
      </div>

      <!-- Bloque 1: Presupuesto del mercado -->
      <div class="sidebar-card">
        <div class="sidebar-card-label">Presupuesto en el filtro</div>
        <div class="sidebar-main-value">${sumaClp}</div>
        <div class="sidebar-value-sub">
          Calculado sobre <strong>${nConMonto}</strong> licitaciones con monto publicado (${metricas.n} en el filtro)
        </div>

        <div class="sidebar-divider"></div>

        <div class="sidebar-stats-grid">
          ${medianaClp ? `
            <div class="sidebar-stat-item">
              <span class="stat-label">Mediana:</span>
              <span class="stat-value">${medianaClp}</span>
            </div>
          ` : ''}
          <div class="sidebar-stat-item">
            <span class="stat-label">Presupuesto reservado:</span>
            <span class="stat-value text-amber"><strong>${nOculto} no publica${nOculto === 1 ? '' : 'n'} presupuesto</strong></span>
          </div>
        </div>
      </div>

      <!-- Bloque 2: Ventana de cierre (Semáforo de urgencia) -->
      <div class="sidebar-card">
        <div class="sidebar-card-label">Ventana de cierre</div>
        <div class="sidebar-cierre-rows">
          <div class="sidebar-cierre-row">
            <span class="cierre-pill pill-rojo">≤ 3 días</span>
            <span class="cierre-desc">Urgencia alta</span>
            <span class="cierre-count">${c3}</span>
          </div>
          <div class="sidebar-cierre-row">
            <span class="cierre-pill pill-ambar">3 a 7 días</span>
            <span class="cierre-desc">Cierran esta semana</span>
            <span class="cierre-count">${c7}</span>
          </div>
          <div class="sidebar-cierre-row">
            <span class="cierre-pill pill-gris">> 7 días</span>
            <span class="cierre-desc">Plazo estándar</span>
            <span class="cierre-count">${cMas7}</span>
          </div>
        </div>
      </div>

      <!-- Bloque 3: Competencia histórica -->
      ${compMediana === null ? '' : `
      <div class="sidebar-card">
        <div class="sidebar-card-label">Intensidad competitiva</div>
        <div class="sidebar-main-value">${compMediana === 1 ? '1 oferente' : `${Number(compMediana).toLocaleString('es-CL')} oferentes`}${compSuficiente ? ' <span class="sidebar-inline-unit">mediana</span>' : ''}</div>
        <div class="sidebar-value-sub">
          ${compSuficiente
            ? `Mediana sobre <strong>${Number(compN).toLocaleString('es-CL')}</strong> licitaciones ya adjudicadas que coinciden con esta búsqueda`
            : `Sólo <strong>${Number(compN).toLocaleString('es-CL')}</strong> ${compN === 1 ? 'antecedente' : 'antecedentes'} — muy pocos para hablar de mediana de mercado`}
          <br>
          <em>No son las licitaciones que se muestran arriba, y no necesariamente son del mismo rubro.</em>
        </div>
      </div>`}

      <!-- Bloque 4: Top Compradores y Regiones -->
      <div class="sidebar-card">
        <div class="sidebar-card-label">Distribución de oportunidades</div>

        ${topOrganismos.length > 0 ? `
          <div class="sidebar-ranking-group">
            <div class="ranking-group-title">Principales compradores:</div>
            <ul class="ranking-list">
              ${topOrganismos.map(org => `
                <li class="ranking-item">
                  <span class="ranking-name" title="${org.nombre || ''}">${normalizarTextoVisual(org.nombre || '')}</span>
                  <span class="ranking-badge">${org.n}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${topRegiones.length > 0 ? `
          <div class="sidebar-ranking-group" style="margin-top: 0.85rem;">
            <div class="ranking-group-title">Regiones con más llamados:</div>
            <ul class="ranking-list">
              ${topRegiones.map(reg => {
                const nombreReg = (reg && reg.nombre ? reg.nombre : '').trim();
                return `
                <li class="ranking-item">
                  <span class="ranking-name" title="${nombreReg}">${nombreReg}</span>
                  <span class="ranking-badge">${reg.n}</span>
                </li>
              `;}).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// =========================================================================
// 10. DETALLE MASTICADO EN MODAL (Sección 4-bis.2)
// =========================================================================
/**
 * Renderiza los datos digeridos para el modal de inspección masticada
 */
function renderizarModalDetalle(codigo, item, detalle, fechaBase = '2026-09-03') {
  const nombre = normalizarTextoVisual(item ? item.nombre : '');
  const tipoCompleto = item ? obtenerNombreTipo(item.tipo) : 'Licitación Pública';
  const cierre = item ? evaluarCierre(item.fecha_cierre, fechaBase) : null;
  const organismo = item ? normalizarTextoVisual(item.organismo_nombre) : '';
  const region = item ? (item.region_comprador || 'Región no informada') : '';
  const monto = item ? formatearMonto(item.monto_estimado_clp) : null;
  const urlMp = (detalle && detalle.url_ficha) || (item && item.url_ficha) || `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${encodeURIComponent(codigo)}`;

  const items = detalle && detalle.items ? detalle.items : [];
  const refHist = detalle && detalle.referencia_historica ? detalle.referencia_historica : null;

  return {
    titulo: nombre,
    tipoCompleto,
    cierre,
    organismo,
    region,
    codigo,
    urlMp,
    bodyHtml: `
      <div class="modal-section-block">
        <h3 class="modal-section-title">
          <span class="section-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>
          <span>Lo que compran de verdad (Ítems solicitados)</span>
        </h3>
        <p class="modal-section-sub">
          Líneas de producto y servicios extraídas directamente de las bases técnicas.
        </p>

        <div class="modal-items-table-container">
          <table class="modal-items-table">
            <thead>
              <tr>
                <th>Producto / Servicio</th>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>UNSPSC</th>
              </tr>
            </thead>
            <tbody>
              ${items.length > 0 ? items.map(it => `
                <tr>
                  <td class="col-prod"><strong>${normalizarTextoVisual(it.nombre_producto)}</strong></td>
                  <td class="col-qty">${Number(it.cantidad).toLocaleString('es-CL')}</td>
                  <td class="col-unit">${it.unidad_medida || 'Unidad'}</td>
                  <td class="col-unspsc"><code>${it.unspsc_commodity || '—'}</code></td>
                </tr>
              `).join('') : `
                <tr><td colspan="4" class="col-empty">Sin ítems detallados para esta licitación</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-section-block">
        <h3 class="modal-section-title">
          <span class="section-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></span>
          <span>Presupuesto y Referencia Histórica</span>
        </h3>

        <div class="modal-budget-grid">
          <div class="modal-budget-card">
            <span class="budget-card-label">Presupuesto en Mercado Público:</span>
            <div class="budget-card-val">${monto ? monto.html : 'No informado'}</div>
            ${monto && !monto.tieneMonto ? `
              <span class="budget-card-hint">El organismo reservó el presupuesto durante la recepción de ofertas.</span>
            ` : ''}
          </div>

          <div class="modal-budget-card">
            <span class="budget-card-label">Referencia Histórica DataSeed:</span>
            ${refHist ? formatearReferenciaHistorica(refHist).html : '<div class="ref-hist-empty">Sin antecedentes históricos registrados.</div>'}
          </div>
        </div>
      </div>

      <div class="modal-section-block">
        <h3 class="modal-section-title">
          <span class="section-icon"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
          <span>Inteligencia Comercial y Competencia</span>
        </h3>
        <div class="modal-intel-card">
          ${refHist && refHist.oferentes_mediana !== null && refHist.oferentes_mediana <= 2 ? `
            <div class="intel-opportunity-banner">
              <span class="intel-badge"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg> Oportunidad de baja competencia</span>
              <p class="intel-text">
                Históricamente compiten sólo <strong>${Number(refHist.oferentes_mediana).toLocaleString('es-CL')} ${refHist.oferentes_mediana === 1 ? 'oferente' : 'oferentes'}</strong> en licitaciones comparables.
              </p>
            </div>
          ` : `
            <div class="intel-standard-banner">
              <span class="intel-badge-standard">Intensidad competitiva</span>
              <p class="intel-text">
                ${refHist && refHist.oferentes_mediana !== null
                  ? `Mediana de <strong>${Number(refHist.oferentes_mediana).toLocaleString('es-CL')} oferentes</strong> por proceso en el historial analizado (n = ${refHist.n_licitaciones || 0}).`
                  : 'Sin registro previo de intensidad competitiva para este rubro.'}
              </p>
            </div>
          `}
          ${monto && !monto.tieneMonto ? `
            <div class="intel-void-banner">
              <span class="intel-badge-void"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Diferenciador DataSeed</span>
              <p class="intel-text">
                El 46,1 % de las licitaciones abiertas no publica presupuesto. DataSeed aporta el antecedente de compra anterior para definir tu precio de oferta con respaldo empírico.
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `
  };
}

// =========================================================================
// 11. ESTADO DE LA APLICACIÓN Y CONTROLADORES
// =========================================================================
class BuscadorPublicaApp {
  constructor() {
    this.datasetCompleto = [];
    this.metricas = null;
    this.detalles = {};
    this.meta = {
      fuente: 'ChileCompra - Mercado Público',
      as_of: '2026-09-03',
      limitaciones: [
        {
          limitacion: 'Compra Ágil no aparece acá porque no genera una licitación: es un mecanismo de compra directa. Sus órdenes sí están en la base.',
          severidad: 'media'
        }
      ]
    };
    this.totalServidor = 0;
    this.idPeticionVigente = 0; // descarta respuestas tardias de busquedas viejas
    this.haBuscado = false;

    // Filtros activos
    this.filtros = {
      texto: '',
      soloAbiertas: true, // activo por defecto (Sección 6.2)
      region: '',
      monto: ''
    };

    // Referencias al DOM
    this.dom = {
      searchForm: document.getElementById('searchForm'),
      searchInput: document.getElementById('searchInput'),
      resultsLayout: document.getElementById('resultsLayout'),
      filterBar: document.getElementById('filterBar'),
      filterAbiertas: document.getElementById('filterAbiertas'),
      filterRegion: document.getElementById('filterRegion'),
      filterMonto: document.getElementById('filterMonto'),
      filterReset: document.getElementById('filterReset'),
      resultsContainer: document.getElementById('resultsContainer'),
      resultsCount: document.getElementById('resultsCount'),
      metricsSidebar: document.getElementById('metricsSidebar'),
      suggestionChips: document.querySelectorAll('.suggestion-chip'),
      footerAsOfDate: document.getElementById('footerAsOfDate'),
      footerLimitaciones: document.getElementById('footerLimitaciones'),

      // Modal de detalle de la licitación
      tenderModal: document.getElementById('tenderModal'),
      modalCloseBtn: document.getElementById('modalCloseBtn'),
      modalFooterCloseBtn: document.getElementById('modalFooterCloseBtn'),
      modalTenderTitle: document.getElementById('modalTenderTitle'),
      modalTenderTipo: document.getElementById('modalTenderTipo'),
      modalTenderUrgencia: document.getElementById('modalTenderUrgencia'),
      modalTenderOrganismo: document.getElementById('modalTenderOrganismo'),
      modalTenderRegion: document.getElementById('modalTenderRegion'),
      modalTenderCodigo: document.getElementById('modalTenderCodigo'),
      modalCopyCodeBtn: document.getElementById('modalCopyCodeBtn'),
      modalTenderBody: document.getElementById('modalTenderBody'),
      modalMpLink: document.getElementById('modalMpLink')
    };

    // Estado visual inicial: el hero arranca centrado (patron Chrome) y sube al
    // buscar. Las clases viven en <body> para que el CSS pueda alcanzar tanto al
    // hero como a la columna de resultados desde un solo interruptor.
    document.body.classList.add('buscador-inicial');

    this.inicializar();
  }

  async inicializar() {
    this.vincularEventos();
    this.poblarRegiones();

    // Llamada minima solo para tener meta.as_of real en el pie antes de que el
    // usuario busque nada (Sección 6.1: sin resultados visibles todavia).
    // limite:1 porque no se muestra nada de esto, solo se lee meta y total.
    try {
      const resp = await buscarLicitacionesBackend({ texto: '', solo_abiertas: true, limite: 1 });
      this.meta = resp.meta || this.meta;
      this.totalServidor = resp.total || 0;

      if (this.dom.footerAsOfDate && this.meta.as_of) {
        this.dom.footerAsOfDate.textContent = formatearFechaLarga(this.meta.as_of);
      }
      this.renderizarLimitacionesFooter();
    } catch (err) {
      // No bloquea la pantalla: si el backend esta caido, se descubre recien
      // cuando el usuario busca (mostrarErrorCarga en ejecutarBusqueda).
      console.warn('No se pudo precargar meta.as_of:', err);
    }

    // Si hay un query en la URL (ej: ?q=inteligencia+artificial), ejecutar de inmediato
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q') || urlParams.get('texto');
    if (queryParam) {
      this.dom.searchInput.value = queryParam;
      this.ejecutarBusqueda(queryParam);
    }
  }

  poblarRegiones() {
    REGIONES_OFICIALES.forEach(reg => {
      const opt = document.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      this.dom.filterRegion.appendChild(opt);
    });
  }

  renderizarLimitacionesFooter() {
    if (!this.dom.footerLimitaciones) return;

    const limitaciones = (this.meta && this.meta.limitaciones && Array.isArray(this.meta.limitaciones))
      ? this.meta.limitaciones
      : [];

    // Redacción obligatoria exacta para Compra Ágil (Sección 3 y Buzón)
    const textoObligatorioCompraAgil = 'Compra Ágil no aparece acá porque no genera una licitación: es un mecanismo de compra directa. Sus órdenes sí están en la base.';

    let htmlLimitaciones = `
      <p class="footer-compra-agil-note">
        <strong>Nota de cobertura:</strong> ${textoObligatorioCompraAgil}
      </p>
    `;

    // Renderizar limitaciones adicionales si existen en el bloque meta
    limitaciones.forEach(lim => {
      const desc = lim.limitacion || (typeof lim === 'string' ? lim : '');
      if (desc && !desc.includes('Compra Ágil')) {
        htmlLimitaciones += `
          <p class="footer-compra-agil-note">
            <strong>Limitación adicional (${lim.severidad || 'aviso'}):</strong> ${desc}
          </p>
        `;
      }
    });

    this.dom.footerLimitaciones.innerHTML = htmlLimitaciones;
  }

  vincularEventos() {
    // Envío del formulario de búsqueda
    this.dom.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = this.dom.searchInput.value.trim();
      this.ejecutarBusqueda(query);
    });

    // Clics en sugerencias rápidas
    this.dom.suggestionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.dataset.query || chip.textContent.replace(/^"|"$/g, '').trim();
        this.dom.searchInput.value = query;
        this.ejecutarBusqueda(query);
      });
    });

    // Filtro: Sólo abiertas
    this.dom.filterAbiertas.addEventListener('change', (e) => {
      this.filtros.soloAbiertas = e.target.checked;
      this.aplicarFiltrosYRenderizar();
    });

    // Filtro: Región
    this.dom.filterRegion.addEventListener('change', (e) => {
      this.filtros.region = e.target.value;
      this.aplicarFiltrosYRenderizar();
    });

    // Filtro: Monto
    this.dom.filterMonto.addEventListener('change', (e) => {
      this.filtros.monto = e.target.value;
      this.aplicarFiltrosYRenderizar();
    });

    // Restablecer filtros
    if (this.dom.filterReset) {
      this.dom.filterReset.addEventListener('click', () => {
        this.filtros.soloAbiertas = true;
        this.filtros.region = '';
        this.filtros.monto = '';
        this.dom.filterAbiertas.checked = true;
        this.dom.filterRegion.value = '';
        this.dom.filterMonto.value = '';
        this.aplicarFiltrosYRenderizar();
      });
    }

    // Delegación para botones de copiar código
    this.dom.resultsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-copy-code');
      if (btn) {
        const code = btn.dataset.code;
        this.copiarAlPortapapeles(code, btn);
      }
    });

    // Delegación para botón "Ver detalle de la licitación" (Destino principal nuevo)
    this.dom.resultsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-ver-detalle');
      if (btn) {
        const codigo = btn.dataset.codigo;
        this.abrirModalDetalle(codigo, btn);
      }
    });

    // Cierre del modal
    if (this.dom.modalCloseBtn) {
      this.dom.modalCloseBtn.addEventListener('click', () => this.cerrarModalDetalle());
    }
    if (this.dom.modalFooterCloseBtn) {
      this.dom.modalFooterCloseBtn.addEventListener('click', () => this.cerrarModalDetalle());
    }
    if (this.dom.tenderModal) {
      this.dom.tenderModal.addEventListener('click', (e) => {
        if (e.target === this.dom.tenderModal) {
          this.cerrarModalDetalle();
        }
      });
    }
    if (this.dom.modalCopyCodeBtn) {
      this.dom.modalCopyCodeBtn.addEventListener('click', () => {
        const code = this.dom.modalTenderCodigo.textContent.trim();
        this.copiarAlPortapapeles(code, this.dom.modalCopyCodeBtn);
      });
    }

    // Tecla Escape para cerrar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dom.tenderModal && !this.dom.tenderModal.hidden) {
        this.cerrarModalDetalle();
      }
    });
  }

  ejecutarBusqueda(query) {
    this.filtros.texto = query;
    this.haBuscado = true;

    // Sección 6.1 y 6.2: Los filtros y resultados aparecen DESPUÉS de buscar
    if (this.dom.resultsLayout) {
      this.dom.resultsLayout.hidden = false;
    }
    if (this.dom.filterBar) {
      this.dom.filterBar.hidden = false;
    }

    // El hero sube. Una sola vez: en la segunda búsqueda ya está arriba y
    // volver a animarlo sería un salto sin motivo.
    document.body.classList.remove('buscador-inicial');
    document.body.classList.add('buscador-con-resultados');
    this.anclarCajaBusqueda();

    // Aplicar filtros y renderizar
    this.aplicarFiltrosYRenderizar();

    // Scroll suave hacia los resultados si es pantalla chica
    if (window.innerWidth < 768 && this.dom.filterBar) {
      this.dom.filterBar.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Deja la caja de búsqueda pegada justo debajo del header, a la altura del
   * rótulo "Buscador de licitaciones públicas", y le pone sombra sólo cuando
   * de verdad hay scroll.
   *
   * El desplazamiento se mide del header real en vez de dejarlo fijo en CSS:
   * el header cambia de alto entre escritorio y móvil, y un valor a ojo
   * dejaría la caja tapada o flotando con un hueco.
   */
  anclarCajaBusqueda() {
    if (this.anclajeListo) return;
    this.anclajeListo = true;

    const header = document.querySelector('.pub-header');
    const caja = this.dom.searchInput ? this.dom.searchInput.closest('.search-form-container') : null;
    if (!header || !caja) return;

    const ajustar = () => {
      caja.style.top = header.getBoundingClientRect().height + 'px';
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    // La sombra sólo cuando la página está desplazada: fija, sobre contenido
    // que no scrollea, lee como un error de capas.
    const alScroll = () => {
      document.body.classList.toggle('hay-scroll', window.scrollY > 8);
    };
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
  }

  // texto/solo_abiertas/region los aplica el backend (Sección 4-bis). El único
  // filtro que sigue siendo de cliente es 'monto': el contrato del endpoint no
  // lo tiene (ver docs/architecture/publica-buscador.md §4.1), así que sólo
  // acota la página ya traída — no vuelve a pedir con un total distinto.
  async aplicarFiltrosYRenderizar() {
    if (!this.haBuscado) return;

    const idPeticion = ++this.idPeticionVigente;
    // [OBSERVADO] la búsqueda responde en ~150 ms: sin señal de progreso el
    // cambio es tan rápido que el usuario no percibe que pasó algo. La barra y
    // el atenuado de los resultados viejos dan ese acuse de recibo.
    document.body.classList.add('buscador-cargando');
    try {
      const resp = await buscarLicitacionesBackend({
        texto: this.filtros.texto,
        solo_abiertas: this.filtros.soloAbiertas,
        region: this.filtros.region || null,
        limite: 50
      });

      // Una respuesta tardía de una búsqueda vieja no debe pisar la de una
      // más nueva si el usuario tipeó rápido.
      if (idPeticion !== this.idPeticionVigente) return;

      this.datasetCompleto = resp.resultados || [];
      this.metricas = resp.metricas || null;
      this.meta = resp.meta || this.meta;
      this.totalServidor = resp.total || 0;

      const fechaBase = this.meta.as_of || '2026-09-03';
      const resultadosFiltrados = filtrarResultados(this.datasetCompleto, this.filtros, fechaBase);
      this.renderizarResultados(resultadosFiltrados);

      if (this.dom.metricsSidebar && this.metricas) {
        this.dom.metricsSidebar.innerHTML = renderizarMetricasLateral(this.metricas, this.meta);
      }
      this.renderizarLimitacionesFooter();
    } catch (err) {
      if (idPeticion !== this.idPeticionVigente) return;
      console.error('Error buscando en el backend:', err);
      this.mostrarErrorCarga(err.message);
    } finally {
      // Sólo la petición vigente apaga el indicador: si una vieja termina
      // después, apagarlo dejaría la barra quieta con una búsqueda en curso.
      if (idPeticion === this.idPeticionVigente) {
        document.body.classList.remove('buscador-cargando');
      }
    }
  }

  renderizarResultados(items) {
    const fechaBase = this.meta.as_of || '2026-09-03';

    // Actualizar encabezado del contador (Sección 6.2: "83 licitaciones encontradas")
    this.dom.resultsCount.innerHTML = formatearContadorResultados(
      items.length,
      this.filtros.soloAbiertas,
      this.filtros.region,
      this.filtros.monto,
      this.totalServidor
    );

    // Si no hay resultados
    if (items.length === 0) {
      this.dom.resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><svg class="ico" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <h3 class="empty-state-title">No encontramos licitaciones públicas</h3>
          <p class="empty-state-desc">
            No hay licitaciones que coincidan con los filtros seleccionados.
            Prueba desactivando "Sólo abiertas" o seleccionando otra región.
          </p>
        </div>
      `;
      return;
    }

    // Renderizar tarjetas con las 7 capas visuales obligatorias (Sección 6.3) y detalle de la licitación
    const htmlCards = items.map(item => {
      const det = this.detalles[item.codigo] || item.detalle || null;
      return generarHtmlTarjeta(item, fechaBase, det);
    }).join('');

    this.dom.resultsContainer.innerHTML = htmlCards;
  }

  async abrirModalDetalle(codigo, btnTrigger = null) {
    if (!this.dom.tenderModal) return;
    this.ultimoElementoFoco = btnTrigger || document.activeElement;

    const item = this.datasetCompleto.find(it => it.codigo === codigo) || null;
    let detalle = this.detalles[codigo] || (item && item.detalle) || null;

    if (!detalle) {
      try {
        detalle = await obtenerDetalleLicitacion(codigo, this.detalles);
        if (detalle) {
          this.detalles[codigo] = detalle;
          if (item) item.detalle = detalle;
        }
      } catch (err) {
        console.warn(`No se pudo cargar detalle para ${codigo}:`, err);
      }
    }

    const fechaBase = this.meta.as_of || '2026-09-03';
    const modalData = renderizarModalDetalle(codigo, item, detalle, fechaBase);

    this.dom.modalTenderTitle.textContent = modalData.titulo;
    this.dom.modalTenderTipo.textContent = modalData.tipoCompleto;
    if (modalData.cierre) {
      this.dom.modalTenderUrgencia.className = `urgencia-badge ${modalData.cierre.claseCss}`;
      this.dom.modalTenderUrgencia.innerHTML = `<span class="badge-dot"></span><span>${modalData.cierre.texto}</span>`;
      this.dom.modalTenderUrgencia.style.display = '';
    } else {
      this.dom.modalTenderUrgencia.style.display = 'none';
    }
    this.dom.modalTenderOrganismo.textContent = modalData.organismo;
    this.dom.modalTenderRegion.textContent = modalData.region;
    this.dom.modalTenderCodigo.textContent = modalData.codigo;
    this.dom.modalTenderBody.innerHTML = modalData.bodyHtml;
    this.dom.modalMpLink.href = modalData.urlMp;

    // Resetear estado del botón de copiar en el modal si quedó en ✓ Copiado
    if (this.dom.modalCopyCodeBtn) {
      this.dom.modalCopyCodeBtn.textContent = 'Copiar';
      this.dom.modalCopyCodeBtn.classList.remove('copied');
      delete this.dom.modalCopyCodeBtn.dataset.originalText;
    }

    this.dom.tenderModal.hidden = false;
    document.body.classList.add('modal-open');

    // Accesibilidad: transferir foco al botón de cerrar
    if (this.dom.modalCloseBtn) {
      this.dom.modalCloseBtn.focus();
    }
  }

  cerrarModalDetalle() {
    if (!this.dom.tenderModal) return;
    this.dom.tenderModal.hidden = true;
    document.body.classList.remove('modal-open');

    // Accesibilidad: restaurar foco al elemento que activó el modal
    if (this.ultimoElementoFoco && typeof this.ultimoElementoFoco.focus === 'function') {
      this.ultimoElementoFoco.focus();
    }
  }

  generarHtmlTarjeta(item, fechaBase, detalle) {
    return generarHtmlTarjeta(item, fechaBase, detalle);
  }

  async copiarAlPortapapeles(texto, botonElemento) {
    if (!texto || !botonElemento) return;

    // Preservar texto original de forma inmutable frente a clics rápidos repetidos
    if (!botonElemento.dataset.originalText) {
      botonElemento.dataset.originalText = botonElemento.textContent.includes('Copiado')
        ? 'Copiar'
        : (botonElemento.textContent.trim() || 'Copiar');
    }
    const textoOriginal = botonElemento.dataset.originalText;

    let copiadoExitoso = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        copiadoExitoso = true;
      } else {
        throw new Error('Clipboard API no disponible o contexto no seguro');
      }
    } catch {
      try {
        const inputTemp = document.createElement('textarea');
        inputTemp.value = texto;
        inputTemp.style.position = 'fixed';
        inputTemp.style.opacity = '0';
        inputTemp.style.left = '-9999px';
        document.body.appendChild(inputTemp);
        inputTemp.focus();
        inputTemp.select();
        copiadoExitoso = document.execCommand('copy');
        document.body.removeChild(inputTemp);
      } catch (err) {
        console.warn('Error en copiado al portapapeles:', err);
      }
    }

    if (copiadoExitoso) {
      botonElemento.textContent = '✓ Copiado';
      botonElemento.classList.add('copied');

      if (botonElemento._copyTimeout) {
        clearTimeout(botonElemento._copyTimeout);
      }

      botonElemento._copyTimeout = setTimeout(() => {
        botonElemento.textContent = textoOriginal;
        botonElemento.classList.remove('copied');
        delete botonElemento.dataset.originalText;
        delete botonElemento._copyTimeout;
      }, 1800);
    }
  }

  mostrarErrorCarga(mensaje) {
    if (this.dom.resultsContainer) {
      this.dom.resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><svg class="ico" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <h3 class="empty-state-title">No fue posible cargar los datos</h3>
          <p class="empty-state-desc">Detalle del error: ${mensaje}</p>
        </div>
      `;
    }
  }
}

// Inicializar la aplicación cuando el DOM esté listo en entorno navegador
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.appBuscador = new BuscadorPublicaApp();
  });
}

// Exportación para pruebas en entornos Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizarTextoVisual,
    quitarTildes,
    coincideBusqueda,
    filtrarResultados,
    formatearContadorResultados,
    generarHtmlTarjeta,
    formatearFechaCorta,
    formatearFechaLarga,
    evaluarCierre,
    formatearMonto,
    formatearReferenciaHistorica,
    formatearItemsMasticados,
    renderizarMetricasLateral,
    renderizarModalDetalle,
    obtenerNombreTipo,
    GLOSARIO_TIPOS,
    BuscadorPublicaApp
  };
}
