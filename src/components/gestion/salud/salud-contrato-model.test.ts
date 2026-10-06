import { describe, expect, it } from "vitest";
import type { SaludResponse, SaludScoreSnapshot } from "@/lib/api/salud";
import { saludContratoModel } from "./salud-contrato-model";

/* Lo que estos tests defienden es el comportamiento, no la forma: se invoca el modelo con
   respuestas del contrato y se lee lo que una persona vería. Dos de ellos son el corazón del
   encargo —qué se dice cuando falta un instrumento y qué se dice cuando la lectura está
   incompleta— y uno es un barrido de vocabulario sobre TODO el texto producido. */

const SCOPE: SaludResponse["scope"] = {
  as_of: "2026-09-30",
  currency: "CLP",
  legal_entity_id: "11111111-1111-4111-8111-111111111111",
  legal_entity_provenance: "explicit",
  tenant_id: "22222222-2222-4222-8222-222222222222",
};

function pulso(extra: Partial<SaludScoreSnapshot> = {}): SaludScoreSnapshot {
  return {
    instrument: "pulso",
    score: 68,
    band: "stable",
    score_date: "2026-09-30",
    model_version: "PULSO-2.0",
    preliminary: false,
    definitive: true,
    trend_delta: 3,
    data_confidence: null,
    knockout_code: null,
    subindices: [
      { code: "COB", value: 72, weight: 0.4, band: "stable" },
      { code: "RUN", value: 61, weight: 0.25, band: null },
      { code: "DPC", value: 80, weight: 0.2, band: null },
      { code: "CAL", value: 55, weight: 0.15, band: null },
    ],
    drivers: [],
    quality: [],
    trend: [
      { score_date: "2026-08-31", score: 65, band: "stable", preliminary: false },
      { score_date: "2026-09-30", score: 68, band: "stable", preliminary: false },
    ],
    ...extra,
  };
}

function qhs(extra: Partial<SaludScoreSnapshot> = {}): SaludScoreSnapshot {
  return {
    instrument: "qhs",
    score: 57,
    band: "observacion",
    score_date: "2026-08-31",
    model_version: "QHS-1.0",
    preliminary: true,
    definitive: false,
    trend_delta: -4,
    data_confidence: 72,
    knockout_code: null,
    subindices: [
      { code: "TRAY", value: 60, weight: 0.25, band: "observacion" },
      { code: "GEN", value: 48, weight: 0.25, band: "vulnerable" },
      { code: "RES", value: 70, weight: 0.2, band: "sana_alertas" },
    ],
    drivers: [
      {
        reason_code: "QHS_UNKNOWN_CURRENCY",
        description: null,
        subindex_code: "GEN",
        severity: "medium",
        direction: "negative",
        impact_points: -3,
      },
    ],
    quality: [
      { code: "QHS_GUARDRAIL_PULSE_30D_EVIDENCE", value: 1, weight: null, detail: null },
      { code: "QHS_SUBINDEX_METHODOLOGY_EVIDENCE", value: 0, weight: null, detail: null },
      { code: "DATA_CONFIDENCE", value: 72, weight: null, detail: null },
      { code: "DATA_CONFIDENCE:freshness", value: 1, weight: 30, detail: null },
      { code: "DATA_CONFIDENCE:completeness", value: 0, weight: 25, detail: null },
    ],
    trend: [{ score_date: "2026-08-31", score: 57, band: "observacion", preliminary: true }],
    ...extra,
  };
}

function respuesta(extra: Partial<SaludResponse> = {}): SaludResponse {
  return {
    scope: SCOPE,
    generated_at: "2026-10-06T11:30:00Z",
    pulso: pulso(),
    qhs: qhs(),
    ...extra,
  };
}

/** Todo el texto que el modelo produce, para barrerlo de una sola pasada. */
function textoVisible(valor: unknown): string {
  return JSON.stringify(valor);
}

const PROHIBIDO = [
  /no disponible/i,
  /sin dato/i,
  /no hay/i,
  /preliminar/i,
  /estimad[oa]/i,
  /no evaluable/i,
  /tenant/i,
];

