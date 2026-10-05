import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ReceivableDebtor,
  ReceivableDebtorCurrencyTotal,
  ReceivableDebtorsResponse,
  ReceivableRankingBridge,
} from "@/lib/api/cobranza";
import {
  DirectorioDeudores,
  documentosDe,
  lineasDelPuente,
  montoDeMoneda,
  contar,
  textoDelConteo,
  textoDelPie,
  vencidoDeMoneda,
} from "./directorio-deudores";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  debtors: vi.fn(),
  companyScope: vi.fn(),
}));

vi.mock("@/lib/api/cobranza", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/cobranza")>()),
  useReceivableDebtors: mocks.debtors,
}));
vi.mock("@/components/shell/company-scope", () => ({
  useCompanyScope: mocks.companyScope,
}));

const clp = (
  total: string | null,
  overdue: string | null,
  documentCount = 1,
  extra: Partial<ReceivableDebtorCurrencyTotal> = {},
): ReceivableDebtorCurrencyTotal => ({
  currency: "CLP",
  currency_status: "known",
  document_count: documentCount,
  overdue,
  total,
  undated_amount: null,
  undated_document_count: 0,
  ...extra,
});

const deudor = (name: string, total: string | null): ReceivableDebtor => ({
  counterparty_key: `key-${name}`,
  identity_resolution: "graph",
  name,
  tax_id: "76.123.456-7",
  receivable_ids: ["r1"],
  totals: [clp(total, total)],
});

const bridge = (over: Partial<ReceivableRankingBridge> = {}): ReceivableRankingBridge => ({
  currency: "CLP",
  currency_status: "known",
  debtor_count: 7,
  directory_total: "24363300",
  remainder_total: "13300",
  top_five_total: "24350000",
  top_limit: 5,
  ...over,
});

/** Sólo los campos que la pantalla lee; el resto del envelope no cambia nada de lo que se
 *  afirma acá y enumerarlo entero escondería qué se está probando. */
const page = (over: Partial<ReceivableDebtorsResponse> = {}) =>
  ({
    as_of: "2026-10-05T18:30:00-03:00",
    coverage: "complete",
    has_more: false,
    items: [
      deudor("Constructora Andes SpA", "9800000"),
      deudor("Comercial del Sur Ltda", "6100000"),
    ],
    items_total: 7,
    next_cursor: null,
    ranking_bridge: [bridge()],
    ...over,
  }) as ReceivableDebtorsResponse;

const consulta = (over: Record<string, unknown> = {}) => ({
  data: { pages: [page()] },
  isPending: false,
  isError: false,
  error: null,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  isFetchingNextPage: false,
  refetch: vi.fn(),
  ...over,
});

const render = () => renderToStaticMarkup(<DirectorioDeudores />);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.companyScope.mockReturnValue({ activeCompanyId: "empresa-1" });
  mocks.debtors.mockReturnValue(consulta());
});

/* ── LA CIFRA, ANTES Y DESPUÉS ──────────────────────────────────────────────────────────────
 *
 * Antes: el conteo salía de `clientes.length` sobre `top_debtors`, que es un top 5. Con 7
 * deudores en la cartera la pantalla escribía 5; con 200, también 5.
 * Después: sale de `items_total` del servidor, "deudores que cumplen los filtros, sin paginar".
 *
 * El test monta la pantalla con DOS filas cargadas y `items_total: 7`. Si el conteo volviera a
 * salir de las filas, diría 2. */
describe("DirectorioDeudores · el conteo", () => {
  it("cuenta con `items_total`, no con las filas cargadas", () => {
    const html = render();
    expect(html).toContain("7 clientes con saldo en «Cobrable»");
    expect(html).not.toContain("2 clientes con saldo");
    expect(html).not.toContain("5 clientes con saldo");
  });

  it("el pie distingue las filas traídas del total, y lo dice con esas palabras", () => {
    expect(render()).toContain("2 filas traídas de 7 clientes con saldo.");
  });

  it("nombra el resto con su monto en vez de dejarlo fuera de cuadro", () => {
    const html = render();
    expect(html).toContain("los 5 mayores concentran $24.350.000");
    expect(html).toContain("Los otros 2 suman $13.300");
  });

  it("publica el corte CON hora: una fecha sola esconde el movimiento del día", () => {
    expect(render()).toMatch(/Corte al .*\d{1,2}:\d{2}/);
  });
});

