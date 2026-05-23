/* Sanity del contrato SII vía MSW + estabilidad de query keys (Sprint C1).
   Si rompe tras tocar handlers.ts o sii.ts, el mock dejó de respetar el
   shape que la UI esperará. Cubre los 8 endpoints + helper PDF URL. */
import { describe, expect, it } from "vitest";
import {
  siiKeys,
  siiF29PdfUrl,
  type SiiHealthResponse,
  type SourceStatusResponse,
  type F29Response,
  type BheResponse,
  type RcvComprasResponse,
  type RcvVentasResponse,
  type DteRecibidosResponse,
} from "./sii";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("siiKeys", () => {
  it("namespacing estable", () => {
    expect(siiKeys.all).toEqual(["sii"]);
    expect(siiKeys.health()).toEqual(["sii", "health"]);
    expect(siiKeys.f22Status()).toEqual(["sii", "f22-status"]);
  });

  it("f29 key varía por folio (cache discriminado)", () => {
    expect(siiKeys.f29(1234567890)).toEqual(["sii", "f29", 1234567890]);
    expect(siiKeys.f29(1234567890)).not.toEqual(siiKeys.f29(9999999999));
  });

  it("rcvCompras y rcvVentas son keys distintos (no compartir cache)", () => {
    const params = { periodo: "2026-04" };
    expect(siiKeys.rcvCompras(params)).not.toEqual(siiKeys.rcvVentas(params));
  });

  it("rcv key incluye full param (slim vs full cachean separados)", () => {
    const slim = siiKeys.rcvCompras({ periodo: "2026-04" });
    const full = siiKeys.rcvCompras({ periodo: "2026-04", full: true });
    expect(slim).not.toEqual(full);
  });

  it("dteRecibidos key varía por rango", () => {
    const a = siiKeys.dteRecibidos({ desde: "2026-04-01", hasta: "2026-04-30" });
    const b = siiKeys.dteRecibidos({ desde: "2026-05-01", hasta: "2026-05-31" });
    expect(a).not.toEqual(b);
  });
});

describe("siiF29PdfUrl — helper", () => {
  it("folio válido → URL absoluta con NEXT_PUBLIC_API_URL", () => {
    const url = siiF29PdfUrl(1234567890);
    expect(url).toBe(`${API}/api/sii/f29/1234567890/pdf`);
  });

  it("folio inválido (≤ 0, NaN, fracción) → null", () => {
    expect(siiF29PdfUrl(0)).toBeNull();
    expect(siiF29PdfUrl(-5)).toBeNull();
    expect(siiF29PdfUrl(Number.NaN)).toBeNull();
    expect(siiF29PdfUrl(1.5)).toBeNull();
  });
});

