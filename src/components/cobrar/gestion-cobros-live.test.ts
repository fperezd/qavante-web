import { describe, expect, it } from "vitest";
import type { AccountsReceivableResponse, ReceivableDocumentItem } from "@/lib/api/cobranza";
import {
  collectedMetric,
  documentoEnHorizonteCobros,
  dueSoonTotalsFromDocuments,
  proximoCobroDesdeDocumentos,
  formatCollectionMoney,
  hasAmbiguousReminderFailure,
  isReminderEligible,
  limiteHorizonteCobros,
  matchesCollectionStatus,
  recuadroPorCobrar,
  recuadroVencido,
  reminderIdempotencyKey,
  textoDelPieDocumentos,
  textoSinCoincidencias,
} from "./gestion-cobros-live";

const BASE: ReceivableDocumentItem = {
  id: "00000000-0000-0000-0000-000000000001",
  folio: "101",
  customer_name: "Cliente de prueba",
  issue_date: "2026-09-01",
  due_date: "2026-09-15",
  due_date_certainty: "confirmed",
  status: "open",
  total_amount: "125000",
  outstanding_amount: "125000",
  currency_code: "CLP",
  days_overdue: 1,
  ceded: false,
  claimed: false,
  credit_note: false,
};

describe("filtros de gestión de cobros", () => {
  it("excluye documentos cedidos de todo lo cobrable", () => {
    const ceded = { ...BASE, ceded: true };
    expect(matchesCollectionStatus(ceded, "collectable", "2026-09-16")).toBe(false);
    expect(matchesCollectionStatus(ceded, "overdue", "2026-09-16")).toBe(false);
  });

  it("separa vencimiento desconocido de vencido", () => {
    const undated = {
      ...BASE,
      due_date: null,
      due_date_certainty: "unconfirmed" as const,
      days_overdue: null,
    };
    expect(matchesCollectionStatus(undated, "undated", "2026-09-16")).toBe(true);
    expect(matchesCollectionStatus(undated, "overdue", "2026-09-16")).toBe(false);
  });

  it("no permite recordar notas de crédito ni saldos no positivos", () => {
    expect(isReminderEligible({ ...BASE, credit_note: true })).toBe(false);
    expect(isReminderEligible({ ...BASE, outstanding_amount: "0" })).toBe(false);
    expect(isReminderEligible({ ...BASE, outstanding_amount: "-100" })).toBe(false);
    expect(isReminderEligible(BASE)).toBe(true);
  });
});

describe("totales monetarios", () => {
  it("mantiene monedas distintas explícitamente separadas", () => {
    const label = formatCollectionMoney([
      { currency: "CLP", amount: "125000" },
      { currency: "USD", amount: "12.5" },
    ]);
    expect(label).toContain("$125.000");
    expect(label).toContain("US$ 12,50");
    expect(label).toContain(" · ");
  });

  it("no convierte una abstención de cobros en $0 y dice qué hacer para tener la cifra", () => {
    const metric = collectedMetric({
      collected: null,
      collected_coverage: "unverified_legacy_collections",
      collected_reason: "legacy_collection_lineage_unavailable",
    });

    expect(metric).toEqual({
      value: "Conciliación por cerrar",
      detail: "Últimos 7 días",
      note: "Los cobros históricos se suman acá en cuanto cada uno quede conciliado con su movimiento de banco.",
      linkHref: "/banco",
      linkLabel: "Ir a Banco",
    });
  });

  /* LA FORMA QUE DE VERDAD LLEGA DE PRODUCCIÓN. Sondeo del 2026-10-03, tenant Tooxs:
   * `GET /api/treasury/accounts-receivable/documents` responde `collected: []` con
   * `collected_coverage: "not_applicable"`. #371 sólo cubrió la rama `collected: null`, así que
   * el tercer recuadro siguió mostrando "$0 · Últimos 7 días" en la pantalla que ese PR arregló. */
  it("una lista de cobros VACÍA no es un cero medido: abstiene y dice cómo tener la cifra", () => {
    const metric = collectedMetric({
      collected: [],
      collected_coverage: "not_applicable",
      collected_reason: null,
    });

    expect(metric.value).not.toContain("$0");
    expect(metric).toEqual({
      value: "Conciliación por cerrar",
      detail: "Últimos 7 días",
      note: "Los cobros de estos 7 días se suman acá en cuanto queden conciliados con sus movimientos de banco.",
      linkHref: "/banco",
      linkLabel: "Ir a Banco",
    });
  });

  it("con montos de verdad publicados, la cifra se muestra tal cual", () => {
    const metric = collectedMetric({
      collected: [{ currency: "CLP", amount: "1500000" }],
      collected_coverage: "not_applicable",
      collected_reason: null,
    });

    expect(metric).toEqual({ value: "$1.500.000", detail: "Últimos 7 días" });
  });

  it("la etiqueta de ventana sigue el horizonte de la pantalla", () => {
    const metric = collectedMetric(
      { collected: [], collected_coverage: "not_applicable", collected_reason: null },
      30,
    );
    expect(metric.detail).toBe("Últimos 30 días");
    expect(metric.note).toContain("30 días");
  });

  it("el recuadro Cobrado no usa ninguna de las palabras prohibidas con la forma de producción", () => {
    const metric = collectedMetric({
      collected: [],
      collected_coverage: "not_applicable",
      collected_reason: null,
    });

    expect(sinPalabrasProhibidas([metric.value, metric.detail, metric.note])).toEqual([]);
  });
});

