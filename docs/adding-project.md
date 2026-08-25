# Pipeline para añadir un proyecto

Los proyectos viven en `data/projects.json`, con la forma
`{ "items": [ ... ] }`. La sección «Proyectos» de la web se pinta a partir
de ese array.

**Si `items` está vacío, la sección y su enlace del menú se ocultan solos.**
Así la web nunca muestra un bloque a medias.

---

## Campos

| Campo | Obligatorio | Valor |
|---|---|---|
| `id` | sí | Identificador único, kebab-case. Convención: `acronimo-añoInicio` |
| `title` | sí | Título completo del proyecto |
| `acronym` | no | Acrónimo; se muestra como distintivo monoespaciado |
| `funder` | no | Organismo financiador |
| `programme` | no | Convocatoria o plan |
| `reference` | no | Código oficial del proyecto |
| `role` | no | `pi` · `co-pi` · `researcher` · `team` |
| `scope` | no | `european` · `national` · `regional` · `contract` · `internal` |
| `startDate` | no | `AAAA-MM-DD` |
| `endDate` | no | `AAAA-MM-DD` |
| `budget` | no | Número en euros, o `null` para no publicarlo |
| `status` | no | `active` · `finished`. Si se omite, se deduce de `endDate` |
| `url` | no | Web del proyecto; si existe, el título enlaza a ella |
| `description` | no | Una o dos frases |
| `partners` | no | Lista de entidades participantes |
| `relatedPublications` | no | Lista de `id` de `data/publications/*.json` |

Los valores de `role` y `scope` **deben** ser uno de los listados: la web
traduce cada uno con una clave de `data/i18n/*.json`
(`projects.roles.*`, `projects.scopes.*`). Un valor no contemplado se
mostraría sin traducir.

---

## Orden y estado

- Los proyectos **en ejecución** se muestran primero; dentro de cada
  grupo, los de fecha de fin más tardía van antes.
- El estado se calcula solo: si `endDate` aún no ha pasado, el proyecto
  aparece como «En ejecución». Usa `status` únicamente para forzar el
  valor cuando la fecha no lo refleje bien.

---

## Publicaciones asociadas

`relatedPublications` acepta `id` de cualquiera de los tres ficheros de
publicaciones. La web **solo cuenta los que existen**: un `id` mal escrito
se ignora en silencio en lugar de romper la tarjeta. Conviene revisar el
número que aparece en la ficha tras añadirlos.

---

## Ejemplo

```json
{
  "id": "platera-2024",
  "acronym": "PLATERA",
  "title": "Plataforma de teleasistencia avanzada para envejecimiento activo",
  "funder": "Ministerio de Ciencia, Innovación y Universidades",
  "programme": "Proyectos de Generación de Conocimiento",
  "reference": "PID2024-000000NB-I00",
  "role": "researcher",
  "scope": "national",
  "startDate": "2025-01-01",
  "endDate": "2027-12-31",
  "budget": 145000,
  "url": null,
  "description": "Monitorización no intrusiva de personas mayores mediante sensores IoT en el domicilio.",
  "partners": ["Universidad de Jaén", "Universidad de Granada"],
  "relatedPublications": ["lopez-2025-ble-positioning"]
}
```

---

## Comprobación

Tras editar, valida el JSON y levanta la web en local:

```
python -c "import json,io; json.load(io.open('data/projects.json',encoding='utf-8')); print('ok')"
start-local.bat
```
