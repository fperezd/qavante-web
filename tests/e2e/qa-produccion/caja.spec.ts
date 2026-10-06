import type { Locator, Page } from "@playwright/test";
import { test, expect, esperarApi, jsonDeRespuesta } from "./support/fixtures";
import { SESSION, SIN_SESION } from "./support/env";
import { cuentas as leerCuentas, revision, sinClasificar } from "./support/datos";
import { clp, entero, num, numOrNull } from "./support/finanzas";
import { entra14, monedaPorCuenta, porDireccion, saldoBanco } from "./support/invariantes";
import type {
  AccountsPayable,
  BankMovementsList,
  CanonicalCategories,
  CollectionForecast,
  DashboardSummary,
} from "./support/tipos";

/* Caja v02 (src/components/caja/v02) y Caja · Clasificados (src/components/clasificacion).
   En Clasificados sólo se ABRE el panel de reclasificar para leer sus opciones; nunca se guarda. */

/** La tarjeta KPI de la tríada "Hoy, entra y sale" cuyo texto calza con `etiqueta`. */
function kpi(page: Page, etiqueta: RegExp): Locator {
  return page
    .getByRole("region", { name: "Hoy, entra y sale" })
    .locator(":scope > *")
    .filter({ hasText: etiqueta })
    .first();
}