/* ── El cero fabricado de Cobrar ──────────────────────────────────────────────────────────────
 *
 * Producción, tenant Tooxs, 2026-10-02: $44.829.044 por cobrar en 22 documentos y CERO con
 * fecha de vencimiento → `overdue: null`, `overdue_pct: null`, los cuatro tramos de mora en
 * `null` y `undated_amount` igual al total. El recuadro "Vencido" mostraba "$0", o sea
 * "no tienes nada vencido" sobre la cartera completa.
 *
 * El contrato ya lo decía ("`null` ... es 'no sé', no '$0'"). Lo que faltaba era que la pantalla
 * viva lo leyera: `GestionCobrosLive` tomaba `overdue` de `/documents`, donde es una lista no
 * nullable y "nada vencido" y "todavía no se puede calcular" llegan los dos como `[]`. */

/** Resumen agregado SIN una sola fecha de vencimiento: el caso vivo de producción. Los montos
 *  no son los de ningún tenant — son una cartera inventada con la misma FORMA. */
function arSinFechas(over: Partial<AccountsReceivableResponse> = {}): AccountsReceivableResponse {
  return {
    total: "9000000",
    overdue: null,
    overdue_pct: null,
    undated_amount: "9000000",
    document_count: 7,
    estimated_due_date_count: 0,
    aging: { current: "0", d1_30: null, d31_60: null, d61_90: null, d90_plus: null },
    confidence: "low",
    data_state: "partial",
    generated_at: "2026-10-02T20:00:00Z",
    ...over,
  } as AccountsReceivableResponse;
}

/** Las palabras que el dueño del producto prohibió en la UI. */
const PROHIBIDAS = [
  "no disponible",
  "sin dato",
  "sin información",
  "no hay",
  "preliminar",
  "estimado",
];

function sinPalabrasProhibidas(textos: (string | undefined)[]) {
  const junto = textos.filter(Boolean).join(" ").toLocaleLowerCase("es-CL");
  return PROHIBIDAS.filter((palabra) => junto.includes(palabra));
}

describe("recuadro Vencido · nunca un cero fabricado", () => {
  it("con la cartera entera sin fecha dice lo que SÍ se sabe, no $0", () => {
    const r = recuadroVencido(arSinFechas());

    expect(r.value).not.toContain("$0");
    // La cifra que se conoce y de qué está hecha.
    expect(r.value).toBe("$9.000.000 por cobrar");
    expect(r.detail).toBe("7 documentos");
    expect(r.note).toContain("fecha de vencimiento");
  });

  it("no usa ninguna de las palabras prohibidas", () => {
    const r = recuadroVencido(arSinFechas());
    expect(sinPalabrasProhibidas([r.value, r.detail, r.note])).toEqual([]);
  });

  it("un vencido conocido se muestra tal cual, y lo sin fechar queda declarado como lo que falta", () => {
    const r = recuadroVencido(
      arSinFechas({ overdue: "4000000", overdue_pct: "44.4", undated_amount: "1000000" }),
    );

    expect(r.value).toBe("$4.000.000");
    expect(r.detail).toBe("44,4% de la cartera");
    expect(r.note).toContain("$1.000.000");
  });

  it("con toda la cartera fechada no inventa un pendiente ni ofrece una acción de más", () => {
    const r = recuadroVencido(
      arSinFechas({ overdue: "4000000", overdue_pct: "44.4", undated_amount: "0" }),
    );

    expect(r.value).toBe("$4.000.000");
    expect(r.note).toBeUndefined();
  });

  it("un cero MEDIDO sigue siendo cero: nada vencido con todo fechado no se disfraza", () => {
    const r = recuadroVencido(arSinFechas({ overdue: "0", overdue_pct: "0", undated_amount: "0" }));

    expect(r.value).toBe("$0");
  });
});

