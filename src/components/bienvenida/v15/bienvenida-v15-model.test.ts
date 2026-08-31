import { describe, expect, it } from "vitest";
import type { OnboardingSourceStates } from "@/lib/api/onboarding-sources";
import {
  DURACION_TIPICA_MODELO,
  ETAPAS_MODELO_V15,
  HORA_PRIMER_PARTE,
  TIEMPO_CONEXION,
  fuentesConectadas,
  fuentesPendientes,
  fuentesV15,
  progresoModeloV15,
  promesaPrimerParte,
} from "./bienvenida-v15-model";

/* V15 · Bienvenida — el modelo puro, sin DOM. Lo que se fija acá:
 *   · Paso 1 — cada fuente trae su estado, descripción (Ley 1: misma frase que `/conexiones`) y
 *     tiempo de conexión declarado, sólo mientras NO está conectada.
 *   · Paso 2 — el hueco: NUNCA un conteo/porcentaje inventado, siempre las etapas + la duración
 *     típica declarada.
 *   · Paso 3 — la promesa cae SIEMPRE al día calendario siguiente en Santiago, sin importar el
 *     huso del runtime que corre el test. */

const AMBAS_CONECTADAS: OnboardingSourceStates = { sii: "connected", bank: "connected" };
const NINGUNA_CONECTADA: OnboardingSourceStates = { sii: "pending", bank: "pending" };
const MIXTO: OnboardingSourceStates = { sii: "connected", bank: "deferred" };

describe("fuentesV15 — paso 1: estado + tiempo estimado por conexión", () => {
  it("trae las dos fuentes del wizard, en el orden canónico (sii, bank)", () => {
    const f = fuentesV15(AMBAS_CONECTADAS);
    expect(f.map((x) => x.id)).toEqual(["sii", "bank"]);
  });

  it("una fuente CONECTADA no lleva tiempo de conexión (ya no aplica)", () => {
    const f = fuentesV15(AMBAS_CONECTADAS);
    expect(f.every((x) => x.tiempoConexion === null)).toBe(true);
  });

  it("[control positivo] una fuente NO conectada SÍ lleva su tiempo típico declarado", () => {
    const f = fuentesV15(NINGUNA_CONECTADA);
    expect(f.find((x) => x.id === "sii")?.tiempoConexion).toBe(TIEMPO_CONEXION.sii);
    expect(f.find((x) => x.id === "bank")?.tiempoConexion).toBe(TIEMPO_CONEXION.bank);
  });

  it("una fuente DIFERIDA también lleva su tiempo de conexión (todavía no está conectada)", () => {
    const f = fuentesV15(MIXTO);
    expect(f.find((x) => x.id === "bank")?.tiempoConexion).toBe(TIEMPO_CONEXION.bank);
  });

  it("la descripción de cada fuente es la MISMA que el hub /conexiones (Ley 1)", () => {
    const f = fuentesV15(NINGUNA_CONECTADA);
    // sourceStateDescription("sii","pending") ya está cubierto en onboarding-source-meta.test.ts;
    // acá se verifica que ESTE modelo la reusa, no que la redacta de nuevo.
    expect(f.find((x) => x.id === "sii")?.descripcion).toMatch(/sin el sii no vemos/i);
  });

  it("la acción de una fuente conectada es 'Revisar conexión'; de una pendiente, 'Conectar ahora'", () => {
    expect(fuentesV15(AMBAS_CONECTADAS)[0]!.accion).toBe("Revisar conexión");
    expect(fuentesV15(NINGUNA_CONECTADA)[0]!.accion).toBe("Conectar ahora");
  });

  it("cada fuente lleva un href de navegación no vacío", () => {
    for (const f of fuentesV15(MIXTO)) {
      expect(f.href.length).toBeGreaterThan(0);
    }
  });
});

describe("fuentesConectadas / fuentesPendientes", () => {
  it("con las dos conectadas, ninguna queda pendiente", () => {
    const f = fuentesV15(AMBAS_CONECTADAS);
    expect(fuentesConectadas(f)).toHaveLength(2);
    expect(fuentesPendientes(f)).toHaveLength(0);
  });

  it("[control positivo] sin ninguna conectada, las dos quedan pendientes", () => {
    const f = fuentesV15(NINGUNA_CONECTADA);
    expect(fuentesConectadas(f)).toHaveLength(0);
    expect(fuentesPendientes(f)).toHaveLength(2);
  });

  it("mixto: una conectada, una pendiente (diferida cuenta como pendiente para este propósito)", () => {
    const f = fuentesV15(MIXTO);
    expect(fuentesConectadas(f)).toHaveLength(1);
    expect(fuentesPendientes(f)).toHaveLength(1);
  });
});

