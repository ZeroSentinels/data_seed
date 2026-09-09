# SMTP propio para el auth de Supabase

Estado al **2026-09-08**. Todo lo que dice "medido" se comprobó ejecutando.

## Por qué existe este documento

El SMTP integrado de Supabase permite **2 correos por hora**. Con esa cuota,
cualquier alta self-serve real es inviable: dos registros seguidos y el tercero
se rechaza durante una hora.

**Medido** en `auth_logs` del proyecto `pgmfppykgpqpzcoswszv`, 2026-09-08 UTC:

```
11:55:21  /signup  OK   + mail.send
11:55:23  /signup  429  "For security purposes, you can only request this after 57 seconds."
11:57:13  /signup  OK   + mail.send
11:58:10  /signup  429  "email rate limit exceeded"
   … 15 rechazos consecutivos hasta 12:01:48
```

Dos envíos en la ventana horaria y el tercer intento bloqueado. Los 15
reintentos son el usuario obedeciendo el mensaje de error de entonces, que decía
"intenta nuevamente" — corregido en el PR #43, que ahora responde 429 con
`Retry-After` y dice que la cuenta no se creó.

**El PR #43 arregla el mensaje, no la cuota.** Esto es la cuota.

## El acoplamiento que define el orden

Supabase **no permite editar el límite de correos por hora mientras el proyecto
use su servicio de correo por defecto**. El campo de rate limit se habilita
recién cuando hay SMTP propio configurado. Tampoco permite editar las plantillas
de correo con el servicio por defecto.

Consecuencia: el SMTP propio no es una mejora opcional de entregabilidad. Es el
prerrequisito para que el self-serve funcione y para que el correo de
confirmación lleve la marca de DataSeed.

## Estado medido del DNS de `dataseed.cl`

| Registro | Valor | Implicancia |
|---|---|---|
| `dataseed.cl` TXT (SPF) | `v=spf1 include:_spf.google.com ~all` | **Solo Google Workspace está autorizado a enviar.** Cualquier proveedor nuevo sale como no autorizado. |
| `dataseed.cl` MX | `aspmx.l.google.com` + 4 `alt*` | Correo entrante en Google Workspace. **No tocar.** |
| `_dmarc.dataseed.cl` | **ausente** | Sin política DMARC. |
| `resend._domainkey`, `google._domainkey`, `default._domainkey`, `selector1._domainkey` | **ausentes** | Sin DKIM de ningún proveedor. |
| `send.dataseed.cl`, `mail.dataseed.cl` | **ausentes** | Subdominio de envío libre. |

Verificado filtrando por tipo de registro. **Trampa medida:** `Resolve-DnsName`
devuelve el SOA de la zona sin lanzar excepción cuando el nombre existe pero no
tiene TXT, así que un chequeo que solo mira si hubo error reporta los cuatro
selectores DKIM como presentes. Hay que filtrar `Where-Object { $_.Type -eq
'TXT' }` o se mide la variable equivocada.

## Proveedor: Resend

Recomendado sobre SES **por tiempo-a-funcionando, no por costo**:

| | Resend | Amazon SES |
|---|---|---|
| Arranque | Operativo tras verificar el dominio | **Sandbox**: 200/día y solo a destinatarios verificados |
| Salir del arranque | — | Ticket de aprobación de AWS, con espera |
| Gratis | 3.000 correos/mes | 62.000/mes desde EC2, si ya se salió del sandbox |
| DKIM | 1 registro TXT que entrega la consola | 3 CNAME |
| A escala | Más caro | Más barato |

El volumen de un self-serve que hoy tiene 3 usuarios no toca el techo de
ninguno. Si más adelante el volumen lo justifica, migrar a SES es cambiar el
host y las credenciales SMTP; la plantilla y el código no cambian.

## Pasos

### 1 · Verificar el dominio en Resend — **lo hace Daniel**

Crear cuenta, agregar `dataseed.cl` y **elegir `send.dataseed.cl` como
subdominio de envío**, no el apex.

> **Esto es lo que no hay que equivocar:** si se configura el envío sobre el
> apex, Resend pide reemplazar el SPF y se rompe el correo de Google Workspace
> de toda la empresa. Con subdominio, el SPF del apex queda intacto y el de
> `send.` es independiente.