describe("horizonte Ver cobros hasta", () => {
  it("calcula el límite civil sumando días al hoy", () => {
    expect(limiteHorizonteCobros("2026-09-01", 7)).toBe("2026-09-08");
    expect(limiteHorizonteCobros("2026-09-01", 14)).toBe("2026-09-15");
  });

  it("incluye sin fecha confirmada, lo vencido y lo que vence dentro de la ventana", () => {
    const limite = limiteHorizonteCobros("2026-09-10", 7);
    expect(
      documentoEnHorizonteCobros(
        { ...BASE, due_date: "2026-09-12", due_date_certainty: "confirmed" },
        "2026-09-10",
        limite,
      ),
    ).toBe(true);
    expect(
      documentoEnHorizonteCobros(
        { ...BASE, due_date: "2026-09-05", due_date_certainty: "confirmed", days_overdue: 5 },
        "2026-09-10",
        limite,
      ),
    ).toBe(true);
    expect(
      documentoEnHorizonteCobros(
        { ...BASE, due_date: "2026-09-20", due_date_certainty: "confirmed" },
        "2026-09-10",
        limite,
      ),
    ).toBe(false);
    expect(
      documentoEnHorizonteCobros(
        { ...BASE, due_date: null, due_date_certainty: "unconfirmed" },
        "2026-09-10",
        limite,
      ),
    ).toBe(true);
  });

  it("elige el vencimiento confirmado más cercano dentro del horizonte", () => {
    const limite = limiteHorizonteCobros("2026-09-10", 7);
    expect(
      proximoCobroDesdeDocumentos(
        [
          { ...BASE, due_date: "2026-09-20" },
          { ...BASE, id: "2", due_date: "2026-09-12" },
          { ...BASE, id: "3", due_date: "2026-09-05", days_overdue: 5 },
        ],
        "2026-09-10",
        limite,
      ),
    ).toBe("2026-09-12");
  });

  it("suma montos por moneda dentro del horizonte", () => {
    const limite = limiteHorizonteCobros("2026-09-10", 14);
    const totals = dueSoonTotalsFromDocuments(
      [
        { ...BASE, outstanding_amount: "100000", due_date: "2026-09-20" },
        { ...BASE, id: "2", outstanding_amount: "50000", due_date: "2026-09-24" },
        { ...BASE, id: "3", outstanding_amount: "999", due_date: "2026-10-01" },
      ],
      "2026-09-10",
      limite,
    );
    expect(totals).toEqual([{ currency: "CLP", amount: "150000" }]);
  });
});

describe("recuadro Por cobrar · próximos 7 días", () => {
  it("sin una sola fecha no son $0 en 7 días: es la cartera esperando fecha", () => {
    const r = recuadroPorCobrar({ due_soon: [] }, arSinFechas());

    expect(r.value).toBe("$9.000.000 por agendar");
    expect(r.value).not.toContain("$0");
    expect(sinPalabrasProhibidas([r.value, r.detail, r.note])).toEqual([]);
  });

  it("con la cartera fechada muestra la ventana real, incluido un cero medido", () => {
    const r = recuadroPorCobrar({ due_soon: [] }, arSinFechas({ undated_amount: "0" }));

    expect(r.value).toBe("$0");
    expect(r.detail).toBe("Próximos 7 días");
  });

  it("con fechas parciales suma la ventana y declara lo que queda afuera", () => {
    const r = recuadroPorCobrar(
      { due_soon: [{ currency: "CLP", amount: "2000000" }] },
      arSinFechas({ undated_amount: "1000000" }),
    );

    expect(r.value).toBe("$2.000.000");
    expect(r.note).toContain("$1.000.000");
  });

  it("con horizonte 30 usa el total calculado en documentos", () => {
    const r = recuadroPorCobrar(
      { due_soon: [{ currency: "CLP", amount: "100" }] },
      arSinFechas({ undated_amount: "0" }),
      30,
      [{ currency: "CLP", amount: "5000000" }],
    );

    expect(r.value).toBe("$5.000.000");
    expect(r.detail).toBe("Próximos 30 días");
  });
});

describe("idempotencia manual", () => {
  it("conserva la misma clave al reintentar la misma selección", () => {
    const keys = new Map<string, string>();
    const first = reminderIdempotencyKey(keys, ["b", "a"], () => "stable-key");
    const retry = reminderIdempotencyKey(keys, ["a", "b"], () => "other-key");

    expect(retry).toEqual(first);
  });

  it("mantiene el intento abierto cuando el proveedor devuelve un error ambiguo", () => {
    expect(
      hasAmbiguousReminderFailure([{ receivable_id: "a", status: "error", detail: "timeout" }]),
    ).toBe(true);
    expect(
      hasAmbiguousReminderFailure([
        { receivable_id: "a", status: "sent", detail: "ok" },
        { receivable_id: "b", status: "sin_destinatario", detail: "sin correo" },
      ]),
    ).toBe(false);
  });
});