describe("textoDelConteo", () => {
  it("sin búsqueda dice en qué estado está contando", () => {
    expect(textoDelConteo(7, "", "Cobrable")).toBe("7 clientes con saldo en «Cobrable».");
  });

  it("con búsqueda dice que buscó en TODA la cartera, que es lo que antes no era cierto", () => {
    expect(textoDelConteo(1, "volcan", "Cobrable")).toBe(
      "1 cliente coincide con «volcan» en toda la cartera, no sólo entre los mayores.",
    );
  });

  it("un cero con búsqueda es «ninguno coincide», nunca una cartera vacía", () => {
    expect(textoDelConteo(0, "volcan", "Cobrable")).toContain("0 clientes coinciden");
  });
});

describe("textoDelPie", () => {
  it("rotula el `.length` como filas traídas, separado del total del servidor", () => {
    expect(textoDelPie(2, 7)).toBe("2 filas traídas de 7 clientes con saldo.");
    expect(textoDelPie(1, 1)).toBe("1 fila traída de 1 cliente con saldo.");
  });

  it("sin total del servidor no inventa uno: dice sólo lo que trajo", () => {
    expect(textoDelPie(3, null)).toBe("3 filas traídas.");
  });
});

describe("lineasDelPuente", () => {
  it("arma «esto es el top 5 de N, el resto son $X» con los campos del contrato", () => {
    expect(lineasDelPuente([bridge()])).toEqual([
      {
        clave: "CLP",
        texto:
          "En CLP, los 5 mayores concentran $24.350.000 de los $24.363.300 que deben 7 deudores. Los otros 2 suman $13.300.",
      },
    ]);
  });

  it("un resto de CERO se dice igual: «el resto son $0» sobre cinco deudores es información", () => {
    const [linea] = lineasDelPuente([
      bridge({ debtor_count: 6, remainder_total: "0", top_five_total: "24363300" }),
    ]);
    expect(linea!.texto).toContain("Los otros 1 suman $0.");
  });

  it("cuando el directorio cabe en el top no finge una cola que no existe", () => {
    const [linea] = lineasDelPuente([
      bridge({ debtor_count: 5, remainder_total: "0", top_five_total: "24363300" }),
    ]);
    expect(linea!.texto).toContain("Caben completos en los 5 mayores");
    expect(linea!.texto).not.toContain("Los otros");
  });

  it("una moneda sin montos conocidos NO produce una línea con ceros fabricados", () => {
    expect(
      lineasDelPuente([
        bridge({
          amount_unknown_reason: "reconciliation_quarantine",
          directory_total: null,
          remainder_total: null,
          top_five_total: null,
        }),
      ]),
    ).toEqual([]);
    expect(lineasDelPuente([bridge({ currency: null, currency_status: "unknown" })])).toEqual([]);
  });

  it("una línea POR MONEDA, sin sumar entre monedas", () => {
    const lineas = lineasDelPuente([
      bridge(),
      bridge({
        currency: "USD",
        debtor_count: 2,
        directory_total: "12500.40",
        remainder_total: "0.40",
        top_five_total: "12500.00",
      }),
    ]);
    expect(lineas.map((l) => l.clave)).toEqual(["CLP", "USD"]);
    expect(lineas[1]!.texto).toContain("US$ 12.500,40");
  });
});

describe("montoDeMoneda y vencidoDeMoneda · la ausencia se nombra, nunca se vuelve cero", () => {
  it("un importe en cuarentena dice «En revisión» y cuántos documentos cubre", () => {
    const total = clp(null, null, 3, { amount_unknown_reason: "reconciliation_quarantine" });
    expect(montoDeMoneda(total)).toBe("En revisión en 3 documentos");
    expect(montoDeMoneda(total)).not.toContain("$0");
    expect(vencidoDeMoneda(total)).toBe("En revisión");
  });

  it("una moneda que el origen no permite determinar lo dice, sin cifra", () => {
    const total = clp(null, null, 2, { currency: null, currency_status: "unknown" });
    expect(montoDeMoneda(total)).toBe("2 documentos cuya moneda no viene en el origen");
    expect(montoDeMoneda(total)).not.toContain("$");
  });

  it("un cero VERIFICADO sí se escribe como cero", () => {
    expect(montoDeMoneda(clp("0", "0"))).toBe("$0");
    expect(vencidoDeMoneda(clp("0", "0"))).toBe("$0");
  });

  it("todo sin fecha de vencimiento no es «nada vencido»", () => {
    expect(
      vencidoDeMoneda(
        clp("2750000", null, 2, { undated_amount: "2750000", undated_document_count: 2 }),
      ),
    ).toBe("Todo sin fecha de vencimiento");
  });

  it("nada vencido con fechas presentes sí es nada vencido", () => {
    expect(vencidoDeMoneda(clp("2750000", "0", 2))).toBe("$0");
  });
});

