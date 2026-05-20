# Pipeline para añadir una publicación

Este documento es la guía paso a paso para incorporar una nueva publicación
(artículo en revista, comunicación en congreso o registro de software) al
sitio, garantizando que el grafo de coautoría, las métricas y los
contadores se mantengan coherentes.

Lo puede seguir tanto una persona como una rutina automatizada.

---

## 1. Elegir el archivo correcto

| Tipo de salida | Archivo |
|---|---|
| Artículo en revista indexada | `data/publications/journals.json` |
| Comunicación en congreso, jornada o seminario | `data/publications/conferences.json` |
| Registro de software o dataset | `data/publications/software.json` |

Cada archivo tiene la forma `{ "items": [ ... ] }`. Las nuevas
publicaciones se añaden al **principio** del array `items` (así
aparecen primero en la web, que ordena por año descendente y luego por
`id`).

---

## 2. Generar un `id` único

Convención: `primerapellido-año-keyword`, todo en kebab-case sin
acentos.

Ejemplos:
- `gaitan-2026-glucose-llm`
- `lopez-2026-uwb-anechoic-chamber`
- `diaz-2025-platera-dataset`

El validador (`scripts/check_publications.py`) avisa si un `id` se
repite entre los tres archivos.

---

## 3. Rellenar la plantilla del tipo correspondiente

### 3.1 Revista (`journals.json`)

```json
{
  "id": "primerautor-año-keyword",
  "title": "Título exacto del artículo",
  "authors": [
    "Apellido Apellido, X. Y.",
    "López Ruiz, J. L."
  ],
  "myPosition": 2,
  "corresponding": false,
  "year": 2026,
  "journal": "Nombre completo de la revista",
  "publisher": "Elsevier",
  "volume": "X",
  "issue": "Y",
  "pages": "1-12",
  "issn": "1234-5678",
  "quartile": "Q1",
  "category": null,
  "impactFactor": 8.9,
  "indexedIn": ["JCR", "Scopus", "SCIE"],
  "doi": "10.1109/JIOT.2026.XXXXXXX",
  "figureUrl": null,
  "featured": false
}
```

**Campos obligatorios**: `id`, `title`, `authors`, `myPosition`, `year`,
`journal`. El resto puede ir a `null` si no se conoce.

### 3.2 Congreso (`conferences.json`)

```json
{
  "id": "acronym-año-keyword",
  "title": "Título de la contribución",
  "authors": ["López Ruiz, J. L.", "Espinilla Estévez, M."],
  "myPosition": 1,
  "corresponding": false,
  "year": 2026,
  "conference": "Nombre completo del congreso",
  "acronym": "ACRONYM",
  "scope": "international",
  "location": "Ciudad, País",
  "date": "2026-MM-DD",
  "doi": null,
  "figureUrl": null
}
```

**Campos obligatorios**: `id`, `title`, `authors`, `myPosition`, `year`,
`conference`, `scope`. `scope` solo admite `"international"` o
`"national"`.

### 3.3 Registro software (`software.json`)

```json
{
  "id": "nombrecorto-año",
  "title": "Nombre completo del software o dataset",
  "authors": ["López Ruiz, J. L.", "Espinilla Estévez, M."],
  "myPosition": 1,
  "year": 2026,
  "registryDate": "2026-MM-DD",
  "registryNumber": "XXXXXXXXXXXXXX",
  "registry": "Registro de la Propiedad Intelectual",
  "country": "España, Andalucía",
  "rightsHolder": "Universidad de Jaén",
  "productType": "Aplicación móvil",
  "description": "Resumen funcional en una o dos frases.",
  "doi": null,
  "figureUrl": null
}
```

**Campos obligatorios**: `id`, `title`, `authors`, `year`,
`registryNumber`, `registry`.

---

## 4. Usar nombres de autor canónicos

El grafo de coautoría fusiona automáticamente nombres que comparten
**primer apellido + inicial del nombre**. Aun así, conviene escribir
siempre la misma forma para que las listas de la tarjeta de
publicación también queden uniformes.

### Lista canónica de colaboradores frecuentes

| Persona | Forma canónica |
|---|---|
| Yo mismo | `López Ruiz, J. L.` |
| Macarena Espinilla | `Espinilla Estévez, M.` |
| David Díaz Jiménez | `Díaz Jiménez, D.` |
| Juan Francisco Gaitán | `Gaitán Guerrero, J. F.` |
| Antonio Pedro Albín | `Albín Rodríguez, A. P.` |
| Ángeles Verdejo | `Verdejo Espinosa, Á.` |
| Carmen Martínez Cruz | `Martínez Cruz, C.` |
| Alicia Montoro | `Montoro Lendínez, A.` |
| Carlos Montoya | `Montoya Peña, C.` |
| Javier Medina Quero | `Medina Quero, J.` |
| Francisco Mata Mata | `Mata Mata, F.` |
| Chris Nugent | `Nugent, C.` |
| Joaquín Torres-Sospedra | `Torres Sospedra, J.` |
| Carlos Fernández Basso | `Fernández Basso, C.` |
| Yolanda M. de la Fuente | `De la Fuente Robles, Y. M.` |

