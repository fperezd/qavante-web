"""Download official-looking bank icons (PNG) for the Qavante connect widget."""

from __future__ import annotations

import io
import ssl
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore[misc, assignment]

ROOT = Path(__file__).resolve().parents[1] / "public" / "banks"
UA = "QavanteLocalLogoFetch/1.0 (demo asset fetch)"
CTX = ssl.create_default_context()

BANKS: list[tuple[str, str]] = [
    ("cl_banco_estado", "bancoestado.cl"),
    ("cl_banco_de_chile", "bancochile.cl"),
    ("cl_banco_santander", "santander.cl"),
    ("cl_banco_bci", "bci.cl"),
    ("cl_banco_scotiabank", "scotiabank.cl"),
    ("cl_banco_itau", "itau.cl"),
    ("cl_banco_bice", "bice.cl"),
    ("cl_banco_falabella", "banco.falabella.com"),
    ("cl_banco_ripley", "bancoripley.cl"),
    ("cl_banco_security", "security.cl"),
    ("cl_banco_consorcio", "bancoconsorcio.cl"),
    ("cl_banco_internacional", "bancointernacional.cl"),
    ("cl_banco_coopeuch", "coopeuch.cl"),
    ("cl_banco_bbva", "bbva.cl"),
    ("cl_banco_hsbc", "hsbc.cl"),
    ("cl_mercado_pago", "mercadopago.cl"),
    ("cl_mach", "somosmach.com"),
    ("cl_tenpo", "tenpo.cl"),
    ("cl_tapp_caja_los_andes", "tappcaja.cl"),
    ("cl_copec_pay", "copec.cl"),
    ("cl_prepago_los_heroes", "losheroes.cl"),
    ("cl_banco_btg_pactual", "btgpactual.cl"),
    ("cl_banco_nova", "bci.cl"),
    ("cl_banco_edwards", "bancochile.cl"),
    ("cl_banco_paris", "bancoparis.cl"),
    ("cl_banco_condell", "scotiabank.cl"),
]


def fetch(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20, context=CTX) as resp:
            if resp.status != 200:
                return None
            data = resp.read()
            if not data or len(data) < 80:
                return None
            return data
    except Exception as exc:  # noqa: BLE001
        print(f"  fail {url}: {exc}")
        return None


def sources(domain: str) -> list[str]:
    return [
        f"https://www.google.com/s2/favicons?domain={domain}&sz=128",
        f"https://www.google.com/s2/favicons?sz=128&domain_url=https://{domain}",
        f"https://logo.clearbit.com/{domain}",
        f"https://icons.duckduckgo.com/ip3/{domain}.ico",
    ]


def save_png(institution_id: str, data: bytes) -> bool:
    dest = ROOT / f"{institution_id}.png"
    if Image is None:
        dest.write_bytes(data)
        return True
    try:
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img = img.resize((128, 128), Image.Resampling.LANCZOS)
        img.save(dest, format="PNG")
        return True
    except Exception:
        dest.write_bytes(data)
        return True


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for institution_id, domain in BANKS:
        dest = ROOT / f"{institution_id}.png"
        print(institution_id, domain)
        ok = False
        for url in sources(domain):
            data = fetch(url)
            if data:
                save_png(institution_id, data)
                print(f"  saved {dest.name} from {url} ({dest.stat().st_size} bytes)")
                ok = True
                break
        if not ok:
            print("  MISSING")


if __name__ == "__main__":
    main()