describe("MSW — GET /api/sii/health", () => {
  it("devuelve shape SiiHealthResponse con flags true", async () => {
    const r = await fetch(`${API}/api/sii/health`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as SiiHealthResponse;
    expect(body.status).toBe("ok");
    expect(body.reachable).toBe(true);
    expect(body.rut_configured).toBe(true);
    expect(body.cert_available).toBe(true);
  });
});

describe("MSW — GET /api/sii/f22/status", () => {
  it("devuelve state='unavailable' (Fase 1 diferido) sin romper UI", async () => {
    const r = await fetch(`${API}/api/sii/f22/status`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as SourceStatusResponse;
    expect(body.source).toBe("sii_f22");
    expect(body.state).toBe("unavailable");
    expect(typeof body.reason).toBe("string");
  });
});

describe("MSW — GET /api/sii/f29/{folio}", () => {
  it("folio fixture (1234567890) → status='ok' con montos parseados", async () => {
    const r = await fetch(`${API}/api/sii/f29/1234567890`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as F29Response;
    expect(body.status).toBe("ok");
    expect(body.folio).toBe(1234567890);
    expect(body.estado).toBe("vigente");
    expect(body.iva_debito_fiscal).toBeGreaterThan(0);
    expect(body.iva_credito_fiscal).toBeGreaterThan(0);
    expect(body.ppm).toBeGreaterThan(0);
    expect(typeof body.total_a_pagar).toBe("number");
    expect(body.period?.year).toBe(2026);
    expect(body.period?.month).toBe(4);
  });

  it("folio desconocido → HTTP 200 + status='not_found' (no es error visible)", async () => {
    /* Contrato §C1-03: la UI no muestra error en este caso, sino
       "Sin declaración para este folio". Por eso devolvemos 200 + flag. */
    const r = await fetch(`${API}/api/sii/f29/9999999999`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as F29Response;
    expect(body.status).toBe("not_found");
    expect(body.iva_debito_fiscal).toBeNull();
    expect(body.total_a_pagar).toBeNull();
  });

  it("folio inválido (≤ 0) → 422 validation_error", async () => {
    const r = await fetch(`${API}/api/sii/f29/0`);
    expect(r.status).toBe(422);
  });
});

describe("MSW — GET /api/sii/f29/{folio}/pdf", () => {
  it("folio fixture → 200 application/pdf", async () => {
    const r = await fetch(`${API}/api/sii/f29/1234567890/pdf`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/pdf");
  });

  it("folio desconocido → 404 (no hay PDF)", async () => {
    const r = await fetch(`${API}/api/sii/f29/9999999999/pdf`);
    expect(r.status).toBe(404);
  });
});

describe("MSW — GET /api/sii/bhe?periodo", () => {
  it("período válido → lista de BHE con shape esperado", async () => {
    const r = await fetch(`${API}/api/sii/bhe?periodo=2026-04`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as BheResponse;
    expect(body.status).toBe("ok");
    expect(body.periodo).toBe("2026-04");
    expect(Array.isArray(body.bhe)).toBe(true);
    expect(body.count).toBe(body.bhe?.length);
    if (body.bhe && body.bhe.length > 0) {
      const first = body.bhe[0]!;
      expect(typeof first.rut_emisor).toBe("string");
      expect(typeof first.monto_bruto).toBe("number");
      expect(typeof first.retencion).toBe("number");
      expect(typeof first.monto_liquido).toBe("number");
    }
  });

  it("falta periodo → 422", async () => {
    const r = await fetch(`${API}/api/sii/bhe`);
    expect(r.status).toBe(422);
  });
});

describe("MSW — GET /api/sii/rcv/compras|ventas?periodo", () => {
  it("compras período válido → lista slim + count coherente", async () => {
    const r = await fetch(`${API}/api/sii/rcv/compras?periodo=2026-04`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as RcvComprasResponse;
    expect(body.status).toBe("ok");
    expect(body.count).toBe(body.compras?.length);
  });

  it("ventas período válido → lista slim", async () => {
    const r = await fetch(`${API}/api/sii/rcv/ventas?periodo=2026-04`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as RcvVentasResponse;
    expect(body.status).toBe("ok");
    expect(Array.isArray(body.ventas)).toBe(true);
  });

  it("compras sin periodo → 422", async () => {
    const r = await fetch(`${API}/api/sii/rcv/compras`);
    expect(r.status).toBe(422);
  });
});

describe("MSW — GET /api/sii/dte-recibidos?desde&hasta", () => {
  it("rango válido → filas con primera = headers", async () => {
    const r = await fetch(`${API}/api/sii/dte-recibidos?desde=2026-04-01&hasta=2026-04-30`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as DteRecibidosResponse;
    expect(body.status).toBe("ok");
    expect(body.desde).toBe("2026-04-01");
    expect(body.hasta).toBe("2026-04-30");
    const filas = body.dte_recibidos?.filas;
    expect(Array.isArray(filas)).toBe(true);
    if (filas && filas.length > 0) {
      /* Primera fila = headers según contrato. */
      expect(filas[0]).toContain("Folio");
      expect(filas[0]).toContain("Emisor");
    }
  });

  it("falta desde o hasta → 422", async () => {
    const a = await fetch(`${API}/api/sii/dte-recibidos?desde=2026-04-01`);
    expect(a.status).toBe(422);
    const b = await fetch(`${API}/api/sii/dte-recibidos?hasta=2026-04-30`);
    expect(b.status).toBe(422);
  });
});