Si la persona no está en esta lista, sigue el patrón
`Apellido1 Apellido2, N. M.` (dos apellidos cuando se conocen, dos
iniciales cuando hay nombre compuesto).

---

## 5. Reglas finas

### Cuartil (solo revistas JCR)

- Asigna `quartile` con el cuartil del **año de publicación**: `"Q1"`,
  `"Q2"`, `"Q3"` o `"Q4"`.
- Si la revista está en JCR pero no conoces el cuartil aún, deja
  `null`. El validador avisa de revistas JCR sin cuartil.

### Impact Factor

- Si tienes el IF oficial: pon el número y añade
  `"impactFactorSource": "JCR"`.
- Si no lo tienes: déjalo en `null`. El script
  `scripts/update_journal_metrics.py` lo rellena con el
  `2yr_mean_citedness` de OpenAlex en la próxima ejecución del
  workflow.

### `indexedIn`

Array con las bases en las que está indexada: `["JCR", "Scopus", "SCIE", "SSCI"]`.
Si la revista **no** está en JCR, no incluyas `"JCR"` en el array.

### `featured`

Si quieres destacar visualmente un paper (estrella dorada), pon
`featured: true`. La sección de destacadas no está activa ahora mismo,
pero los flags se conservan en el JSON.

### `figureUrl`

Ruta a una imagen representativa en `assets/img/publications/`. Si no
hay, deja `null`. Cuando aparezca, sustituirá al icono genérico de la
tarjeta.

---

## 6. Validar antes de commitear

```bash
python scripts/check_publications.py
```

Comprobaciones:
- JSON sintácticamente válido.
- `id` único entre los tres archivos.
- Campos obligatorios presentes y no vacíos.
- En revistas con `JCR` en `indexedIn`, aviso si falta `quartile`.
- En congresos, error si `scope` no es `"international"` ni
  `"national"`.
- En software, error si falta `registryNumber`.
- DOI con formato `10.xxxx/xxxx` (avisa si parece mal).
- Detecta autores que escritos de varias formas colapsarán en el
  mismo nodo del grafo, para que decidas si quieres uniformar
  manualmente.

Códigos de salida:
- `0`: todo OK.
- `1`: errores que hay que corregir antes del commit.
- `2`: solo avisos (puedes commitear pero conviene revisar).

---

## 7. Probar visualmente

```bash
python -m http.server 8080
```

Abre http://localhost:8080 y comprueba:

1. **Sección Publicaciones**
   - La nueva tarjeta aparece (ordenada por año descendente).
   - El contador del chip apropiado se actualiza
     (`Todas X · Revistas Y · Congresos Z · Software W`).
   - Los chips de filtro funcionan.

2. **Sección Métricas**
   - Las stat-cards de "Producción" actualizan su número
     (`Publicaciones JCR`, `Congresos internacionales` / `nacionales`,
     `Registros software`).
   - Si es JCR, el desglose `Q1 / Q2 / Q3 / Q4` actualiza el cuartil
     correspondiente.
   - La gráfica anual incluye el nuevo año.

3. **Sección Investigación → Red de coautoría**
   - Si la publicación incluye coautores nuevos, aparecen como nodos
     nuevos.
   - Si la publicación es con coautores ya existentes, el tamaño de
     esos nodos (y el grosor de sus aristas con tu nodo) crece.
   - Pulsa el botón de reset del grafo para reorganizar la vista.

---

## 8. Commit y push

Si todo se ve correcto, commit:

```bash
git add data/publications/<archivo>.json
git commit -m "Add publication: <título corto> (<año>)"
git push origin master
```

GitHub Pages republica en 30-60 segundos.

---

## 9. Workflow semanal (automático)

Cada lunes a las 07:00 UTC el GitHub Action
`.github/workflows/scholar.yml` ejecuta:

1. `scripts/update_scholar.py` — refresca citas, h-index e i10 desde
   Google Scholar.
2. `scripts/update_journal_metrics.py` — refresca el IF (OpenAlex) de
   cada revista del corpus.

Los resultados se commitean automáticamente en `data/scholar.json` y
`data/publications/journals.json`. No requiere intervención manual.

---

## Referencia rápida

```bash
# Validar
python scripts/check_publications.py

# Servir localmente
python -m http.server 8080

# Subir
git push origin master
```
