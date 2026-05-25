"""Raspa el perfil de Google Scholar de José Luis López Ruiz y vuelca
las métricas en data/scholar.json para que la página las lea.

Se ejecuta desde GitHub Actions (.github/workflows/scholar.yml) los lunes,
o manualmente con `python scripts/update_scholar.py`.

Google Scholar bloquea muy agresivamente las IPs de los runners de GitHub
Actions: la primera petición típicamente devuelve una página de CAPTCHA y
scholarly explota con `AttributeError: 'NoneType' object has no attribute
'get'` porque el HTML no contiene el `<link rel="canonical">`.

Para sortearlo intentamos:
  1. enrutar las peticiones por proxies HTTP gratuitos (ProxyGenerator.FreeProxies),
  2. reintentar varias veces con backoff aleatorio,
  3. si todo falla, salimos con código != 0 sin tocar data/scholar.json,
     para que el commit step de la Action no haga nada y el JSON anterior
     siga siendo la fuente de verdad.
"""
from __future__ import annotations

import json
import random
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from scholarly import ProxyGenerator, scholarly

# ID público de Google Scholar (parámetro `user=` de la URL de tu perfil).
SCHOLAR_ID = "Am2sDmIAAAAJ"

OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "scholar.json"

# Cuántas veces intentamos sacar el perfil antes de rendirnos.
MAX_ATTEMPTS = 6


def _try_enable_free_proxies() -> bool:
    """Intenta configurar scholarly para usar proxies HTTP gratuitos.

    Devuelve True si lo consigue. Si falla (lista de proxies caída, etc.)
    devuelve False y dejamos que scholarly haga la petición directa.
    """
    try:
        pg = ProxyGenerator()
        ok = pg.FreeProxies()
        if ok:
            scholarly.use_proxy(pg)
            print("  · proxies libres activados")
            return True
        print("  · FreeProxies devolvió False (sin proxies disponibles)")
    except Exception as exc:  # noqa: BLE001 - queremos tragarnos cualquier fallo del pool
        print(f"  · FreeProxies lanzó {type(exc).__name__}: {exc}")
    return False


def _fetch_author():
    """Devuelve el dict de perfil ya rellenado, reintentando si hace falta."""
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"Intento {attempt}/{MAX_ATTEMPTS}: buscando perfil id={SCHOLAR_ID}...")
        # Cada intento configura su propio proxy (los gratuitos caen rápido).
        proxied = _try_enable_free_proxies()
        if not proxied:
            print("  · sin proxy: este intento sale directo desde el runner (alto riesgo de CAPTCHA)")
        try:
            author = scholarly.search_author_id(SCHOLAR_ID)
            return scholarly.fill(author, sections=["basics", "indices", "counts"])
        except Exception as exc:  # noqa: BLE001 - CAPTCHA llega como AttributeError, etc.
            last_error = exc
            print(f"  · falló ({type(exc).__name__}: {exc})")
            if attempt < MAX_ATTEMPTS:
                pause = random.uniform(8, 20)
                print(f"  · esperando {pause:.1f}s antes de reintentar")
                time.sleep(pause)

    print("Todos los intentos fallaron. Último error:", file=sys.stderr)
    if last_error is not None:
        traceback.print_exception(type(last_error), last_error, last_error.__traceback__)
    return None


def main() -> int:
    if SCHOLAR_ID == "REEMPLAZA_CON_TU_ID":
        print("ERROR: SCHOLAR_ID no configurado en scripts/update_scholar.py", file=sys.stderr)
        return 1

    author = _fetch_author()
    if author is None:
        print(
            "No se pudo recuperar el perfil de Google Scholar. "
            "Mantenemos data/scholar.json tal cual estaba.",
            file=sys.stderr,
        )
        return 2

    cites_per_year = author.get("cites_per_year") or {}
    counts_by_year = [
        {"year": int(y), "cited_by_count": int(c)}
        for y, c in sorted(cites_per_year.items())
    ]

    data = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Google Scholar",
        "scholar_id": SCHOLAR_ID,
        "name": author.get("name"),
        "affiliation": author.get("affiliation"),
        "citations": author.get("citedby"),
        "citations_5y": author.get("citedby5y"),
        "h_index": author.get("hindex"),
        "h_index_5y": author.get("hindex5y"),
        "i10_index": author.get("i10index"),
        "i10_index_5y": author.get("i10index5y"),
        "counts_by_year": counts_by_year,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"OK · citas={data['citations']} · h={data['h_index']} · "
        f"i10={data['i10_index']} · escrito en {OUT_PATH}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