/* ── #207 en el grano de los DOCUMENTOS: el pie que unía dos números distintos con un "de" ───
 *
 * El pie decía `{items.length} de {query.data.total} documentos`. A la izquierda, una página
 * filtrada en memoria; a la derecha, el total del servidor. Con 1.480 documentos en cartera el
 * dueño leía "12 de 1.480" y entendía "quedan 1.468 por mirar", cuando lo que en realidad decía
 * era "12 de las 100 que alcancé a traer pasan tu filtro, y de las otras 1.380 no sé nada". */
describe("(b) el pie nunca publica un `.length` como conteo de cartera", () => {
  it("separa la cartera del servidor de las filas traídas, y lo dice con esas palabras", () => {
    const texto = textoDelPieDocumentos(50, 1480, 50, false, "");
    expect(texto).toContain("1480 documentos en la cartera");
    expect(texto).toContain("50 traídas hasta acá");
    // El "N de M" que fabricaba la cifra falsa ya no existe en ninguna forma.
    expect(texto).not.toContain("50 de 1480");
  });

  /* EL GEMELO: con un filtro en memoria puesto aparece el TERCER número, nombrado como lo que
     es —cuántas de las traídas pasan el filtro—, en vez de pasar por el total del servidor. */
  it("con filtro de estado nombra las tres cifras por separado", () => {
    const texto = textoDelPieDocumentos(50, 1480, 12, true, "");
    expect(texto).toContain("1480 documentos en la cartera");
    expect(texto).toContain("50 traídas hasta acá");
    expect(texto).toContain("12 pasan el filtro de estado");
  });

  it("con búsqueda dice que se buscó en TODA la cartera, que es lo que antes no era cierto", () => {
    const texto = textoDelPieDocumentos(1, 1, 1, false, "volcan");
    expect(texto).toContain("«volcan»");
    expect(texto).toContain("en toda la cartera");
  });

  it("no escribe «1 traídas» ni «1 pasan»", () => {
    const texto = textoDelPieDocumentos(1, 1, 1, true, "");
    expect(texto).toContain("1 traída hasta acá");
    expect(texto).toContain("1 pasa el filtro");
    expect(texto).not.toContain("1 traídas");
    expect(texto).not.toContain("1 pasan");
  });
});

describe("la tabla sin filas nombra la cartera que SÍ existe", () => {
  it("dice la cifra y la salida concreta, nunca «no hay»", () => {
    const texto = textoSinCoincidencias(1480, 50, true);
    expect(texto).toContain("1480 documentos en la cartera");
    expect(texto).toContain("50 traídas hasta acá");
    expect(texto).toContain("Trae más documentos");
    expect(texto).not.toContain("No hay");
    expect(texto).not.toContain("sin dato");
  });

  /* EL GEMELO: con todo traído ya no tiene sentido ofrecer "traer más", porque apretar ese
     botón no cambiaría nada. La salida que queda es soltar el filtro, y eso es lo que dice. */
  it("sin páginas pendientes ofrece la única salida que queda: soltar el filtro", () => {
    const texto = textoSinCoincidencias(7, 7, false);
    expect(texto).toContain("Suelta el filtro");
    expect(texto).not.toContain("Trae más documentos");
  });
});

describe("(e) un total nunca suma pesos con dólares", () => {
  it("dos monedas dan DOS cifras, nunca una sola", () => {
    const label = formatCollectionMoney([
      { currency: "CLP", amount: "9800000" },
      { currency: "USD", amount: "12500.40" },
    ]);
    // Dos cifras separadas, cada una con su símbolo.
    expect(label.split(" · ")).toHaveLength(2);
    expect(label).toContain("$9.800.000");
    expect(label).toContain("12.500,40");
    expect(label).toContain("US$");
    // Y ni rastro de la suma aritmética de los dos números, que no significa nada.
    expect(label).not.toContain("9812500");
    expect(label).not.toContain("$9.812.500");
  });

  /* EL GEMELO: una sola moneda da UNA cifra. Sin esto, una implementación que siempre
     devolviera dos líneas pasaría el test de arriba sin separar nada. */
  it("una sola moneda da una sola cifra, sin separador de más", () => {
    const label = formatCollectionMoney([{ currency: "CLP", amount: "9800000" }]);
    expect(label.split(" · ")).toHaveLength(1);
    expect(label).toBe("$9.800.000");
  });

  it("una moneda en cuarentena no se vuelve cero ni arrastra a la otra", () => {
    const label = formatCollectionMoney([
      { currency: "CLP", amount: "9800000" },
      { currency: "USD", amount: null },
    ]);
    expect(label).toContain("$9.800.000");
    expect(label).toContain("(USD)");
    expect(label).not.toContain("$0");
  });
});