test.describe("QA producción · Caja", () => {
  test.skip(!SESSION, SIN_SESION);

  test('B02 — Caja hoy muestra el saldo contable del banco con su fecha, no "sin dato · conecta tu banco"', async ({
    page,
    api,
    evidencia,
  }) => {
    const saldo = saldoBanco(await leerCuentas(api), "CLP");
    test.skip(saldo.total === null, "bank-accounts no trae saldo CLP: no hay contra qué comparar.");
    evidencia.nota(
      `bank-accounts: ${saldo.conSaldo} de ${saldo.cuentas} cuentas CLP con saldo, total ${clp(saldo.total)} al ${saldo.ultimaFecha ?? "sin fecha"}`,
    );

    const pSum = esperarApi(page, /^\/api\/dashboard\/summary/);
    await page.goto("/caja");
    const sum = await jsonDeRespuesta<DashboardSummary>(await pSum);
    const hoy = kpi(page, /^\s*Hoy/);
    await expect(hoy).toBeVisible();

    const cashToday = numOrNull(sum?.cash_today?.total);
    expect
      .soft(
        cashToday,
        `dashboard/summary.cash_today es nulo aunque bank-accounts trae ${clp(saldo.total)}`,
      )
      .not.toBeNull();
    if (cashToday !== null && saldo.total !== null) {
      expect
        .soft(
          Math.abs(cashToday - saldo.total),
          `Caja hoy ${clp(cashToday)} vs saldo contable del banco ${clp(saldo.total)}`,
        )
        .toBeLessThanOrEqual(1);
    }
    await expect
      .soft(hoy, `Caja dice "conecta tu banco" con ${clp(saldo.total)} en el banco`)
      .not.toContainText(/conecta tu banco/i);
    await expect
      .soft(hoy, "Caja muestra Hoy sin dato con el banco conectado")
      .not.toContainText(/sin dato/i);

    await page.goto("/banco");
    const cajaHoyBanco = page.getByRole("region", { name: "Caja hoy" });
    await expect(cajaHoyBanco).toBeVisible();
    await expect(
      cajaHoyBanco,
      `Banco muestra "Caja hoy: sin dato" junto a un saldo de ${clp(saldo.total)}`,
    ).not.toContainText(/sin dato|conecta tu banco/i);
  });

  test('B09 — "Entra 14 días" refleja la cobranza esperada, no $0 con documentos por cobrar', async ({
    page,
    evidencia,
  }) => {
    const pFc = esperarApi(page, /^\/api\/treasury\/collection-forecast/);
    const pSum = esperarApi(page, /^\/api\/dashboard\/summary/);
    await page.goto("/caja");
    const fc = await jsonDeRespuesta<CollectionForecast>(await pFc);
    const sum = await jsonDeRespuesta<DashboardSummary>(await pSum);
    expect(fc, "Caja no pidió /api/treasury/collection-forecast").not.toBeNull();
    const porCobrar = numOrNull(sum?.overdue_collections?.total_receivable);
    const e = entra14(fc!);
    evidencia.nota(
      `forecast: Entra14 como Caja ${clp(e.comoCaja)}, con buckets que cruzan el día 14 ${clp(e.conCruzados)}; total_nominal ${clp(e.totalNominal)}; summary.total_receivable ${clp(porCobrar)}`,
    );

    expect
      .soft(
        e.bucketsCruzados,
        `Caja descarta los buckets que cruzan el día 14 (${e.bucketsCruzados.join("; ")}): Entra 14 días ${clp(e.comoCaja)} en vez de ${clp(e.conCruzados)}`,
      )
      .toEqual([]);

    const entra = kpi(page, /Entra/);
    await expect(entra).toBeVisible();
    if ((porCobrar ?? 0) > 0) {
      await expect(
        entra,
        `"Entra 14 días" muestra $0 con ${clp(porCobrar)} por cobrar`,
      ).not.toContainText(/\+\s?\$\s?0(?![\d.])|\$\s?0 por cobrar/);
    }
  });

  test("B10 — los pagos críticos a 14 días no superan el total a 14 días", async ({ page }) => {
    const pAp = esperarApi(page, /^\/api\/treasury\/accounts-payable(\?|$)/);
    await page.goto("/caja");
    const ap = await jsonDeRespuesta<AccountsPayable>(await pAp);
    expect(ap, "Caja no pidió /api/treasury/accounts-payable").not.toBeNull();
    const total = numOrNull(ap!.due_14d);
    const agg = ap!.non_postponable_or_overdue_14d;
    const criticos = numOrNull(agg?.amount_clp) ?? numOrNull(agg?.known_amount_clp);
    test.skip(
      total === null || criticos === null,
      "accounts-payable no publica due_14d o críticos.",
    );
    expect(
      criticos!,
      `"Sale 14 días" ${clp(-total!)} pero "al menos ${clp(criticos)} críticos": el desglose supera al total (${entero(agg.count)} pagos críticos)`,
    ).toBeLessThanOrEqual(total! + 1);

    const sale = kpi(page, /Sale/);
    await expect(sale).toBeVisible();
    const texto = await sale.innerText();
    const montos = [...texto.matchAll(/\$\s?([\d.]+)/g)].map((m) => num(m[1]));
    if (montos.length >= 2) {
      const [visibleTotal, ...resto] = montos;
      for (const m of resto) {
        expect
          .soft(m, `En pantalla: críticos ${clp(m)} > total ${clp(visibleTotal)}`)
          .toBeLessThanOrEqual(visibleTotal! + 1);
      }
    }
  });

  test("B11 — el aviso de pendientes de Caja cuenta lo mismo que Bandeja, con período y monto por dirección", async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    await page.goto("/caja");
    const aviso = page
      .getByRole("note")
      .filter({ hasText: /pendiente/i })
      .first();
    await expect(aviso).toBeVisible();
    const texto = (await aviso.innerText()).replace(/\s+/g, " ");
    const nCaja = num(/(\d[\d.]*)\s+movimientos? pendientes?/i.exec(texto)?.[1]);

    const capturas = await evidencia.todas(
      /^\/api\/bank-movements\?.*status=unclassified.*period=/,
      "GET",
    );
    const itemsCaja = capturas.flatMap((c) => {
      try {
        return (JSON.parse(c.body) as BankMovementsList).items ?? [];
      } catch {
        return [];
      }
    });
    const bandeja = await sinClasificar(api, empresa);
    const monedas = monedaPorCuenta(await leerCuentas(api));
    const d = porDireccion(itemsCaja, "CLP", monedas);
    evidencia.nota(
      `Caja: "${texto}" · Bandeja (Clasificar): ${bandeja.total} · Caja CLP entradas ${clp(d.entradas)} (${d.nEntradas}), salidas ${clp(d.salidas)} (${d.nSalidas})`,
    );

    expect
      .soft(nCaja, `Caja dice ${entero(nCaja)} pendientes y Bandeja ${entero(bandeja.total)}`)
      .toBe(bandeja.total);
    if (d.nSalidas > 0) {
      expect
        .soft(
          texto,
          `El aviso cuenta ${d.nSalidas} salidas (${clp(d.salidas)}) pero sólo informa el monto de entradas`,
        )
        .toMatch(/salida|cargo/i);
    }
    expect(texto, "El aviso no dice de qué período son los pendientes").toMatch(
      /enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|desde|período|\d{2}-\d{2}/i,
    );
  });

  test('B20 — los KPI de Clasificados no se calculan sobre una descarga parcial ni dicen "Todo en orden" con pendientes', async ({
    page,
    api,
    empresa,
    evidencia,
  }) => {
    const pLista = esperarApi(page, /^\/api\/bank-movements\?.*status=classified/);
    await page.goto("/caja/clasificados");
    const lista = await jsonDeRespuesta<BankMovementsList>(await pLista);
    expect(lista, "Clasificados no pidió /api/bank-movements?status=classified").not.toBeNull();
    const total = lista!.total ?? lista!.items.length;
    expect
      .soft(
        lista!.items.length,
        `Ingresos/Egresos/Neto se calculan sobre ${entero(lista!.items.length)} de ${entero(total)} movimientos`,
      )
      .toBe(total);

    const [pend, rev] = await Promise.all([sinClasificar(api, empresa), revision(api, empresa)]);
    const pendientes = pend.total + rev.count;
    evidencia.nota(
      `Pendientes: ${pend.total} por clasificar + ${rev.count} en revisión de conciliación`,
    );
    if (pendientes > 0) {
      await expect(
        page.getByText("Todo en orden"),
        `"Requieren revisión 0 · Todo en orden" con ${entero(pendientes)} pendientes en Bandeja`,
      ).toHaveCount(0);
    }
  });

  test("B26 — reclasificar un cargo sólo ofrece tipos de movimiento de salida", async ({
    page,
    api,
    evidencia,
  }) => {
    const pLista = esperarApi(page, /^\/api\/bank-movements\?.*status=classified/);
    await page.goto("/caja/clasificados");
    const lista = await jsonDeRespuesta<BankMovementsList>(await pLista);
    const cats = (await api.get<CanonicalCategories>("/api/treasury/canonical-categories")).json;
    const soloEntrada = (cats?.items ?? [])
      .filter((c) => c.expected_direction === "credit")
      .map((c) => c.label);
    test.skip(soloEntrada.length === 0, "El catálogo no declara categorías sólo de entrada.");

    const cargos = (lista?.items ?? []).filter((m) => m.direction === "debit").slice(0, 10);
    let abierto = false;
    for (const m of cargos) {
      const boton = page.getByRole("button", {
        name: `Reclasificar movimiento ${m.description}`,
        exact: true,
      });
      if ((await boton.count()) !== 1) continue;
      // Abrir el panel es lectura; NUNCA se pulsa Guardar.
      await boton.click();
      const tipos = page.getByRole("list", { name: "Tipos de movimiento" });
      await expect(tipos).toBeVisible();
      const ofrecidos = (await tipos.getByRole("listitem").allInnerTexts()).join("\n");
      const indebidos = soloEntrada.filter((l) => ofrecidos.includes(l));
      evidencia.nota(
        `Cargo ${m.date} ${clp(Math.abs(num(m.amount)))} "${m.description}": ofrece ${indebidos.length} tipos de entrada`,
      );
      expect(
        indebidos,
        `Reclasificar el cargo "${m.description}" ofrece tipos de entrada: ${indebidos.join(", ")}`,
      ).toEqual([]);
      abierto = true;
      break;
    }
    test.skip(!abierto, "No hay un cargo clasificado visible en la primera página para abrir.");
  });

  test("B27 — el subtítulo de Clasificados es coherente con el botón Reclasificar y el botón se lee completo", async ({
    page,
  }) => {
    await page.goto("/caja/clasificados");
    const botones = page.getByRole("button", { name: /^Reclasificar movimiento/ });
    await expect(botones.first()).toBeVisible();
    await expect
      .soft(
        page.getByText(/Para reclasificar uno, ve a Por clasificar/i),
        'El subtítulo manda a "Por clasificar" aunque la tabla tiene botón Reclasificar',
      )
      .toHaveCount(0);
    const cortado = await botones.first().evaluate((b) => {
      const el = (b.querySelector("span") as HTMLElement | null) ?? (b as HTMLElement);
      return (
        el.scrollWidth > el.clientWidth + 1 || b.scrollWidth > (b as HTMLElement).clientWidth + 1
      );
    });
    expect(cortado, 'El botón "Reclasificar" se muestra cortado').toBe(false);
  });
});
