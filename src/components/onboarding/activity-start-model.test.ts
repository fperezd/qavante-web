import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  contractShapeOf,
  type LegalEntityActivityStartItem,
  type OnboardingActivityStartResponse,
} from "@/lib/api/onboarding-activity-start";
import {
  DISTINCION_COPY,
  activityStartErrorCopy,
  declaracionInvalida,
  declaredLine,
  entityRow,
  liveDebtLine,
  liveDebtTotal,
  overlapLine,
  provenanceCopy,
  unattributedLine,
  unattributedTotal,
} from "./activity-start-model";

/* Fixture CON LAS CIFRAS DE PRODUCCIÓN medidas el 2026-10-04 para el tenant con fecha
   heredada: 220 compras en 15 períodos por $175.878.842 y 175 ventas en 12 períodos por
   $434.357.257 sin atribuir, y 6 de 6 sociedades con la fecha heredada de una carga anterior.
   El caso del corte es el de Fernando: importación desde el 2026-03-01 con corte al
   2026-08-31 → cinco meses. */

function entidad(over: Partial<LegalEntityActivityStartItem> = {}): LegalEntityActivityStartItem {
  return {
    legal_entity_id: "a58a2ea8-0000-0000-0000-000000000001",
    legal_name: "Tooxs Digital SpA",
    effective_from: "2024-07-02",
    declared: false,
    provenance: "inherited_from_backfill",
    ...over,
  };
}

/** Las SEIS sociedades medidas en producción: 6 de 6 con la fecha heredada, cero declaradas. */
const SEIS = [
  "Tooxs Digital SpA",
  "Tooxs Servicios SpA",
  "Tooxs Retail SpA",
  "Tooxs Holding SpA",
  "Tooxs Logistica SpA",
  "Tooxs Consultoria SpA",
].map((legal_name, i) =>
  entidad({ legal_name, legal_entity_id: `a58a2ea8-0000-0000-0000-00000000000${i + 1}` }),
);

const CENSO: OnboardingActivityStartResponse = {
  entities: SEIS,
  declared_count: 0,
  undeclared_count: 6,
  unattributed_history: {
    documents: 395,
    amount: "610236099.00",
    payables_documents: 220,
    payables_periods: 15,
    payables_amount: "175878842.00",
    receivables_documents: 175,
    receivables_periods: 12,
    receivables_amount: "434357257.00",
  },
  live_debt_protected: {
    payables_count: 93,
    payables_amount: "48200100.00",
    receivables_count: 41,
    receivables_amount: "12750000.00",
  },
  opening_cutoff_overlap: {
    active: true,
    cutoff_date: "2026-08-31",
    import_start_date: "2026-03-01",
    overlap_months: 5,
    detail: "prosa del productor, con montos crudos",
  },
  summary: "prosa del productor, con montos crudos",
};

function con(over: Partial<OnboardingActivityStartResponse>): OnboardingActivityStartResponse {
  return { ...CENSO, ...over };
}

/** Todo el copy que esta pantalla puede llegar a imprimir, para barrerlo de una pasada. */
function todoElCopy(res: OnboardingActivityStartResponse): string {
  const filas = res.entities.map(entityRow);
  return [
    declaredLine(res),
    unattributedLine(res),
    unattributedTotal(res).cobertura,
    liveDebtLine(res),
    liveDebtTotal(res).cobertura,
    overlapLine(res),
    DISTINCION_COPY.inicioTexto,
    DISTINCION_COPY.ventanaTexto,
    ...filas.map((f) => f.linea),
    ...filas.map((f) => f.etiqueta),
    declaracionInvalida("") ?? "",
    declaracionInvalida("1970-01-01") ?? "",
    activityStartErrorCopy(new ApiError("x", 409, "activity_start_census_scope")),
    activityStartErrorCopy(new ApiError("x", 403)),
    activityStartErrorCopy(new ApiError("x", 404, "legal_entity_not_found")),
    activityStartErrorCopy(new ApiError("x", 422, "invalid_activity_start_date")),
    activityStartErrorCopy(new Error("boom")),
  ].join(" \n ");
}

