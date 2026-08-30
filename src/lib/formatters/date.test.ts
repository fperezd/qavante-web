/* Tests de caracterización de formatDate — fecha corta es-CL (dd-mm-aaaa).
   Envuelve Intl.DateTimeFormat es-CL. Las fechas se construyen con
   componentes locales + mediodía para evitar corrimientos por timezone. */
import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateLike,
  formatDateTimeLike,
  formatDateShort,
  formatDateLong,
  formatRelative,
  formatHoraCorta,
} from "./date";

describe("formatDate", () => {
  it("usa el orden día-mes-año con guiones (es-CL)", () => {
    expect(formatDate(new Date(2026, 4, 30, 12, 0, 0))).toBe("30-05-2026");
  });

  it("rellena día y mes con cero a la izquierda", () => {
    expect(formatDate(new Date(2026, 0, 5, 12, 0, 0))).toBe("05-01-2026");
  });

  it("formatea diciembre (mes 12) correctamente", () => {
    expect(formatDate(new Date(2026, 11, 25, 12, 0, 0))).toBe("25-12-2026");
  });
});

describe("formatDateLike — convención mes-año / DD-MM-AAAA (string in, string out)", () => {
  it("ISO date YYYY-MM-DD → DD-MM-AAAA", () => {
    expect(formatDateLike("2026-05-13")).toBe("13-05-2026");
  });

  it("ISO datetime → DD-MM-AAAA (toma la parte de fecha)", () => {
    expect(formatDateLike("2026-05-13T12:00:00Z")).toBe("13-05-2026");
  });

  it("año-mes YYYY-MM → MM-AAAA", () => {
    expect(formatDateLike("2026-05")).toBe("05-2026");
  });

  it("es idempotente: un valor ya en DD-MM-AAAA queda igual", () => {
    expect(formatDateLike("13-05-2026")).toBe("13-05-2026");
  });

  it("pasa por alto formatos desconocidos (ej. DD/MM/YYYY del SII)", () => {
    expect(formatDateLike("13/05/2026")).toBe("13/05/2026");
  });

  it("null / undefined / vacío → guion", () => {
    expect(formatDateLike(null)).toBe("s/d");
    expect(formatDateLike(undefined)).toBe("s/d");
    expect(formatDateLike("")).toBe("s/d");
  });
});

describe("formatDateTimeLike", () => {
  it("ISO datetime → DD-MM-AAAA HH:MM:SS (hora local)", () => {
    const r = formatDateTimeLike("2026-06-27T10:15:30Z");
    expect(r).toMatch(/^\d{2}-\d{2}-2026 \d{2}:\d{2}:\d{2}$/);
    expect(r.slice(0, 10).split("-")).toContain("2026"); // el año va al final
  });

  it("null / inválido → guion / as-is", () => {
    expect(formatDateTimeLike(null)).toBe("s/d");
    expect(formatDateTimeLike("")).toBe("s/d");
    expect(formatDateTimeLike("no-es-fecha")).toBe("no-es-fecha");
  });
});

/* ── Formatos de la spec §1.4 ─────────────────────────────────────────────────
   Todavía NO los usa ningún llamador (la migración va en su propio PR); estos
   tests fijan el contrato antes de que exista el primer consumidor. */

describe("formatDateShort", () => {
  it("'23 ago' — día + mes corto, sin año", () => {
    expect(formatDateShort("2026-08-23")).toBe("23 ago");
    expect(formatDateShort("2026-01-05")).toBe("5 ene");
  });

  it("NO corre el día por timezone (el bug clásico de `new Date('2026-08-23')`)", () => {
    // Medianoche UTC leída en Chile (UTC−3/−4) daría "22 ago": un día menos en
    // cada vencimiento. Por eso el string ISO se lee literal, sin pasar por Date.
    expect(formatDateShort("2026-08-23T00:00:00Z")).toBe("23 ago");
  });

  it("acepta Date y la convención vigente DD-MM-AAAA", () => {
    expect(formatDateShort(new Date(2026, 7, 23, 12))).toBe("23 ago");
    expect(formatDateShort("23-08-2026")).toBe("23 ago");
  });

  it("null / vacío / no reconocido / mes fuera de rango → 's/d'", () => {
    expect(formatDateShort(null)).toBe("s/d");
    expect(formatDateShort("")).toBe("s/d");
    expect(formatDateShort("no-es-fecha")).toBe("s/d");
    expect(formatDateShort("2026-13-01")).toBe("s/d");
    expect(formatDateShort(new Date("basura"))).toBe("s/d");
  });
});

describe("formatDateLong", () => {
  it("'23 ago 2026' — con año", () => {
    expect(formatDateLong("2026-08-23")).toBe("23 ago 2026");
    expect(formatDateLong("2025-12-01T09:30:00Z")).toBe("1 dic 2025");
  });

  it("null / no reconocido → 's/d'", () => {
    expect(formatDateLong(undefined)).toBe("s/d");
    expect(formatDateLong("2026-00-10")).toBe("s/d");
  });
});

describe("formatRelative", () => {
  const HOY = new Date(2026, 7, 23, 15, 0); // 23-08-2026, local

  it("'hace N días' hacia atrás, 'en N días' hacia adelante", () => {
    expect(formatRelative("2026-06-11", HOY)).toBe("hace 73 días");
    expect(formatRelative("2026-08-28", HOY)).toBe("en 5 días");
  });

  it("hoy / ayer / mañana en vez de 'hace 1 días'", () => {
    expect(formatRelative("2026-08-23", HOY)).toBe("hoy");
    expect(formatRelative("2026-08-22", HOY)).toBe("ayer");
    expect(formatRelative("2026-08-24", HOY)).toBe("mañana");
  });

  it("cuenta DÍAS CIVILES, no bloques de 24 horas", () => {
    // Anoche a las 23:00 es "ayer" aunque hayan pasado 16 horas, que es como lo
    // lee una persona.
    expect(formatRelative(new Date(2026, 7, 22, 23, 0), HOY)).toBe("ayer");
    expect(formatRelative(new Date(2026, 7, 23, 0, 30), HOY)).toBe("hoy");
  });

  it("no escala a meses: en cobranza la distancia exacta ES el dato", () => {
    expect(formatRelative("2025-08-23", HOY)).toBe("hace 365 días");
  });

  it("null / no reconocido → 's/d'", () => {
    expect(formatRelative(null, HOY)).toBe("s/d");
    expect(formatRelative("no-es-fecha", HOY)).toBe("s/d");
  });
});

describe("formatHoraCorta — el sello de hora del chip KPI (§1.3)", () => {
  it("HH:MM local, con cero a la izquierda", () => {
    expect(formatHoraCorta(new Date(2026, 7, 30, 8, 12, 45))).toBe("08:12");
    expect(formatHoraCorta(new Date(2026, 7, 30, 23, 5))).toBe("23:05");
  });

  it("acepta el ISO del backend (misma hora local que el Date equivalente)", () => {
    const d = new Date("2026-08-30T08:12:00Z");
    const p = (n: number) => String(n).padStart(2, "0");
    expect(formatHoraCorta("2026-08-30T08:12:00Z")).toBe(`${p(d.getHours())}:${p(d.getMinutes())}`);
  });

  it("null / vacío / no reconocido → 's/d'", () => {
    expect(formatHoraCorta(null)).toBe("s/d");
    expect(formatHoraCorta("")).toBe("s/d");
    expect(formatHoraCorta("no-es-fecha")).toBe("s/d");
  });
});
