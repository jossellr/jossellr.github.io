# Analítica y consentimiento de cookies

La web usa **dos** sistemas de analítica, pensados para cumplir el RGPD y la
guía de cookies de la AEPD (consentimiento previo, rechazo tan fácil como la
aceptación, posibilidad de revocar):

| Herramienta | Cookies | ¿Consentimiento? | Cuándo se carga |
|---|---|---|---|
| **Cloudflare Web Analytics** | No | No necesita | Siempre (en cuanto hay token) |
| **Google Analytics 4** | Sí | Sí, explícito | Solo tras pulsar *Aceptar* |

Mientras los identificadores tengan el valor de ejemplo, **no se carga nada**:
el banner sigue apareciendo para poder probar la experiencia, pero ni Cloudflare
ni GA se activan.

---

## 1. Configurar los identificadores

Edita las dos constantes al principio de [`js/scripts.js`](../js/scripts.js):

```js
var GA_MEASUREMENT_ID = "G-XXXXXXXXXX";        // Google Analytics 4
var CF_BEACON_TOKEN   = "__CLOUDFLARE_TOKEN__"; // Cloudflare Web Analytics
```

### Google Analytics 4 — obtener el `G-XXXXXXXXXX`

1. Entra en <https://analytics.google.com/> con tu cuenta de Google.
2. *Administrar* (rueda dentada) → *Crear* → **Propiedad**.
   - Nombre: p. ej. `jossellr.github.io`.
   - Zona horaria: España. Moneda: EUR.
3. En *Flujos de datos* → *Añadir flujo* → **Web**.
   - URL del sitio web: `https://jossellr.github.io`
   - Nombre del flujo: `Web personal`.
4. Copia el **ID de medición** con formato `G-XXXXXXXXXX`.
5. Pégalo en `GA_MEASUREMENT_ID`.

> No hace falta pegar el snippet `gtag.js` que sugiere Google: el sitio lo
> inyecta solo, y únicamente después de que el visitante acepte.

### Cloudflare Web Analytics — obtener el token

No requiere que el dominio esté en Cloudflare; funciona con un *beacon* JS en
cualquier web (también en GitHub Pages).

1. Entra en <https://dash.cloudflare.com/> (crea cuenta gratis si no tienes).
2. Menú lateral → **Analytics & Logs** → **Web Analytics** → *Add a site*.
3. Hostname: `jossellr.github.io`.
4. Cloudflare te da un snippet como este:
   ```html
   <script defer src='https://static.cloudflareinsights.com/beacon.min.js'
     data-cf-beacon='{"token": "abcd1234..."}'></script>
   ```
   Copia **solo el valor del token** (`abcd1234...`).
5. Pégalo en `CF_BEACON_TOKEN`.

Haz commit y push de `js/scripts.js`. En cuanto GitHub Pages republique, la
analítica queda activa.

---

## 2. Cómo funciona el consentimiento

- **Primera visita sin decisión** → aparece el banner abajo.
  - *Aceptar* → guarda `analytics_consent=granted` en `localStorage`, carga GA4.
  - *Rechazar* → guarda `analytics_consent=denied`, GA4 no se ejecuta nunca.
- **Revocar**: enlace *“Preferencias de cookies”* en el pie reabre el banner.
  Si el usuario tenía GA aceptado y pulsa *Rechazar*, se borran las cookies
  `_ga*` y se recarga la página para detener la recogida.
- Cloudflare se carga al margen del banner (no usa cookies ni guarda nada en el
  navegador, así que la ley no exige consentimiento).

El texto del banner es bilingüe: las cadenas están en
[`data/i18n/es.json`](../data/i18n/es.json) y
[`data/i18n/en.json`](../data/i18n/en.json), sección `cookies`.

---

## 3. Notas legales (orientativas, no asesoramiento jurídico)

- El consentimiento se pide **antes** de cargar GA (opt-in), como exige la AEPD.
- *Rechazar* está al mismo nivel y a un clic, igual que *Aceptar*.
- Se puede **retirar** el consentimiento en cualquier momento desde el pie.
- `theme_pref`, `lang_pref` y `analytics_consent` se guardan en `localStorage`:
  son almacenamiento **técnico/necesario** (recuerdan elecciones del propio
  usuario), exento de consentimiento.
- Si en el futuro añades una **política de privacidad/cookies** como página,
  enlázala desde `cookies.message` (admite HTML) para reforzar la transparencia.

---

## 4. Dónde se ve la actividad

- **GA4**: <https://analytics.google.com/> → tu propiedad → *Informes*.
  Datos en tiempo real en *Informes → En tiempo real*.
- **Cloudflare**: dashboard → *Web Analytics* → tu sitio. Visitas, páginas,
  países y referrers, sin necesidad de cookies.