La consola entrega tres registros. Agregarlos en el DNS de `dataseed.cl`:

| Nombre | Tipo | Valor |
|---|---|---|
| `send` | MX | `feedback-smtp.<región>.amazonses.com`, prioridad 10 |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` |
| `resend._domainkey` | TXT | la clave pública que muestra la consola |

La región y la clave las da la consola; no inventarlas.

### 2 · DMARC — **lo hace Daniel, junto con el paso 1**

Agregar `_dmarc.dataseed.cl` TXT:

```
v=DMARC1; p=none; rua=mailto:dmarc@dataseed.cl
```

**Arrancar en `p=none`.** Sirve para recibir informes y ver qué se está enviando
en nombre del dominio antes de rechazar nada. Pasar a `p=quarantine` recién
cuando los informes muestren que todo el correo legítimo pasa SPF o DKIM
alineado — endurecerlo antes bota correo real, incluido el de Google Workspace.

### 3 · SMTP en Supabase — **lo hace Daniel**

Dashboard → Project Settings → Authentication → SMTP Settings:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Puerto | `465` (TLS implícito) o `587` (STARTTLS) |
| Usuario | `resend` |
| Contraseña | la API key de Resend |
| Sender email | `no-reply@send.dataseed.cl` |
| Sender name | `DataSeed` |

La API key **no se pega en ningún archivo del repo ni en el env de Vercel**:
vive solo en la configuración de Supabase. Ver
`docs/security/secret-policy.md`.

### 4 · Subir el límite de correos — **lo hace Daniel, y es el paso que resuelve el bug**

Recién ahora el campo está editable. Dashboard → Authentication → Rate Limits →
correos por hora. Subirlo a un valor acorde al alta esperada; con SMTP propio el
techo lo pone el plan de Resend, no Supabase.

Sin este paso los tres anteriores mejoran la entregabilidad y no arreglan nada
de lo que motivó el documento.

### 5 · Plantilla del correo de confirmación — **rescatada**

`supabase/email-templates/confirm-signup.html` se había escrito en la rama
`feat/publica-buscador-conectado` (commit `7f80581`) pero no había llegado a
`main` (el PR #41 mergeó `e1eeac7`, anterior a ese commit — junto con el botón
de "Cerrar sesión" del mismo commit). Repuesta con el mismo contenido en
`feat/publica-buscador-perfil-guardado`. Ya se puede pegar en
Authentication → Emails → Templates → Confirm signup.

## Verificación, después de aplicar

1. **DNS propagado.** Los tres registros del paso 1 resuelven, filtrando por
   tipo: `Resolve-DnsName -Name resend._domainkey.dataseed.cl -Type TXT | Where-Object { $_.Type -eq 'TXT' }`.
   Sin el filtro el chequeo miente (ver la trampa arriba).
2. **El correo sale por el proveedor nuevo.** Un signup de prueba y revisar la
   cabecera `Authentication-Results` del correo recibido: tiene que decir
   `dkim=pass` con `header.d=dataseed.cl` o `send.dataseed.cl`.
3. **El SPF del apex sigue intacto.** `v=spf1 include:_spf.google.com ~all`, sin
   cambios. Si aparece `amazonses.com` en el apex, el paso 1 se hizo sobre el
   dominio equivocado.
4. **La cuota subió, medido y no supuesto.** Tres signups seguidos con correos
   distintos. Antes el tercero devolvía 429; ahora los tres tienen que dar 200.
   Confirmarlo en `auth_logs`: tres `mail.send` en la misma hora, cero
   `email rate limit exceeded`.
5. **El correo de Google Workspace sigue llegando.** Enviar y recibir un correo
   a una dirección `@dataseed.cl`. Es el control negativo del paso 1: si se
   rompió el SPF del apex, se detecta acá.

## Lo que este documento no resuelve

**El registro de Pública puede entrar al portal de clientes.** Marcado como
abierto y urgente en `docs/security/service-role-key-decision.md`:
`authorization.js` exige exactamente una membresía activa y **no distingue
`organizations.plan` ni `organizations.type`**. Un alta self-serve queda con
exactamente una membresía activa en su propia organización, así que satisface la
condición del portal general. Subir la cuota de correos multiplica las altas
self-serve, y con ellas la exposición de este agujero. No es causado por el SMTP,
pero el SMTP lo escala.
