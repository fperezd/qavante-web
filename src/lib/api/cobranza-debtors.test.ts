import { describe, expect, it, vi } from "vitest";
import { api } from "./client";
import {
  type ReceivableDebtorsResponse,
  DEBTORS_PAGE_SIZE,
  esCorteVencido,
  receivableDebtorsPath,
} from "./cobranza";
import { ApiError } from "./errors";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

/* El fixture de `src/test/msw/receivable-debtors.ts` resuelve `search`, `state`, `sort`, `limit`
   y `cursor` DE VERDAD. Eso es lo que hace que estos tests midan algo: contra un handler que
   devolviera siempre la misma lista, una pantalla que no manda ningún parámetro pasaría igual.

   Los siete deudores, por saldo CLP descendente:
     1 Constructora Andes   $9.800.000
     2 Comercial del Sur    $6.100.000
     3 Minera Atacama       $4.300.000  (+ US$ 12.500,40)
     4 Transportes Biobío   $2.750.000  (todo sin fecha de vencimiento)
     5 Servicios Austral    $1.400.000
     6 Pesquera Chiloé      importe en cuarentena de conciliación
     7 VOLCAN                   $13.300  ← el del issue, fuera del top 5 */

const get = (path: string) => api.get<ReceivableDebtorsResponse>(path);

