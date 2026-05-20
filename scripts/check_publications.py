"""Validador del corpus de publicaciones.

Comprueba que los tres JSON de data/publications/ están bien formados,
tienen los campos obligatorios para cada tipo, no hay IDs duplicados y
detecta posibles autores duplicados (mismo apellido + inicial escrito
de varias formas).

Uso:
    python scripts/check_publications.py

Códigos de salida:
    0  → sin errores ni avisos
    1  → hay errores (campos obligatorios, JSON inválido…)
    2  → solo avisos (cuartiles sin asignar, variantes de autor…)
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "data" / "publications"

REQUIRED_FIELDS = {
    "journals":    ["id", "title", "authors", "myPosition", "year", "journal"],
    "conferences": ["id", "title", "authors", "myPosition", "year", "conference", "scope"],
    "software":    ["id", "title", "authors", "year", "registryNumber", "registry"],
}

DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$")


def normalize_author_key(name: str) -> str:
    """Misma normalización que el grafo del frontend: primer apellido + inicial."""
    s = unicodedata.normalize("NFD", name.lower())
    s = "".join(c for c in s if not unicodedata.combining(c)).strip()
    if not s:
        return ""
    if "," in s:
        last, first = s.split(",", 1)
        last_name = last.strip().split()[0] if last.strip() else ""
        first_clean = first.replace(".", "").replace(",", "").strip()
        first_initial = first_clean[:1] if first_clean else ""
    else:
        parts = s.replace(",", "").replace(".", "").split()
        first_initial = parts[0][:1] if parts else ""
        last_name = parts[-1] if parts else ""
    return re.sub(r"[^a-z_]", "", f"{last_name}_{first_initial}")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    data: dict[str, dict] = {}

    # 1. Carga y validación de JSON
    for kind in REQUIRED_FIELDS:
        path = BASE / f"{kind}.json"
        if not path.exists():
            errors.append(f"Archivo ausente: {path}")
            continue
        try:
            data[kind] = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"JSON inválido en {path.name}: {e}")

    if errors:
        _report(errors, warnings, total=0)
        return 1

    total = sum(len(blob.get("items", [])) for blob in data.values())

    # 2. Unicidad de IDs entre los tres archivos
    seen_ids: dict[str, str] = {}
    for kind, blob in data.items():
        for it in blob.get("items", []):
            iid = it.get("id")
            title = (it.get("title") or "?")[:60]
            if not iid:
                errors.append(f"[{kind}] item sin 'id': {title}")
                continue
            if iid in seen_ids:
                errors.append(
                    f"id duplicado '{iid}' en {kind} (también en {seen_ids[iid]})"
                )
            seen_ids[iid] = kind

    # 3. Campos obligatorios
    for kind, blob in data.items():
        for it in blob.get("items", []):
            for field in REQUIRED_FIELDS[kind]:
                if it.get(field) in (None, "", []):
                    errors.append(
                        f"[{kind}] '{it.get('id','?')}' falta campo obligatorio: {field}"
                    )

    # 4. Reglas específicas por tipo
    for it in data.get("journals", {}).get("items", []):
        if "JCR" in (it.get("indexedIn") or []) and not it.get("quartile"):
            warnings.append(
                f"[journals] '{it['id']}' indexada en JCR pero sin cuartil"
            )
        doi = it.get("doi")
        if doi and not DOI_RE.match(doi):
            warnings.append(f"[journals] '{it['id']}' DOI con formato sospechoso: {doi}")

    for it in data.get("conferences", {}).get("items", []):
        scope = it.get("scope")
        if scope not in ("international", "national"):
            errors.append(
                f"[conferences] '{it['id']}' scope inválido: {scope!r} "
                "(debe ser 'international' o 'national')"
            )

    for it in data.get("software", {}).get("items", []):
        if not it.get("registryNumber"):
            errors.append(f"[software] '{it.get('id','?')}' sin registryNumber")

    # 5. Variantes de autor (mismo nodo en el grafo, escrito distinto)
    variants_by_key: dict[str, set[str]] = defaultdict(set)
    for kind, blob in data.items():
        for it in blob.get("items", []):
            for a in it.get("authors", []):
                key = normalize_author_key(a)
                if key:
                    variants_by_key[key].add(a)

    for key, variants in sorted(variants_by_key.items()):
        if len(variants) > 1:
            warnings.append(
                f"Autor '{key}' aparece con {len(variants)} variantes: "
                + " / ".join(sorted(variants))
            )

    _report(errors, warnings, total=total)
    if errors:
        return 1
    if warnings:
        return 2
    return 0


def _report(errors: list[str], warnings: list[str], total: int) -> None:
    print(f"Comprobado: {total} publicaciones en {BASE}.")
    if errors:
        print(f"\n[ERROR] {len(errors)} errores:")
        for e in errors:
            print(f"  - {e}")
    if warnings:
        print(f"\n[AVISO] {len(warnings)} avisos:")
        for w in warnings:
            print(f"  - {w}")
    if not errors and not warnings:
        print("\n[OK] Sin errores ni avisos.")


if __name__ == "__main__":
    sys.exit(main())
