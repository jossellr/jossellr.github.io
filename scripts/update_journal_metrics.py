"""Completa el campo impactFactor de data/publications/journals.json
consultando la API gratuita de OpenAlex.

- Si un artículo ya tiene impactFactor (típicamente el oficial JCR
  introducido a mano), se respeta y solo se marca la fuente como JCR.
- Si no tiene, se rellena con summary_stats.2yr_mean_citedness desde
  OpenAlex (el cálculo equivalente: citas en 2 años / artículos en 2
  años) y se etiqueta como 'OpenAlex'.

El campo impactFactorSource permite a la UI distinguir IF oficial vs
proxy OpenAlex y mostrarlos con estilos diferentes.

Se puede ejecutar localmente o desde un GitHub Action.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from urllib import request, parse

PATH = Path(__file__).resolve().parent.parent / "data" / "publications" / "journals.json"
MAILTO = "llopez@ujaen.es"


def fetch_openalex(issn: str | None, journal: str | None) -> dict | None:
    """Devuelve el dict de OpenAlex Source para una revista. Prefiere ISSN."""
    url = None
    if issn:
        url = f"https://api.openalex.org/sources/issn:{parse.quote(issn)}?mailto={MAILTO}"
    elif journal:
        q = parse.quote(journal)
        url = f"https://api.openalex.org/sources?search={q}&per_page=1&mailto={MAILTO}"
    if not url:
        return None
    try:
        with request.urlopen(url, timeout=15) as r:
            data = json.loads(r.read())
    except Exception as e:
        print(f"  [warn] fallo HTTP: {e}", file=sys.stderr)
        return None
    if "results" in data:
        return data["results"][0] if data["results"] else None
    return data


def main() -> int:
    blob = json.loads(PATH.read_text(encoding="utf-8"))
    items = blob.get("items", [])

    for it in items:
        title = it.get("journal", "?")
        already = it.get("impactFactor")
        source = fetch_openalex(it.get("issn"), title)
        time.sleep(0.2)  # rate-limit suave

        if not source:
            print(f"× {title}: sin coincidencia en OpenAlex")
            continue

        ifoa = (source.get("summary_stats") or {}).get("2yr_mean_citedness")
        if ifoa is not None:
            ifoa = round(float(ifoa), 2)

        if already:
            # IF oficial introducido a mano: respetamos y etiquetamos
            it["impactFactorSource"] = it.get("impactFactorSource", "JCR")
            # Guardamos OpenAlex como referencia secundaria
            if ifoa is not None:
                it["impactFactorOpenAlex"] = ifoa
            print(f"= {title}: JCR {already} (OA {ifoa})")
        elif ifoa is not None:
            it["impactFactor"] = ifoa
            it["impactFactorSource"] = "OpenAlex"
            print(f"+ {title}: OA {ifoa}")
        else:
            print(f"~ {title}: sin datos numéricos")

    PATH.write_text(json.dumps(blob, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nGuardado en {PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
