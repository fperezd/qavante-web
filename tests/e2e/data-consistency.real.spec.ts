import { test, expect } from "@playwright/test";

/* e2e REAL de consistencia de datos: pega al backend EN VIVO (api.qavante.com) con TU sesión y verifica
   los invariantes sobre los NÚMEROS REALES del tenant. Es el que caza lo que MSW no puede (el
   presupuesto con 98% de margen vs Gestión con 42%).

   Correr (la sesión va por env en runtime, NUNCA se commitea):
     QAVANTE_SESSION="<cookie qavante_session>" npx playwright test --config=playwright.real.config.ts

   Sin `QAVANTE_SESSION` se salta entero. Usa la config `playwright.real.config.ts` (sin dev-server/MSW). */

const SESSION = process.env.QAVANTE_SESSION;

/** "18500000" / "-7400000" / "$1.234" → número. Tolera signo (- o −) y separadores. */
function num(v: unknown): number {
  const s = String(v ?? "").replace(/−/g, "-");
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Período del último mes CERRADO (mes actual − 1) y el año fiscal en curso. */
function ultimoCerrado(): { period: string; year: number } {
  const now = new Date();
  const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    period: `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`,
    year: now.getFullYear(),
  };
}

test.describe("Consistencia de datos REAL (backend en vivo)", () => {
  test.skip(!SESSION, "Definí QAVANTE_SESSION (tu cookie qavante_session) para correr contra datos reales.");

  const { period, year } = ultimoCerrado();

  test(`operational-result: la cascada footea al resultado (${period})`, async ({ request }) => {
    const r = await request.get(`/api/management/operational-result?period=${period}`);
    expect(r.ok(), `GET operational-result → ${r.status()}`).toBeTruthy();
    const d = await r.json();
    // Convención: montos POSITIVOS que se RESTAN. result = ingresos − costos − gastos.
    const suma =
      num(d.revenue) -
      num(d.direct_cost) -
      num(d.labor_cost) -
      num(d.professional_fees) -
      num(d.recurring_expenses);
    const result = num(d.result);
    // Tolerancia: pueden faltar partidas menores ("Otros"), pero no puede divergir por >2% del ingreso.
    const tol = Math.max(50_000, Math.abs(num(d.revenue)) * 0.02);
    expect(
      Math.abs(suma - result),
      `cascada suma ${suma.toLocaleString("es-CL")} pero result dice ${result.toLocaleString("es-CL")}`,
    ).toBeLessThanOrEqual(tol);
  });

  test(`presupuesto ≈ realidad: el "actual" del budget cuadra con Gestión (${period})`, async ({
    request,
  }) => {
    const [ba, or] = await Promise.all([
      request.get(`/api/planning/budget-vs-actual?period=${period}`),
      request.get(`/api/management/operational-result?period=${period}`),
    ]);
    const bad = await ba.json();
    if (!bad.has_budget) {
      test.skip(true, `No hay presupuesto para ${period}.`);
      return;
    }
    const ord = await or.json();
    const resultBA = num(bad.lines?.find((l: { concept: string }) => l.concept === "result")?.actual);
    const resultGestion = num(ord.result);
    // El "actual" del presupuesto y el resultado de Gestión son la MISMA realidad → deben coincidir.
    const tol = Math.max(50_000, Math.abs(resultGestion) * 0.03);
    expect(
      Math.abs(resultBA - resultGestion),
      `budget-vs-actual actual=${resultBA.toLocaleString("es-CL")} vs Gestión result=${resultGestion.toLocaleString("es-CL")}`,
    ).toBeLessThanOrEqual(tol);
  });

  test(`presupuesto NO omite costos: el plan de costos es comparable al real de Gestión (${period})`, async ({
    request,
  }) => {
    const [ba, or] = await Promise.all([
      request.get(`/api/planning/budget-vs-actual?period=${period}`),
      request.get(`/api/management/operational-result?period=${period}`),
    ]);
    const bad = await ba.json();
    if (!bad.has_budget) {
      test.skip(true, `No hay presupuesto para ${period}.`);
      return;
    }
    const ord = await or.json();
    const line = (c: string, capa: "budget" | "actual") =>
      Math.abs(num(bad.lines?.find((l: { concept: string }) => l.concept === c)?.[capa]));
    const costosPlan = line("direct_cost", "budget") + line("operating_expense", "budget");
    const costosGestion =
      num(ord.direct_cost) +
      num(ord.labor_cost) +
      num(ord.professional_fees) +
      num(ord.recurring_expenses);
    // Un plan puede diferir del real, pero NO puede omitir el grueso de los costos (nómina, etc.).
    // Si el presupuesto de costos es <40% de los costos reales, le faltan partidas enteras (el bug).
    expect(
      costosPlan,
      `costos presupuestados ${costosPlan.toLocaleString("es-CL")} vs costos reales de Gestión ${costosGestion.toLocaleString("es-CL")} — al presupuesto le faltan partidas (¿nómina/honorarios/recurrentes?)`,
    ).toBeGreaterThanOrEqual(costosGestion * 0.4);
  });

  test(`budget-vs-actual: las líneas footean al result, en plan y en real (${period})`, async ({
    request,
  }) => {
    const r = await request.get(`/api/planning/budget-vs-actual?period=${period}`);
    const d = await r.json();
    if (!d.has_budget) {
      test.skip(true, `No hay presupuesto para ${period}.`);
      return;
    }
    const val = (c: string, capa: "budget" | "actual") =>
      num(d.lines?.find((l: { concept: string }) => l.concept === c)?.[capa]);
    for (const capa of ["budget", "actual"] as const) {
      // Líneas SIGNADAS (revenue +, costos/gastos −) → suman al result.
      const suma = val("revenue", capa) + val("direct_cost", capa) + val("operating_expense", capa);
      const result = val("result", capa);
      const tol = Math.max(50_000, Math.abs(val("revenue", capa)) * 0.02);
      expect(
        Math.abs(suma - result),
        `${capa}: líneas suman ${suma.toLocaleString("es-CL")} pero result dice ${result.toLocaleString("es-CL")}`,
      ).toBeLessThanOrEqual(tol);
    }
  });

  test(`budget grid: las categorías footean al total del año (${year})`, async ({ request }) => {
    const r = await request.get(`/api/planning/budget/${year}`);
    expect(r.ok(), `GET budget/${year} → ${r.status()}`).toBeTruthy();
    const d = await r.json();
    if (!d.has_budget) {
      test.skip(true, `No hay presupuesto del año ${year}.`);
      return;
    }
    const sumaCats = (d.categories ?? []).reduce(
      (acc: number, c: { total_year?: string }) => acc + num(c.total_year),
      0,
    );
    const totalAnio = num(d.total_year);
    const tol = Math.max(50_000, Math.abs(totalAnio) * 0.01);
    expect(
      Math.abs(sumaCats - totalAnio),
      `suma de categorías ${sumaCats.toLocaleString("es-CL")} vs total del año ${totalAnio.toLocaleString("es-CL")}`,
    ).toBeLessThanOrEqual(tol);
  });
});