describe("GET /accounts-receivable/debtors · el directorio que reemplaza al top 5", () => {
  it("serializa los filtros con los nombres del contrato y el cursor al final", () => {
    expect(
      receivableDebtorsPath(
        { search: "  volcan  ", state: "all", sort: "total_desc", limit: 2 },
        "4",
      ),
    ).toBe(
      "/api/treasury/accounts-receivable/debtors?limit=2&search=volcan&state=all&sort=total_desc&cursor=4",
    );
  });

  it("no manda `search` cuando la consulta es sólo espacios: un blanco no es un filtro", () => {
    expect(receivableDebtorsPath({ search: "   " })).toBe(
      `/api/treasury/accounts-receivable/debtors?limit=${DEBTORS_PAGE_SIZE}`,
    );
  });

  /* ── LA REGRESIÓN DEL ISSUE, EN UNA ASERCIÓN ────────────────────────────────────────────────
     VOLCAN es el séptimo por saldo. Con una primera página de dos filas no está cargado, así
     que la búsqueda LOCAL sobre lo cargado no podía encontrarlo por construcción. La del
     servidor sí. */
  it("encuentra a VOLCAN aunque no esté en la página cargada", async () => {
    const primeraPagina = await get(receivableDebtorsPath({ limit: 2 }));
    expect(primeraPagina.items.map((d) => d.name)).toEqual([
      "Constructora Andes SpA",
      "Comercial del Sur Ltda",
    ]);
    // Premisa del test, no adorno: si VOLCAN estuviera cargado, buscarlo no probaría nada.
    expect(primeraPagina.items.some((d) => d.name.includes("VOLCAN"))).toBe(false);

    const busqueda = await get(receivableDebtorsPath({ search: "volcan", limit: 2 }));
    expect(busqueda.items.map((d) => d.name)).toEqual(["VOLCAN Comercializadora SpA"]);
    expect(busqueda.items[0]!.totals[0]!.total).toBe("13300");
    expect(busqueda.items_total).toBe(1);
  });

  it("busca también por RUT, no sólo por nombre", async () => {
    const porRut = await get(receivableDebtorsPath({ search: "80.111.222-3" }));
    expect(porRut.items.map((d) => d.name)).toEqual(["VOLCAN Comercializadora SpA"]);
  });

  /* ── EL CONTEO ─────────────────────────────────────────────────────────────────────────────
     `items_total` es "deudores que cumplen los filtros, SIN paginar". Con una página de dos
     filas, `items.length` dice 2 y `items_total` dice 7. Ésa es exactamente la distancia entre
     lo que la pantalla decía y lo que hay: un `.length` sobre el top 5 escribía "5 clientes con
     saldo" teniendo 7 en el fixture (y 200 en producción). */
  it("publica el total sin paginar, que NO es la cantidad de filas de la página", async () => {
    const page = await get(receivableDebtorsPath({ limit: 2 }));
    expect(page.items).toHaveLength(2);
    expect(page.items_total).toBe(7);
    expect(page.items_total).not.toBe(page.items.length);
    expect(page.summary.debtor_count).toBe(7);
  });

  /* ── EL RESTO, NOMBRADO Y CON MONTO ────────────────────────────────────────────────────────
     El puente lo calcula el servidor sobre el universo completo. Las seis monedas conocidas del
     fixture suman $24.363.300; el top 5 son $24.350.000; el resto son los $13.300 de VOLCAN. */
  it("el puente del ranking cuadra: top 5 + resto = directorio", async () => {
    const page = await get(receivableDebtorsPath({ limit: 2 }));
    const clp = page.ranking_bridge.find((b) => b.currency === "CLP");
    expect(clp).toBeDefined();
    expect(clp!.top_limit).toBe(5);
    expect(clp!.top_five_total).toBe("24350000");
    expect(clp!.remainder_total).toBe("13300");
    expect(clp!.directory_total).toBe("24363300");
    expect(Number(clp!.top_five_total) + Number(clp!.remainder_total)).toBe(
      Number(clp!.directory_total),
    );
    // El resto NO es una cola invisible: son 6 deudores con monto conocido menos los 5 del top.
    expect(clp!.debtor_count - clp!.top_limit).toBe(1);
  });

  it("encadena el cursor hasta agotar los siete, sin repetir ni perder filas", async () => {
    const vistos: string[] = [];
    let cursor: string | null | undefined = undefined;
    let vueltas = 0;
    do {
      const page: ReceivableDebtorsResponse = await get(
        receivableDebtorsPath({ limit: 3 }, cursor),
      );
      vistos.push(...page.items.map((d) => d.name));
      cursor = page.has_more ? page.next_cursor : null;
      vueltas += 1;
      expect(vueltas).toBeLessThanOrEqual(5);
    } while (cursor);

    expect(vistos).toHaveLength(7);
    expect(new Set(vistos).size).toBe(7);
    /* El orden completo, no sólo el largo: así queda escrito que VOLCAN es el SEXTO —fuera del
       top 5, que es lo que el defecto volvía inalcanzable— y que el importe desconocido de
       Pesquera Chiloé ordena al final por desconocido, no por cero. */
    expect(vistos).toEqual([
      "Constructora Andes SpA",
      "Comercial del Sur Ltda",
      "Minera Atacama SA",
      "Transportes Biobío Ltda",
      "Servicios Austral EIRL",
      "VOLCAN Comercializadora SpA",
      "Pesquera Chiloé SA",
    ]);
    expect(vistos.indexOf("VOLCAN Comercializadora SpA")).toBeGreaterThan(4);
  });

  it("`has_more` y `next_cursor` no se contradicen en la última página", async () => {
    const ultima = await get(receivableDebtorsPath({ limit: 50 }));
    expect(ultima.items).toHaveLength(7);
    expect(ultima.has_more).toBe(false);
    expect(ultima.next_cursor).toBeNull();
  });

  /* Créditos y cedidas por separado: sumarlos al cobrable infla lo que se puede cobrar. */
  it("separa cobrable, notas de crédito y cedidas en universos distintos", async () => {
    const cobrable = await get(receivableDebtorsPath({ state: "collectable" }));
    const credito = await get(receivableDebtorsPath({ state: "credit" }));
    const cedida = await get(receivableDebtorsPath({ state: "ceded" }));
    const todo = await get(receivableDebtorsPath({ state: "all" }));

    expect(cobrable.items_total).toBe(7);
    expect(credito.items_total).toBe(1);
    expect(credito.items[0]!.totals[0]!.total).toBe("-480000");
    expect(cedida.items_total).toBe(1);
    expect(todo.items_total).toBe(9);
  });

  it("no mezcla CLP con USD: cada moneda es su propia fila de totales", async () => {
    const page = await get(receivableDebtorsPath({ search: "Atacama" }));
    const atacama = page.items[0]!;
    expect(atacama.totals.map((t) => t.currency)).toEqual(["CLP", "USD"]);
    expect(atacama.totals.find((t) => t.currency === "CLP")!.total).toBe("4300000");
    expect(atacama.totals.find((t) => t.currency === "USD")!.total).toBe("12500.40");
    // Y el puente publica una línea por moneda conocida; nunca una suma entre monedas.
    expect(page.ranking_bridge.every((b) => b.currency !== null)).toBe(true);
  });

  it("un importe en cuarentena llega `null` con su motivo, nunca como cero", async () => {
    const page = await get(receivableDebtorsPath({ search: "Chiloé" }));
    const total = page.items[0]!.totals[0]!;
    expect(total.total).toBeNull();
    expect(total.overdue).toBeNull();
    expect(total.amount_unknown_reason).toBe("reconciliation_quarantine");
  });

  it("la cobertura es completa por contrato: el directorio nunca sale a medias", async () => {
    const page = await get(receivableDebtorsPath({}));
    expect(page.coverage).toBe("complete");
    expect(page.as_of).toBe("2026-10-05T18:30:00-03:00");
  });

  it("un cursor que no es de este corte da 422, no una lista vacía", async () => {
    await expect(get(receivableDebtorsPath({}, "cursor-ajeno"))).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiError && error.status === 422,
    );
  });

  describe("esCorteVencido", () => {
    it("reconoce 409 y 422 como «este corte ya no sirve, pide otro»", () => {
      expect(esCorteVencido(new ApiError("x", 409))).toBe(true);
      expect(esCorteVencido(new ApiError("x", 422))).toBe(true);
    });

    it("no se come los demás errores: un 500 o una caída de red no son un corte vencido", () => {
      expect(esCorteVencido(new ApiError("x", 500))).toBe(false);
      expect(esCorteVencido(new ApiError("x", 0, "network_error"))).toBe(false);
      expect(esCorteVencido(new Error("boom"))).toBe(false);
      expect(esCorteVencido(null)).toBe(false);
    });
  });
});