describe("saludContratoModel · ausencia de un instrumento", () => {
  it("dice con número cuánto cubre la lectura cuando falta el Health Score", () => {
    const vista = saludContratoModel(respuesta({ qhs: null }));

    expect(vista.instrumentos.map((item) => item.instrumento)).toEqual(["pulso"]);
    expect(vista.ausencias).toHaveLength(1);
    expect(vista.ausencias[0]?.cobertura).toBe(
      "El Health Score se compone con 5 partes y esta lectura, al corte del 30 sep 2026, trae 0 de ellas. " +
        "El Pulso del 30 sep 2026 sí entra, con 68 de 100 sobre 4 de sus 4 partes.",
    );
  });

  it("no fabrica un puntaje ni una clasificación para el instrumento ausente", () => {
    const vista = saludContratoModel(respuesta({ qhs: null }));

    const ausencia = vista.ausencias[0];
    expect(ausencia?.titulo).toBe("Health Score");
    expect(Object.keys(ausencia ?? {})).toEqual(["instrumento", "titulo", "cobertura"]);
    expect(ausencia?.cobertura).not.toMatch(/0 de 100/);
  });

  it("cuenta los dos instrumentos cuando ninguno entra, sin inventar ninguno", () => {
    const vista = saludContratoModel(respuesta({ pulso: null, qhs: null }));

    expect(vista.instrumentos).toHaveLength(0);
    expect(vista.ausencias.map((item) => item.instrumento)).toEqual(["pulso", "qhs"]);
    expect(vista.ausencias[0]?.cobertura).toContain("trae 0 de ellas");
    expect(vista.ausencias[0]?.cobertura).toContain("cubre 0 de los 9 componentes");
  });
});

describe("saludContratoModel · lectura incompleta", () => {
  it("expresa la incompletitud como cobertura con número, no como una etiqueta", () => {
    const vista = saludContratoModel(respuesta());

    const health = vista.instrumentos.find((item) => item.instrumento === "qhs");
    expect(health?.cobertura).toBe(
      "Esta lectura cubre 3 de las 5 partes que componen el Health Score, " +
        "con 1 de 2 verificaciones acreditadas y 1 motivo que la explica.",
    );
  });

  it("muestra el puntaje aunque la lectura venga incompleta, con su corte y su modelo", () => {
    const vista = saludContratoModel(respuesta());

    const health = vista.instrumentos.find((item) => item.instrumento === "qhs");
    expect(health?.score).toBe("57 de 100");
    expect(health?.banda).toBe("En observación");
    expect(health?.corte).toBe("31 ago 2026");
    expect(health?.version).toBe("QHS-1.0");
    expect(health?.variacion).toBe("−4 puntos respecto del corte anterior.");
  });

  it("nunca usa el vocabulario que esconde la cifra", () => {
    const completa = textoVisible(saludContratoModel(respuesta()));
    const incompleta = textoVisible(saludContratoModel(respuesta({ qhs: null })));

    for (const patron of PROHIBIDO) {
      expect(completa).not.toMatch(patron);
      expect(incompleta).not.toMatch(patron);
    }
  });
});

describe("saludContratoModel · motivos", () => {
  it("redacta el motivo desde el catálogo cuando el contrato no trae descripción", () => {
    const vista = saludContratoModel(respuesta());

    const health = vista.instrumentos.find((item) => item.instrumento === "qhs");
    expect(health?.motivos).toHaveLength(1);
    expect(health?.motivos[0]?.texto).toContain("Hay movimientos cuya moneda ninguna fuente");
    expect(health?.motivos[0]?.tipo).toBe("limite");
    expect(health?.motivos[0]?.impacto).toBe("Resta 3 puntos.");
    expect(health?.motivos[0]?.parte).toBe("Generación de caja de la operación");
    expect(health?.motivosPorNombrar).toHaveLength(0);
  });

  it("prefiere la redacción del contrato sobre la del catálogo", () => {
    const vista = saludContratoModel(
      respuesta({
        qhs: qhs({
          drivers: [
            {
              reason_code: "QHS_UNKNOWN_CURRENCY",
              description: "Tres transferencias llegaron sin moneda acreditada.",
              subindex_code: null,
              severity: null,
              direction: null,
              impact_points: null,
            },
          ],
        }),
      }),
    );

    const health = vista.instrumentos.find((item) => item.instrumento === "qhs");
    expect(health?.motivos[0]?.texto).toBe("Tres transferencias llegaron sin moneda acreditada.");
  });

  it("no convierte un motivo desconocido en una frase ni en una categoría", () => {
    const vista = saludContratoModel(
      respuesta({
        qhs: qhs({
          drivers: [
            {
              reason_code: "QHS_MOTIVO_QUE_NADIE_MAPEO",
              description: null,
              subindex_code: "DEBT",
              severity: null,
              direction: null,
              impact_points: null,
            },
          ],
        }),
      }),
    );

    const health = vista.instrumentos.find((item) => item.instrumento === "qhs");
    expect(health?.motivos).toHaveLength(0);
    expect(health?.motivosPorNombrar).toEqual([
      { identificador: "QHS_MOTIVO_QUE_NADIE_MAPEO", detalle: "DEBT" },
    ]);
  });

  it("marca el tope cuando el contrato declara un knockout", () => {
    const vista = saludContratoModel(
      respuesta({
        pulso: pulso({
          knockout_code: "DPC_LE_10",
          drivers: [
            {
              reason_code: "DPC_LE_10",
              description: null,
              subindex_code: "DPC",
              severity: "high",
              direction: "negative",
              impact_points: null,
            },
          ],
        }),
      }),
    );

    const lectura = vista.instrumentos.find((item) => item.instrumento === "pulso");
    expect(lectura?.tope?.texto).toContain("10 días o menos");
  });
});