describe("progresoModeloV15 — paso 2: el hueco declarado, NUNCA un número inventado", () => {
  it("sin ninguna fuente conectada, no hay nada que construir todavía", () => {
    const p = progresoModeloV15(fuentesV15(NINGUNA_CONECTADA));
    expect(p.hayAlgoQueConstruir).toBe(false);
    expect(p.fuentesActivas).toBe(0);
  });

  it("[control positivo] con al menos una fuente conectada, SÍ hay algo que construir", () => {
    const p = progresoModeloV15(fuentesV15(MIXTO));
    expect(p.hayAlgoQueConstruir).toBe(true);
    expect(p.fuentesActivas).toBe(1);
  });

  it("con las dos conectadas, cuenta las dos", () => {
    const p = progresoModeloV15(fuentesV15(AMBAS_CONECTADAS));
    expect(p.fuentesActivas).toBe(2);
  });

  it("las etapas son los VERBOS del proceso, en el orden en que ocurre — no un contador", () => {
    const p = progresoModeloV15(fuentesV15(AMBAS_CONECTADAS));
    expect(p.etapas).toBe(ETAPAS_MODELO_V15);
    expect(p.etapas.length).toBeGreaterThan(0);
    for (const etapa of p.etapas) {
      // Ningún verbo lleva un número de por sí — son descripciones de trabajo, no contadores.
      expect(etapa.verbo).not.toMatch(/\d/);
    }
  });

  it("la duración típica es la declarada — no varía según cuántas fuentes estén conectadas", () => {
    expect(progresoModeloV15(fuentesV15(MIXTO)).duracionTipica).toBe(DURACION_TIPICA_MODELO);
    expect(progresoModeloV15(fuentesV15(AMBAS_CONECTADAS)).duracionTipica).toBe(
      DURACION_TIPICA_MODELO,
    );
  });
});

describe("promesaPrimerParte — paso 3: mañana a las 7:00, hora de Santiago", () => {
  it("la hora es siempre la declarada (7:00)", () => {
    expect(promesaPrimerParte(new Date("2026-08-30T15:00:00Z")).hora).toBe(HORA_PRIMER_PARTE);
  });

  it("la frase es literal 'mañana a las 7:00'", () => {
    expect(promesaPrimerParte(new Date("2026-08-30T15:00:00Z")).frase).toBe("mañana a las 7:00");
  });

  it("30 ago 15:00 UTC (bien entrada la tarde en Santiago, cualquiera sea el huso vigente) → mañana es 31 ago", () => {
    expect(promesaPrimerParte(new Date("2026-08-30T15:00:00Z")).fecha).toBe("2026-08-31");
  });

  it("cruce de mes: 31 ago → mañana es 1 sep", () => {
    expect(promesaPrimerParte(new Date("2026-08-31T15:00:00Z")).fecha).toBe("2026-09-01");
  });

  it("cruce de año: 31 dic → mañana es 1 ene del año siguiente", () => {
    expect(promesaPrimerParte(new Date("2026-12-31T15:00:00Z")).fecha).toBe("2027-01-01");
  });

  it("cerca de medianoche UTC, el día civil que manda es el de SANTIAGO, no el de UTC", () => {
    // 30 ago 02:00 UTC: con cualquier huso que Chile tenga vigente (UTC-3 o UTC-4) en Santiago
    // TODAVÍA es 29 ago, así que "mañana" es 30 ago — si el cálculo usara el día civil de UTC (ya
    // 30 ago), diría 31 ago.
    expect(promesaPrimerParte(new Date("2026-08-30T02:00:00Z")).fecha).toBe("2026-08-30");
  });

  it("[control positivo] doce horas más tarde el mismo día UTC, ya es 30 ago en Santiago → mañana 31", () => {
    expect(promesaPrimerParte(new Date("2026-08-30T14:00:00Z")).fecha).toBe("2026-08-31");
  });
});

/* `concordar` se movió a `src/lib/formatters/count.ts` (issue #94, re-exportado acá para no
 * romper `bienvenida-v15-view.tsx`) — su cobertura genérica vive en `count.test.ts`. El texto
 * real que arma ("1 fuente" / "quedan N fuentes") se fija en `bienvenida-v15-view.test.tsx`. */
