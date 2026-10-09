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
  formatDateHeading,
  formatRelative,
  formatHoraCorta,
} from "./date";

/** Un instante a partir de una hora de pared de CHILE. En agosto Chile es UTC-4 (sin horario de
 *  verano), asi que la hora local chilena + 4 son las UTC. Explicito a proposito: una fixture
 *  construida con `new Date(y, m, d, h)` depende del huso de quien corra el test. */
function enChile(y: number, mes: number, dia: number, hora: number, minuto: number): Date {
  return new Date(Date.UTC(y, mes - 1, dia, hora + 4, minuto));
}

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

  it("una FECHA DE CALENDARIO no corre el día por timezone", () => {
    // El bug clásico de `new Date('2026-08-23')`: medianoche UTC leída en Chile (UTC-3/-4) daría
    // "22 ago", un día menos en cada vencimiento. Una fecha que la fuente informó SIN hora no
    // tiene zona, así que se lee literal, sin pasar por `Date`.
    expect(formatDateShort("2026-08-23")).toBe("23 ago");
  });

  it("un INSTANTE sí se convierte, y su día es el de Chile (B16)", () => {
    // Este caso lo cubría la misma aserción de arriba, con un fixture `...T00:00:00Z` que la
    // contradecía: pedía que un timestamp NO se convirtiera. De ahí salía «actualizada mañana»
    // después de las 21:00 — el sello de las 21:30 del 5 llega como `2026-10-06T00:30Z` y se
    // leía como el 6. Un instante tiene zona; el día que se muestra es el que se ve desde Chile.
    expect(formatDateShort("2026-08-23T00:00:00Z")).toBe("22 ago"); // 21:00 del 22 en Chile
    expect(formatDateShort("2026-08-23T12:00:00Z")).toBe("23 ago"); // 08:00 del 23 en Chile
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

describe("formatDateHeading", () => {
  it("día civil en Chile con mes largo", () => {
    expect(formatDateHeading("2026-10-09")).toBe("9 de octubre de 2026");
    expect(formatDateHeading(new Date(2026, 9, 9, 12))).toBe("9 de octubre de 2026");
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
    //
    // Las horas son de CHILE, no del runner. Antes la fixture se armaba con
    // `new Date(2026, 7, 22, 23, 0)` —hora local de quien corriera el test— y pasaba en
    // cualquier huso porque el formateador tambien leia el huso local: los dos lados se movian
    // juntos y el test no fijaba nada. Con el dia anclado a Chile solo se mueve un lado, asi
    // que la fixture tiene que decir en que huso estan esas 23:00. En agosto Chile es UTC-4.
    expect(formatRelative(enChile(2026, 8, 22, 23, 0), HOY)).toBe("ayer");
    expect(formatRelative(enChile(2026, 8, 23, 0, 30), HOY)).toBe("hoy");
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
  it("HH:MM en hora de Chile, con cero a la izquierda", () => {
    expect(formatHoraCorta(enChile(2026, 8, 30, 8, 12))).toBe("08:12");
    expect(formatHoraCorta(enChile(2026, 8, 30, 23, 5))).toBe("23:05");
  });

  it("acepta el ISO del backend y lo muestra en hora de Chile, no la del navegador", () => {
    // El sello viaja en UTC. Un CFO en Santiago y el mismo CFO de viaje tienen que leer la
    // MISMA hora: la que el banco informo. Antes esta asercion derivaba el esperado de
    // `d.getHours()`, o sea del huso del runner, y por eso no podia detectar lo contrario.
    expect(formatHoraCorta("2026-08-30T12:12:00Z")).toBe("08:12"); // agosto: Chile es UTC-4
  });

  it("null / vacío / no reconocido → 's/d'", () => {
    expect(formatHoraCorta(null)).toBe("s/d");
    expect(formatHoraCorta("")).toBe("s/d");
    expect(formatHoraCorta("no-es-fecha")).toBe("s/d");
  });
});