describe("saludContratoModel · bandas y pesos", () => {
  it("no clasifica cuando la banda llega con un identificador que no nombra", () => {
    const vista = saludContratoModel(respuesta({ qhs: qhs({ band: "banda_nueva" }) }));

    const health = vista.instrumentos.find((item) => item.instrumento === "qhs");
    expect(health?.banda).toBeNull();
    expect(health?.bandaIdentificador).toBe("banda_nueva");
    expect(health?.score).toBe("57 de 100");
  });

  it("muestra el mismo peso venga en fracción o en puntos", () => {
    const enFraccion = saludContratoModel(respuesta());
    const enPuntos = saludContratoModel(
      respuesta({
        qhs: qhs({
          subindices: [
            { code: "TRAY", value: 60, weight: 25, band: null },
            { code: "GEN", value: 48, weight: 25, band: null },
            { code: "RES", value: 70, weight: 20, band: null },
          ],
        }),
      }),
    );

    const peso = (vista: ReturnType<typeof saludContratoModel>) =>
      vista.instrumentos.find((item) => item.instrumento === "qhs")?.subindices[0]?.peso;
    expect(peso(enFraccion)).toBe("25%");
    expect(peso(enPuntos)).toBe("25%");
  });

  it("nombra el subíndice y deja el identificador sólo cuando no lo conoce", () => {
    const vista = saludContratoModel(
      respuesta({
        qhs: qhs({ subindices: [{ code: "NUEVO", value: 10, weight: 1, band: null }] }),
      }),
    );

    const health = vista.instrumentos.find((item) => item.instrumento === "qhs");
    expect(health?.subindices[0]?.etiqueta).toBe("");
    expect(health?.subindices[0]?.identificador).toBe("NUEVO");
    expect(health?.subindices[0]?.valor).toBe("10 puntos");
  });
});

describe("saludContratoModel · respaldo del dato y serie", () => {
  it("cuenta con número qué sostiene el respaldo del dato", () => {
    const vista = saludContratoModel(respuesta());

    const respaldo = vista.instrumentos.find((item) => item.instrumento === "qhs")?.respaldo;
    expect(respaldo?.valor).toBe("72 de 100");
    expect(respaldo?.resumen).toBe("30 puntos acreditados de 55 que ponderan esta lectura.");
    expect(respaldo?.componentes).toEqual([
      { etiqueta: "Frescura de las fuentes", valor: "30 puntos de 30" },
      { etiqueta: "Completitud de la información", valor: "0 puntos de 25" },
    ]);
    expect(respaldo?.verificaciones).toEqual([
      { etiqueta: "Cómo te fue en los últimos 30 días", acreditada: true },
      { etiqueta: "El método ratificado de las cinco partes", acreditada: false },
    ]);
  });

  it("omite el respaldo cuando el contrato no lo publica, sin reemplazarlo por un cero", () => {
    const vista = saludContratoModel(respuesta());

    const lectura = vista.instrumentos.find((item) => item.instrumento === "pulso");
    expect(lectura?.respaldo).toBeNull();
  });

  it("entrega la serie con su fecha y su altura relativa al mayor corte", () => {
    const vista = saludContratoModel(respuesta());

    const lectura = vista.instrumentos.find((item) => item.instrumento === "pulso");
    expect(lectura?.tendencia).toEqual([
      { clave: "2026-08-31", fecha: "31 ago 2026", valor: "65 de 100", alturaRelativa: 96 },
      { clave: "2026-09-30", fecha: "30 sep 2026", valor: "68 de 100", alturaRelativa: 100 },
    ]);
  });

  it("declara el corte y la moneda del scope, no los del navegador", () => {
    const vista = saludContratoModel(respuesta());

    expect(vista.corte).toBe("30 sep 2026");
    expect(vista.moneda).toBe("CLP");
    expect(vista.sello).toBe("6 oct 2026");
  });
});