describe("la transcripción del contrato es la medida, no la buena fe", () => {
  /* Los tipos están a mano porque el snapshot que este repo versiona todavía no trae este
     contrato (y sincronizarlo arrastra 27 errores de tipo en 7 archivos de `src/`, medidos el
     2026-10-04). Esta prueba fija la forma campo por campo: si alguien le agrega o le quita un
     campo a la transcripción sin medirla contra el esquema, cae acá. */
  it("el censo trae exactamente los siete campos del esquema", () => {
    expect(Object.keys(CENSO).sort()).toEqual([...contractShapeOf.response].sort());
  });

  it("cada bloque del censo trae exactamente los campos del esquema", () => {
    expect(CENSO.entities).toHaveLength(6);
    expect(Object.keys(CENSO.entities[0]!).sort()).toEqual([...contractShapeOf.entity].sort());
    expect(Object.keys(CENSO.unattributed_history).sort()).toEqual(
      [...contractShapeOf.unattributed].sort(),
    );
    expect(Object.keys(CENSO.live_debt_protected).sort()).toEqual(
      [...contractShapeOf.liveDebt].sort(),
    );
    expect(Object.keys(CENSO.opening_cutoff_overlap).sort()).toEqual(
      [...contractShapeOf.overlap].sort(),
    );
  });

  it("las tres procedencias del contrato, ni una más", () => {
    expect(contractShapeOf.provenances).toEqual([
      "declared_by_company",
      "inherited_from_backfill",
      "platform_default",
    ]);
  });
});

describe("una fecha heredada NO se presenta como declarada", () => {
  it("las tres procedencias tienen rótulo distinto y sólo una es una declaración", () => {
    const declarada = provenanceCopy("declared_by_company");
    const heredada = provenanceCopy("inherited_from_backfill");
    const omision = provenanceCopy("platform_default");
    expect(declarada.tone).toBe("declarada");
    expect(heredada.tone).toBe("heredada");
    expect(omision.tone).toBe("heredada");
    expect(new Set([declarada.etiqueta, heredada.etiqueta, omision.etiqueta]).size).toBe(3);
    /* El rótulo de una fecha heredada no puede contener la palabra con que se nombra una
       declarada: es exactamente la confusión que este paso cierra. */
    expect(heredada.etiqueta.toLowerCase()).not.toContain("declarada");
    expect(omision.etiqueta.toLowerCase()).not.toContain("declarada");
    expect(declarada.etiqueta.toLowerCase()).toContain("declarada");
  });

  it("una procedencia que el contrato todavía no tiene se lee como HEREDADA", () => {
    expect(provenanceCopy("algo_que_vendra_despues").tone).toBe("heredada");
  });

  it("`declared: true` con una procedencia que no es la declaración NO cuenta como declarada", () => {
    /* Candado contra el modo de falla más caro: que un `declared` suelto alcance para pintar
       como dato lo que es un artefacto. Manda la procedencia. */
    const fila = entityRow(entidad({ declared: true, provenance: "inherited_from_backfill" }));
    expect(fila.declarada).toBe(false);
    expect(fila.valorInicial).toBe("");
  });
});

describe("nada se pre-llena", () => {
  it("una sociedad sin declarar llega con el campo VACÍO", () => {
    expect(entityRow(entidad()).valorInicial).toBe("");
    expect(entityRow(entidad({ provenance: "platform_default" })).valorInicial).toBe("");
  });

  it("una sociedad declarada refleja SU propia declaración en el campo", () => {
    const fila = entityRow(
      entidad({ declared: true, provenance: "declared_by_company", effective_from: "2017-01-01" }),
    );
    expect(fila.declarada).toBe(true);
    expect(fila.valorInicial).toBe("2017-01-01");
    expect(fila.linea).toContain("01-01-2017");
  });
});

