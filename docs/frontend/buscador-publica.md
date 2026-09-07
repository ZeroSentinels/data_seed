# Buscador de Pública — guía para el equipo de frontend

Lo que hay que saber para tocar `/publica-buscador` sin romper nada. El contrato
de datos está en [`../architecture/publica-buscador.md`](../architecture/publica-buscador.md);
esto es la parte de interfaz.

**Reglas del repositorio:** [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
No se pushea directo a `main` ni a `preview/*` — PR obligatorio y CI en verde.

---

## 1. Los cuatro archivos

| Archivo | Qué es |
|---|---|
| `site/publica-buscador.html` | markup. Header pegajoso, hero, resultados en dos columnas, modal de detalle |
| `site/publica-buscador.js` | toda la lógica: llamadas al backend, render, filtros, estados de animación |
| `site/publica-buscador.css` | estilos y animaciones |
| `api/buscar.js`, `api/licitacion/[codigo].js` | funciones de Vercel que proxean al backend. **La llave vive en `process.env.MP_API_KEY`, nunca en el HTML** |

El buscador **no** usa framework ni bundler. Es HTML, CSS y JS servidos tal cual.

---

## 2. Reglas de contenido que no son negociables

Vienen del contrato y hay una razón medida detrás de cada una. Romperlas hace
que el producto muestre algo falso.

### 2.1 El hueco se declara, no se rellena

`[MEDIDO]` **El 46,1 % de las licitaciones abiertas no publica monto.** No es un
dato faltante nuestro: el organismo lo esconde mientras recibe ofertas y lo
publica al adjudicar.

- **Nunca** `$0`, **nunca** `—`, **nunca** en blanco.
- Se escribe **"Monto no publicado por el organismo"**.
- El campo que lo distingue es `visibilidad_monto`. `false` = lo ocultaron;
  `null` en el monto sin ese `false` sería otra cosa.

### 2.2 Ningún número absoluto va escrito en el código

Las cifras se mueven todos los días. Todo sale de la respuesta del endpoint. Si
ves un número escrito a mano en el HTML o el JS, es un bug esperando.

### 2.3 El frontend NO decide si un dato alcanza para llamarse "mediana"

El backend lo declara y el frontend lo lee:

```js
const comp = metricas.competencia;
comp.suficiente_para_mediana   // true | false | undefined
comp.oferentes_mediana         // null cuando no alcanza
comp.motivo_sin_dato           // por qué no alcanza
```

**Por qué existe esta regla:** alguien buscó `fermin` — una palabra sin
significado de rubro. La pantalla mostró **cero resultados** y aun así una
tarjeta que decía *"2 oferentes mediana — Medido sobre 4 licitaciones del
rubro"*. Tres mentiras a la vez: una mediana sobre n=4 es precisión falsa, el
universo no era "del rubro" (eran transporte escolar, luminarias y un
laboratorio, unidas por el nombre propio *"Liceo Fermín del Real"*), y no había
nada en pantalla que medir. **La palabra "rubro" la agregaba el frontend por su
cuenta.**

Si `oferentes_mediana` es `null`, **la tarjeta no se dibuja.**

### 2.4 `as_of` y `actualizado_en` son cosas distintas

| campo | qué es |
|---|---|
| `meta.as_of` | hasta qué día hay licitaciones publicadas — **cobertura de datos** |
| `meta.actualizado_en` | cuándo corrió la ingesta, con hora, en UTC — **frescura del sistema** |

Confundirlos engaña: un día `as_of` decía `2026-09-04` mientras la ingesta había
corrido esa misma madrugada. El pie muestra los dos por separado y convierte
`actualizado_en` a hora de **Chile fija** (`America/Santiago`), no la del
navegador — el mismo dato no debe leerse distinto según dónde esté el usuario.

### 2.5 Compra Ágil y el texto de cobertura

- **Nunca** escribir *"todas las licitaciones de Mercado Público"*. Se dice
  **"licitaciones públicas"**.
- Si hay que explicar la ausencia de Compra Ágil, con esta redacción exacta:
  *"Compra Ágil no aparece acá porque no genera una licitación: es un mecanismo
  de compra directa. Sus órdenes sí están en la base."*

### 2.6 Fuera de alcance de esta pantalla

No se dibujan, aunque aparezcan en material comercial: alertas, resumen de bases
con IA, predicción de precio, score de probabilidad de ganar, chat. **Ninguno
está construido.**

---

## 3. Lenguaje

- **Español de Chile.** No voseo rioplatense: `Busca`, no `Buscá`; `Prueba`, no
  `Probá`. Ya se corrigió una vez.
- **Sin jerga interna.** La palabra *"masticado"* llegó del nombre de una sección
  de la spec y terminó en la interfaz del cliente **y en nombres de clase CSS**
  (41 ocurrencias). Se dice *"detalle de la licitación"* e *"ítems solicitados"*.
  > **Costó cuatro pasadas**, porque las tres primeras reemplazaron *las formas
  > que uno recuerda* — quedaron `masticada` (femenino), `Masticados`
  > (capitalizado) y `MASTICADO` (mayúscula sostenida). Para sacar una palabra:
  > barrido **insensible a mayúsculas** y verificar que quede en cero. Adivinar
  > flexiones no es un método.
- **Registro profesional.** Es una herramienta de trabajo para alguien que
  decide si presenta una oferta, no una app de consumo.

## 4. Iconos

**Sin emojis.** Se usa SVG de trazo, del mismo sistema en todo el archivo:

```html
<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round"
     stroke-linejoin="round" aria-hidden="true"> … </svg>
```

`currentColor` es clave: hereda el color del contexto y funciona en tema claro y
oscuro sin duplicar reglas. Un emoji se renderiza distinto en cada sistema
operativo y lee como plantilla genérica.

**Excepción, y son sólo cuatro:** el sol y la luna del selector de tema
(replican el sitio), la cruz de cerrar el modal y el visto de "Copiado".

---

## 5. Estados de animación

El JS pone clases en `<body>` y el CSS reacciona. Un solo interruptor.

| clase | cuándo | qué hace |
|---|---|---|
| `buscador-inicial` | al cargar | hero desplazado hacia abajo, centrado en pantalla |
| `buscador-con-resultados` | tras la primera búsqueda, **para siempre** | hero arriba, caja pegada bajo el header, subtítulo y sugerencias colapsados |
| `buscador-cargando` | mientras la petición está en vuelo | barra de progreso en la caja, resultados viejos al 45 % |
| `hay-scroll` | `window.scrollY > 8` | sombra bajo la caja pegada |

`buscador-con-resultados` **no se quita**: en la segunda búsqueda el hero ya está
arriba y volver a animarlo sería un salto sin motivo.

### 5.1 Por qué el hero se mueve con `transform`

Porque es lo correcto para desplazar un bloque: se compone en GPU y no obliga al
navegador a recalcular geometría en cada frame. Animar `padding` o `min-height`
sí lo obliga.

El alto útil del estado inicial lo reserva `.buscador-inicial .pub-main` con
`min-height`, porque `transform` no ocupa espacio en el flujo.

### 5.2 Trampa medida: no midas animaciones en una pestaña oculta

`[MEDIDO 2026-09-07]` Tres diagnósticos consecutivos concluyeron —con
"[MEDIDO]" adelante— que las transiciones del hero quedaban colgadas para
siempre. **Los tres eran falsos.** Se medía con el panel del navegador oculto:

```
document.hidden = true
document.timeline.currentTime = 0   (congelado)
requestAnimationFrame = 0 frames en 1,5 s
```

Una página que no compone frames **no avanza el reloj de animaciones**, así que
toda transición queda en `playState: 'running'` con `currentTime: 0`, sea de
layout o de `transform`.

**Antes de concluir que una animación no corre, verificá `document.hidden` y que
`requestAnimationFrame` entregue frames.** `getComputedStyle` sobre una pestaña
oculta no dice nada.

### 5.2-bis `position: sticky` está limitado por el alto de su padre

`[MEDIDO 2026-09-07]` La caja de búsqueda se despegaba y volvía a irse a los
~150 px de scroll. Causa: el sticky estaba en `.search-form-container`, que vive
en `.search-hero`, y **un elemento sticky sólo se queda pegado mientras su padre
está en pantalla**. El hero colapsa a ~150 px en el estado con resultados, así
que ése era todo el recorrido disponible.

**El sticky va en `.search-hero` completo**, cuyo padre `.pub-main` sí es alto.
Si mañana hay que pegar otra cosa, la pregunta es siempre: *¿qué tan alto es el
padre?*

Los desplazamientos (`top`) los **mide el JS** de los elementos reales
(`anclarCajaBusqueda()`), no están fijos en CSS: header y hero cambian de alto
entre escritorio y móvil, y un valor a ojo deja el lateral tapado o flotando.
Los valores del CSS son sólo el respaldo por si el JS no corre.

### 5.3 Respeto por `prefers-reduced-motion`

Todo el movimiento se apaga. El movimiento es una ayuda, no un requisito, y para
quien lo desactivó es una molestia. Si agregás una animación, agregala también al
bloque `@media (prefers-reduced-motion: reduce)`.

---

## 6. Lateral de métricas

`position: sticky` en el `<aside>`, y el **scroll dentro de `.sidebar-inner`** —
la tarjeta — no en el `<aside>` que la contiene.

`[MEDIDO 2026-09-07]` Con el `overflow` en el `<aside>`, el recorte caía sobre la
tarjeta y le cortaba **el borde y las esquinas redondeadas arriba y abajo**: se
veía como contenido tajeado, no como una tarjeta con scroll. Scrolleando por
dentro, el marco queda quieto y sólo se mueve el contenido.

**Barra oculta** en Firefox, Edge y WebKit. Ocultarla **no** quita la capacidad
de desplazarse: rueda, teclado y gesto táctil siguen funcionando.

El `max-height` lo calcula el JS del viewport disponible y **se re-mide tras cada
render**: el lateral se reemplaza entero en cada búsqueda, así que un
`max-height` puesto una sola vez queda apuntando a un elemento que ya no existe.

Bajo 1024 px el lateral vuelve a fluir con el contenido: fijarlo ahí lo dejaría
como una ventana diminuta con scroll, peor que dejarlo largo.

---

## 7. Antes de abrir un PR

```sh
npm run check          # 63 pruebas, tienen que quedar en verde
./scripts/ci/scan-secrets.sh
```

**Si agregás una ruta a `vercel.json`, hay que actualizar
`tests/deployment/topology.test.js`** — compara la lista completa de `rewrites`
con `deepEqual` a propósito, para que una ruta nueva no ensombrezca al sitio
estático ni a las funciones de `api/`. Ya se rompió una vez.

### 7.1 Verificá las clases CSS que escribís

`[MEDIDO]` Dos clases inventadas (`results-count-bar`, `results-column`) no
existían en el markup; las reales eran `results-count-row` y `results-main-col`.
**Las animaciones simplemente no se aplicaban y nada lo señalaba.** Un selector
que no matchea no da error: falla en silencio.

---

## 8. Pendientes conocidos

| Pendiente | Estado |
|---|---|
| **Paginación** | El endpoint acepta `desde` y pagina de a `limite` (máx. 50). El frontend pide 50 fijo y no tiene botón de "ver más": con `total: 2255` el usuario ve 50 y no hay forma de ver el resto |
| **Mostrar `via`** | Cada resultado trae `via: ["fts"\|"rubro"\|"texto"]` — qué capa del motor lo encontró. Está en el backend, sin usar en la UI. Un resultado que sólo aparece por `rubro` es una **inferencia**, no una coincidencia literal, y el usuario tiene derecho a saberlo |
| **Deriva de tipografía** | `docs/product/design-system.md` y `tests/deployment/topology.test.js` exigen **Syne**; el sitio real usa **Space Grotesk**. Se replicó lo real. Quien corrija la deriva tiene que tocar los tres lugares |