describe("DirectorioDeudores · los estados en que no hay tabla", () => {
  it("un 409 dice que el corte cambió y ofrece traer el nuevo, no una tabla vacía", () => {
    mocks.debtors.mockReturnValue(
      consulta({ isError: true, error: new ApiError("x", 409), data: undefined }),
    );
    const html = render();
    expect(html).toContain("El corte cambió mientras lo leías");
    expect(html).toContain("Traer el corte nuevo");
    // Lo que NO debe pasar: convertir la ausencia en «no te deben nada».
    expect(html).not.toContain("Ningún cliente tiene saldo");
    expect(html).not.toContain("clientes con saldo en");
  });

  it("un 422 por cursor incompatible se resuelve igual que el 409", () => {
    mocks.debtors.mockReturnValue(
      consulta({ isError: true, error: new ApiError("x", 422), data: undefined }),
    );
    expect(render()).toContain("Traer el corte nuevo");
  });

  it("sin Empresa activa no muestra un cero: dice que falta elegirla", () => {
    mocks.companyScope.mockReturnValue({ activeCompanyId: null });
    const html = render();
    expect(html).toContain("Elige una Empresa");
    expect(html).not.toContain("0 clientes");
  });

  it("un directorio vacío con cobertura completa sí puede decir que nadie debe", () => {
    mocks.debtors.mockReturnValue(
      consulta({ data: { pages: [page({ items: [], items_total: 0, ranking_bridge: [] })] } }),
    );
    const html = render();
    expect(html).toContain("Ningún cliente tiene saldo en este corte.");
    expect(html).toContain("0 clientes con saldo en «Cobrable»");
  });

  it("ofrece traer más clientes sólo cuando el servidor dice que quedan", () => {
    expect(render()).not.toContain("clientes más");
    mocks.debtors.mockReturnValue(
      consulta({
        hasNextPage: true,
        data: { pages: [page({ has_more: true, next_cursor: "2" })] },
      }),
    );
    expect(render()).toContain("Traer 50 clientes más");
  });

  /* `has_more: true` con `next_cursor: null` viola el contrato. Ahí NO se pinta el botón: un
     control que ofrece traer más y no trae nada es peor que no estar. */
  it("no ofrece el botón si el cursor no permite otra página, aunque `has_more` diga que sí", () => {
    mocks.debtors.mockReturnValue(
      consulta({
        hasNextPage: false,
        data: { pages: [page({ has_more: true, next_cursor: null })] },
      }),
    );
    expect(render()).not.toContain("clientes más");
  });
});

describe("documentosDe", () => {
  it("suma el `document_count` del servidor entre monedas, no el largo de `receivable_ids`", () => {
    const multimoneda: ReceivableDebtor = {
      ...deudor("Minera Atacama SA", "4300000"),
      /* El contrato publica los documentos POR MONEDA. Si algún día `receivable_ids` quedara
         acotado, su `.length` pasaría a ser la misma mentira que este PR viene a sacar. */
      receivable_ids: ["r1"],
      totals: [clp("4300000", "1100000", 2), { ...clp(null, null, 1), currency: "USD" }],
    };
    expect(documentosDe(multimoneda)).toBe(3);
    expect(documentosDe(multimoneda)).not.toBe(multimoneda.receivable_ids.length);
  });

  it("un deudor de una sola moneda da su propio conteo", () => {
    expect(documentosDe(deudor("X", "100"))).toBe(1);
  });
});

describe("contar", () => {
  it("no escribe «1 clientes» ni «(s)»", () => {
    expect(contar(1, "cliente", "clientes")).toBe("1 cliente");
    expect(contar(0, "cliente", "clientes")).toBe("0 clientes");
    expect(contar(1200, "cliente", "clientes")).toBe("1.200 clientes");
  });
});