describe("una sociedad sin declarar no se ve como un vacío ni como un cero", () => {
  it("la fila dice qué fecha rige hoy y quién la puso", () => {
    const fila = entityRow(entidad());
    expect(fila.linea).toContain("02-07-2024");
    expect(fila.linea).toContain("carga anterior");
    expect(fila.linea).not.toBe("");
  });

  it("el 1970 se nombra como lo que es: una sociedad figurando existiendo desde 1970", () => {
    const fila = entityRow(
      entidad({ provenance: "platform_default", effective_from: "1970-01-01" }),
    );
    expect(fila.linea).toContain("01-01-1970");
    expect(fila.linea).toContain("1970");
    expect(fila.linea).toContain("por omisión");
  });

  it("el censo trae los dos números y la plata que cubren", () => {
    expect(declaredLine(CENSO)).toContain("0 de 6 sociedades declararon");
    expect(declaredLine(CENSO)).toContain("faltan 6");
    const linea = unattributedLine(CENSO);
    expect(linea).toContain("220");
    expect(linea).toContain("15");
    expect(linea).toContain("$175.878.842");
    expect(linea).toContain("175");
    expect(linea).toContain("12");
    expect(linea).toContain("$434.357.257");
    expect(unattributedTotal(CENSO).monto).toBe("$610.236.099");
    expect(unattributedTotal(CENSO).cobertura).toContain("395");
  });

  it("cuando no queda historia sin atribuir igual imprime el número, no un vacío", () => {
    const vacio = con({
      unattributed_history: {
        documents: 0,
        amount: "0.00",
        payables_documents: 0,
        payables_periods: 0,
        payables_amount: "0.00",
        receivables_documents: 0,
        receivables_periods: 0,
        receivables_amount: "0.00",
      },
    });
    expect(unattributedLine(vacio)).toContain("0 documentos de compra");
    expect(unattributedTotal(vacio).monto).toBe("$0");
    expect(unattributedTotal(vacio).cobertura).toContain("0 documentos");
  });

  it("todas declaradas se dice con los dos números, sin celebrar un vacío", () => {
    const todo = con({ declared_count: 6, undeclared_count: 0 });
    expect(declaredLine(todo)).toContain("6 de 6");
    expect(declaredLine(todo)).toContain("declararon desde cuándo existen");
  });
});

describe("la deuda viva va al lado, etiquetada como lo que SIGUE contando", () => {
  it("dice las dos puntas con su plata y por qué no se apaga", () => {
    const linea = liveDebtLine(CENSO);
    expect(linea).toContain("93");
    expect(linea).toContain("$48.200.100");
    expect(linea).toContain("41");
    expect(linea).toContain("$12.750.000");
    expect(linea).toContain("siguen contando en tu posición");
    expect(linea).toContain("se exige hoy");
  });

  it("el rótulo del número grande dice que SIGUE contando, no que está pendiente", () => {
    expect(liveDebtTotal(CENSO).cuentas).toBe("134 cuentas");
    expect(liveDebtTotal(CENSO).cobertura).toContain("SIGUEN contando");
  });
});

describe("el solape del corte explica por qué ves documentos saldados", () => {
  it("el caso real: cinco meses entre el 01-03-2026 y el corte al 31-08-2026", () => {
    const linea = overlapLine(CENSO);
    expect(linea).toContain("01-03-2026");
    expect(linea).toContain("31-08-2026");
    expect(linea).toContain("5 meses");
    expect(linea).toContain("marcó como saldados");
  });

  it("sin solape imprime el cero y dice que las dos fechas no se pisan", () => {
    const linea = overlapLine(
      con({
        opening_cutoff_overlap: { ...CENSO.opening_cutoff_overlap, overlap_months: 0 },
      }),
    );
    expect(linea).toContain("0 meses");
    expect(linea).toContain("no se pisan");
  });

  it("sin corte aplicado igual imprime un número y no una ausencia", () => {
    const linea = overlapLine(
      con({
        opening_cutoff_overlap: {
          active: false,
          cutoff_date: null,
          import_start_date: "2026-03-01",
          overlap_months: 0,
          detail: "",
        },
      }),
    );
    expect(linea).toContain("0 meses");
    expect(linea).toContain("01-03-2026");
    expect(linea).not.toContain("s/d");
  });
});

describe("las dos declaraciones que se parecen quedan separadas", () => {
  it("cada una con su alcance y su tope, y los dos rótulos distintos", () => {
    expect(DISTINCION_COPY.inicioTitulo).not.toBe(DISTINCION_COPY.ventanaTitulo);
    expect(DISTINCION_COPY.inicioTexto).toContain("2017");
    expect(DISTINCION_COPY.inicioTexto).toContain("no tiene tope");
    expect(DISTINCION_COPY.ventanaTexto).toContain("seis meses");
  });

  it("el copy de la fecha de inicio NO nombra al SII como fuente de la fecha", () => {
    /* Fernando rechazó de plano leer la fecha del SII el 2026-10-04. Que el copy del paso no
       la mencione como origen es parte del encargo. */
    expect(DISTINCION_COPY.inicioTexto).not.toContain("SII");
  });
});

