#!/usr/bin/env python3
"""Genera las firmas de correo de Qavante a partir de personas.json.

    python generar.py personas.json

Escribe `dist/<slug>.html`, listo para pegar en Outlook (ver README.md).
Sin dependencias externas.
"""

import html
import json
import re
import sys
import unicodedata
from pathlib import Path

AQUI = Path(__file__).parent
CAMPOS = ("nombre", "cargo", "movil")


def slug(texto: str) -> str:
    plano = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plano.lower()).strip("-")


def e164(telefono: str) -> str:
    """'+56 9 1234 5678' -> '+56912345678' (para el href tel:)."""
    digitos = re.sub(r"\D", "", telefono)
    return f"+{digitos}" if digitos else ""


def render(plantilla: str, persona: dict) -> str:
    valores = {
        "NOMBRE": persona["nombre"],
        "CARGO": persona["cargo"],
        "MOVIL": persona["movil"],
        "MOVIL_E164": e164(persona["movil"]),
    }
    for clave, valor in valores.items():
        plantilla = plantilla.replace("{{%s}}" % clave, html.escape(valor, quote=True))
    return plantilla


def main() -> int:
    origen = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "personas.json"
    if not origen.exists():
        print(f"No existe {origen}. Copia personas.example.json y edítalo.", file=sys.stderr)
        return 1

    personas = json.loads(origen.read_text(encoding="utf-8"))
    plantilla = (AQUI / "firma-completa.html").read_text(encoding="utf-8")
    salida = AQUI / "dist"
    salida.mkdir(exist_ok=True)

    for persona in personas:
        faltan = [c for c in CAMPOS if not persona.get(c)]
        if faltan:
            print(f"Salto {persona.get('nombre', '(sin nombre)')}: faltan {', '.join(faltan)}", file=sys.stderr)
            continue
        destino = salida / f"{slug(persona['nombre'])}.html"
        destino.write_text(render(plantilla, persona), encoding="utf-8")
        print(f"OK {destino.relative_to(AQUI)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
