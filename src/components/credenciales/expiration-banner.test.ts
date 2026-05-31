/* Tests de getBanner — anti-regresión de los umbrales de vencimiento del
   certificado digital. Los thresholds están documentados en
   docs/backend-contracts/c1-sii-credentials.md § 3.3 y son consumidos
   por la UX (banner amarillo/rojo + email automático). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBanner } from "./expiration-banner";

/* Tiempo CONGELADO. Los thresholds son por día exacto (ej. "1 día → urgent")
   y `daysUntil()` hace `differenceInDays(iso, new Date())`. Sin congelar, el
   `new Date()` interno cae microsegundos DESPUÉS del `Date.now()` del fixture;
   cuando ambos caen en el mismo milisegundo el diff da exactamente 1 día
   (urgent), pero ~1 de cada 6 corridas cruza un boundary de ms → diff < 1 día
   → `differenceInDays` = 0 → 'expired' en vez de 'urgent' (test flaky). Con
   tiempo fijo, el `Date.now()` del fixture y el `new Date()` de daysUntil ven
   el MISMO instante → boundaries deterministas. Mediodía UTC evita el edge de
   medianoche. (Bug del test, no de producción.) */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

/* Helper: ISO de fecha futura/pasada relativa a now (congelado). */
function isoInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("getBanner — certificate expiration tones", () => {
  it("sin expires_at → tone ok (no banner)", () => {
    expect(getBanner(undefined).tone).toBe("ok");
  });

  it("vence en 90 días → tone ok", () => {
    expect(getBanner(isoInDays(90)).tone).toBe("ok");
  });

  it("vence en 61 días → tone ok (justo arriba del threshold warn)", () => {
    expect(getBanner(isoInDays(61)).tone).toBe("ok");
  });

  it("vence en 60 días → tone warn", () => {
    const b = getBanner(isoInDays(60));
    expect(b.tone).toBe("warn");
    if (b.tone === "warn") expect(b.daysLeft).toBeGreaterThanOrEqual(59);
  });

  it("vence en 45 días → tone warn", () => {
    const b = getBanner(isoInDays(45));
    expect(b.tone).toBe("warn");
  });

  it("vence en 31 días → tone warn (justo arriba del threshold urgent)", () => {
    const b = getBanner(isoInDays(31));
    expect(b.tone).toBe("warn");
  });

  it("vence en 30 días → tone urgent", () => {
    const b = getBanner(isoInDays(30));
    expect(b.tone).toBe("urgent");
  });

  it("vence en 10 días → tone urgent", () => {
    const b = getBanner(isoInDays(10));
    expect(b.tone).toBe("urgent");
    if (b.tone === "urgent") expect(b.daysLeft).toBeGreaterThanOrEqual(9);
  });

  it("vence en 1 día → tone urgent", () => {
    const b = getBanner(isoInDays(1));
    expect(b.tone).toBe("urgent");
  });

  it("vence en 0 días → tone expired", () => {
    /* Con tiempo congelado, isoInDays(0) = el instante fijo exacto →
       daysUntil = differenceInDays(t, t) = 0 → expired (determinista). */
    expect(getBanner(isoInDays(0)).tone).toBe("expired");
  });

  it("ya expiró hace 5 días → tone expired", () => {
    expect(getBanner(isoInDays(-5)).tone).toBe("expired");
  });

  it("ya expiró hace 365 días → tone expired", () => {
    expect(getBanner(isoInDays(-365)).tone).toBe("expired");
  });
});