describe("lo que puede salir mal dice qué pasó y qué hacer", () => {
  it("una fecha vacía se rechaza antes del viaje", () => {
    expect(declaracionInvalida("")).toContain("Escribe desde cuándo existe");
    expect(declaracionInvalida("   ")).not.toBeNull();
  });

  it("el 1970-01-01 se rechaza con la MISMA razón que da el productor", () => {
    const local = declaracionInvalida("1970-01-01");
    expect(local).toContain("01-01-1970");
    expect(local).toContain("por omisión");
    expect(activityStartErrorCopy(new ApiError("x", 422))).toContain("por omisión");
  });

  it("una fecha de 2017 es válida: la declaración no tiene tope", () => {
    expect(declaracionInvalida("2017-01-01")).toBeNull();
  });

  it("el 409 del alcance explica que el recuento es de todas las sociedades", () => {
    const copy = activityStartErrorCopy(new ApiError("x", 409, "activity_start_census_scope"));
    expect(copy).toContain("todas las sociedades");
    expect(copy).toContain("Cambia el alcance");
  });

  it("el 403 nombra el rol que sí puede declarar", () => {
    expect(activityStartErrorCopy(new ApiError("x", 403))).toContain("administrador");
  });

  it("el 404 dice que la sociedad ya no es de esta empresa", () => {
    expect(activityStartErrorCopy(new ApiError("x", 404))).toContain("ya no pertenece");
  });
});

describe("reglas de copy de la casa", () => {
  const PROHIBIDAS = [
    "no disponible",
    "sin dato",
    "no hay",
    "preliminar",
    "estimado",
    "no evaluable",
    "s/d",
    "confianza",
  ];

  it("ninguna frase de esta pantalla usa una palabra de desconfianza ni una abstención", () => {
    const copy = todoElCopy(CENSO).toLowerCase();
    for (const prohibida of PROHIBIDAS) {
      expect(copy, `"${prohibida}" aparece en el copy del paso`).not.toContain(prohibida);
    }
  });

  it("tampoco con el censo en cero, que es donde las abstenciones se cuelan", () => {
    const vacio = con({
      entities: [entidad({ provenance: "platform_default", effective_from: "1970-01-01" })],
      declared_count: 0,
      undeclared_count: 1,
      unattributed_history: {
        documents: 0,
        amount: "0.00",
        payables_documents: 0,
        payables_periods: 0,
        payables_amount: "0.00",
        receivables_documents: 0,
        receivables_periods: 0,
        receivables_amount: "0.00",
      },
      live_debt_protected: {
        payables_count: 0,
        payables_amount: "0.00",
        receivables_count: 0,
        receivables_amount: "0.00",
      },
      opening_cutoff_overlap: {
        active: false,
        cutoff_date: null,
        import_start_date: "2026-03-01",
        overlap_months: 0,
        detail: "",
      },
    });
    const copy = todoElCopy(vacio).toLowerCase();
    for (const prohibida of PROHIBIDAS) {
      expect(copy, `"${prohibida}" aparece en el copy del paso con el censo en cero`).not.toContain(
        prohibida,
      );
    }
  });

  it("la prosa del productor NO se imprime: el copy se arma con los números", () => {
    /* `summary` y `opening_cutoff_overlap.detail` traen los montos sin formatear. Si alguien
       los pasa a la pantalla, esta prueba cae. */
    const copy = todoElCopy(CENSO);
    expect(copy).not.toContain(CENSO.summary);
    expect(copy).not.toContain("175878842");
  });

  it("cada frase del censo lleva al menos un número", () => {
    const frases = [
      declaredLine(CENSO),
      unattributedLine(CENSO),
      liveDebtLine(CENSO),
      overlapLine(CENSO),
    ];
    for (const frase of frases) {
      expect(frase, `"${frase}" no trae ningún número`).toMatch(/\d/);
    }
  });
});
