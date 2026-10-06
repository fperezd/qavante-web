import { test, expect, esperarApi, jsonDeRespuesta } from "./support/fixtures";
import { SESSION, SIN_SESION } from "./support/env";
import { cuentas as leerCuentas, fuentes } from "./support/datos";
import {
  clp,
  diasEntre,
  fechaSantiago,
  hoySantiago,
  JERGA_INTERNA,
  num,
  VOSEO_TILDE,
} from "./support/finanzas";
import type { BankAccountsResponse, BankMovementsList } from "./support/tipos";

/* Banco v03 (src/components/banco/v03). Nada de "Actualizar cuentas" (dispara sincronización):
   B25 se reproduce simulando el 500 en el navegador, sin tocar el backend. */

const soloFecha = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

test.describe("QA producción · Banco", () => {
  test.skip(!SESSION, SIN_SESION);

  test('B16 — fechas y "hoy" en hora de Chile: ningún movimiento ni saldo queda fechado mañana', async ({
    page,
    api,
    evidencia,
  }) => {
    const pMovs = esperarApi(page, /^\/api\/bank-movements\?.*period_from=/);
    await page.goto("/banco");
    const movs = (await jsonDeRespuesta<BankMovementsList>(await pMovs))?.items ?? [];
    const hoy = hoySantiago();
    const corridos: string[] = [];

    for (const m of movs) {
      const importado = fechaSantiago(m.imported_at);
      const fecha = m.date.slice(0, 10);
      if (fecha > hoy)
        corridos.push(`movimiento ${m.id} fechado ${fecha}, después de hoy (${hoy}) en Chile`);
      else if (importado && fecha > importado) {
        corridos.push(
          `movimiento ${m.id} "${m.description}" fechado ${fecha} pero importado el ${importado} (hora de Chile): fecha UTC`,
        );
      }
    }
    for (const c of await leerCuentas(api)) {
      for (const [campo, valor] of [
        ["balance_as_of", c.balance_as_of],
        ["last_movement_at", c.last_movement_at],
      ] as const) {
        const f = soloFecha(valor) ?? (valor ? fechaSantiago(valor) : null);
        if (f && f > hoy)
          corridos.push(
            `cuenta ${c.bank_name} · ${c.name}: ${campo} ${valor} es posterior a hoy (${hoy})`,
          );
      }
    }
    const plan = await api.get<{ as_of?: string }>("/api/treasury/decision-plans/collection");
    const asOf = soloFecha(plan.json?.as_of?.slice(0, 10));
    if (asOf && asOf > hoy)
      corridos.push(`plan de cobranza con as_of ${asOf}, posterior a hoy (${hoy})`);

    evidencia.nota(`Hoy en Chile: ${hoy}; ${movs.length} movimientos revisados`);
    await expect
      .soft(page.locator("body"), 'Banco dice "actualizada mañana"')
      .not.toContainText(/actualizad[ao] mañana/i);
    expect(corridos, `Fechas corridas por UTC:\n${corridos.slice(0, 20).join("\n")}`).toEqual([]);
  });

  test('B17 — la cartola "últimos 3 meses" cubre 90 días corridos', async ({ page, evidencia }) => {
    const pMovs = esperarApi(page, /^\/api\/bank-movements\?.*period_from=/);
    await page.goto("/banco");
    const r = await pMovs;
    expect(r, "Banco no pidió /api/bank-movements con period_from").not.toBeNull();
    const desde = new URL(r!.url()).searchParams.get("period_from") ?? "";
    const inicio = /^\d{4}-\d{2}$/.test(desde) ? `${desde}-01` : desde.slice(0, 10);
    const hoy = hoySantiago();
    const dias = diasEntre(inicio, hoy);
    evidencia.nota(`La cartola pide desde ${inicio} (${dias} días hasta ${hoy})`);
    const declaraMeses = await page.getByText(/últimos 3 meses/i).count();
    expect(
      dias >= 89 || declaraMeses === 0,
      `"Últimos 3 meses" empieza el ${inicio}: cubre ${dias} días, no 90; quedan fuera los movimientos anteriores`,
    ).toBe(true);
  });

  test('B18 — "Bancos conectados" es una pestaña de Banco, no un salto a Administración', async ({
    page,
  }) => {
    await page.goto("/banco");
    const enlace = page
      .getByRole("navigation", { name: "Secciones de banco" })
      .getByRole("link", { name: "Bancos conectados" });
    await expect(enlace).toBeVisible();
    const href = (await enlace.getAttribute("href")) ?? "";
    expect(href, `"Bancos conectados" lleva a ${href}`).toMatch(/^\/banco(\/|\?|#|$)/);
  });

  test("B24 — los mensajes llegan en español de Chile, sin voseo ni jerga interna", async ({
    page,
    api,
    evidencia,
  }) => {
    await page.goto("/banco");
    await expect(page.getByRole("region", { name: "Caja hoy" })).toBeVisible();
    await api.get("/api/bank-movements/bice/accounts");
    await api.get("/api/sources/status");
    const conVoseo: string[] = [];
    for (const c of await evidencia.todas(/^\/api\//)) {
      const m = VOSEO_TILDE.exec(c.body) ?? /sembrar sesi[oó]n/i.exec(c.body);
      if (m) conVoseo.push(`${c.metodo} ${new URL(c.url).pathname} → "${m[0]}"`);
    }
    const textoUi = await page.locator("body").innerText();
    const enUi = VOSEO_TILDE.exec(textoUi)?.[0] ?? JERGA_INTERNA.exec(textoUi)?.[0];
    expect.soft(enUi ?? null, `La pantalla de Banco muestra "${enUi}"`).toBeNull();
    expect(conVoseo, `Mensajes de la API con voseo o jerga:\n${conVoseo.join("\n")}`).toEqual([]);
  });

  test('B25 — si la API de cuentas falla, Banco muestra el último saldo conocido y el error aparte, sin ofrecer "Conectar banco"', async ({
    page,
    api,
    evidencia,
  }) => {
    const estado = await fuentes(api);
    const banco = (estado?.sources ?? []).find((s) =>
      /bank|banco|bice|fintoc/i.test(`${s.source} ${s.category ?? ""}`),
    );
    test.skip(
      !banco || banco.state === "missing",
      "No hay un banco conectado según /api/sources/status.",
    );
    evidencia.nota(
      "El 500 de GET /api/treasury/bank-accounts se SIMULA en el navegador (page.route); el backend no se toca.",
    );
    await page.route(/\/api\/treasury\/bank-accounts(\?|$)/, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Error simulado por QA (B25)" }),
          })
        : route.fallback(),
    );
    const pSum = esperarApi(page, /^\/api\/dashboard\/summary/);
    await page.goto("/banco");
    const sum = await jsonDeRespuesta<{ cash_today?: { total?: string } | null }>(await pSum);
    await expect(page.getByRole("region", { name: "Caja hoy" })).toBeVisible();
    await expect
      .soft(
        page
          .getByRole("link", { name: /conectar (un )?banco/i })
          .or(page.getByRole("button", { name: /conectar (un )?banco/i })),
        'Con un 500 transitorio, Banco ofrece "Conectar banco" como si no hubiera banco',
      )
      .toHaveCount(0);
    if (sum?.cash_today?.total) {
      await expect(
        page.getByRole("region", { name: "Caja hoy" }),
        "El último saldo conocido desaparece cuando falla la API de cuentas",
      ).toContainText(clp(num(sum.cash_today.total)));
    } else {
      expect(
        sum?.cash_today ?? null,
        "Tampoco hay último saldo conocido en dashboard/summary: Banco queda sin saldo ante el 500",
      ).not.toBeNull();
    }
  });

  test("B28 — cada cuenta se distingue por moneda y terminación, y Compras al extranjero permite subir la cartola", async ({
    page,
    api,
  }) => {
    const pCuentas = esperarApi(page, /^\/api\/treasury\/bank-accounts/);
    await page.goto("/banco");
    const lista =
      (await jsonDeRespuesta<BankAccountsResponse>(await pCuentas))?.items ??
      (await leerCuentas(api));
    const visibles = lista.filter((c) => c.active && c.account_type !== "credit_card");
    const porNombre = new Map<string, string[]>();
    for (const c of visibles) {
      const etiqueta = `${c.bank_name} · ${c.name}`;
      porNombre.set(etiqueta, [...(porNombre.get(etiqueta) ?? []), c.currency_code]);
    }
    const repetidos = [...porNombre].filter(([, monedas]) => monedas.length > 1);
    expect
      .soft(
        repetidos.map(([n, m]) => `"${n}" × ${m.length} (${m.join(", ")})`),
        "Cuentas con el mismo nombre en Banco (falta moneda y terminación)",
      )
      .toEqual([]);

    await page.goto("/caja/compras-extranjero");
    const pideCartola = await page.getByText(/sub(e|as|ir) una cartola/i).count();
    if (pideCartola > 0) {
      await expect(
        page
          .getByRole("button", { name: /subir|cargar|importar/i })
          .or(page.getByRole("link", { name: /subir|cargar|importar/i })),
        "Compras al extranjero pide subir una cartola pero no ofrece cómo hacerlo en la página",
      ).not.toHaveCount(0);
    }
  });
});
