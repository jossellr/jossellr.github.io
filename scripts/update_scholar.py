"""Raspa el perfil de Google Scholar de José Luis López Ruiz y vuelca
las métricas en data/scholar.json para que la página las lea.

Se ejecuta desde GitHub Actions (.github/workflows/scholar.yml) los lunes,
o manualmente con `python scripts/update_scholar.py`.

Si Google Scholar mete CAPTCHA, el script aborta con código distinto de 0
y la Action no commitea nada; el JSON anterior sigue siendo válido.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from scholarly import scholarly

# ID público de Google Scholar (parámetro `user=` de la URL de tu perfil).
SCHOLAR_ID = "Am2sDmIAAAAJ"

OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "scholar.json"


def main() -> int:
    if SCHOLAR_ID == "REEMPLAZA_CON_TU_ID":
        print("ERROR: SCHOLAR_ID no configurado en scripts/update_scholar.py", file=sys.stderr)
        return 1

    print(f"Buscando perfil de Scholar id={SCHOLAR_ID}...")
    author = scholarly.search_author_id(SCHOLAR_ID)
    author = scholarly.fill(author, sections=["basics", "indices", "counts"])

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
