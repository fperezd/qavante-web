import { test, expect, esperarApi, jsonDeRespuesta } from "./support/fixtures";
import {
  AUTORIZA_PROYECCION,
  SESSION,
  SIN_AUTORIZACION_DE_ESCRITURA,
  SIN_SESION,
} from "./support/env";
import { fuentes } from "./support/datos";
import { diasEntre, fechaSantiago, hoySantiago } from "./support/finanzas";

/* Inicio (y lo que comparte con Caja y Decisiones): proyección y estado de fuentes.
   Cada test afirma lo ESPERADO; hoy falla donde el hallazgo sigue vivo. */

test.describe("QA producción · Inicio", () => {
  test.skip(!SESSION, SIN_SESION);

  test("B01 — la proyección de caja se calcula en Inicio, Caja y Decisiones (sin 503)", async ({
    page,
    evidencia,
  }) => {
    test.skip(!AUTORIZA_PROYECCION, SIN_AUTORIZACION_DE_ESCRITURA);
    const resultados: string[] = [];
    for (const ruta of ["/inicio", "/caja", "/decisiones"]) {
      const espera = esperarApi(page, /^\/api\/treasury\/cash-projection-runs$/, {
        metodo: "POST",
        timeout: 45_000,
      });
      await page.goto(ruta);
      const r = await espera;
      if (!r) {
        evidencia.nota(`${ruta}: la página no pidió la proyección en 45 s.`);
        resultados.push(`${ruta}: sin solicitud de proyección`);
        continue;
      }
      const body = await jsonDeRespuesta<{ detail?: { code?: string } | string; code?: string }>(r);
      const code =
        typeof body?.detail === "object" ? body?.detail?.code : (body?.code ?? body?.detail);
      resultados.push(`${ruta}: ${r.status()}${code ? ` ${code}` : ""}`);
      expect
        .soft(
          r.status(),
          `${ruta}: POST /api/treasury/cash-projection-runs respondió ${r.status()} ${code ?? ""} — no hay proyección`,
        )
        .toBeLessThan(400);
    }
    evidencia.nota(`Proyección por página: ${resultados.join(" · ")}`);
  });

  test("B23 — cada fuente tiene un solo estado coherente con su conexión y la fecha de su último dato", async ({
    page,
    api,
  }) => {
    await page.goto("/inicio");
    const data = await fuentes(api);
    expect(data, "GET /api/sources/status no respondió").not.toBeNull();
    const hoy = hoySantiago();
    const contradicciones: string[] = [];
    for (const s of data?.sources ?? []) {
      const nombre = s.display_name ?? s.source;
      const salud = s.dataset_health ?? [];
      if (s.state === "ok") {
        const rotas = salud.filter(
          (h) =>
            h.credential_state === "unusable" ||
            h.session_state === "unusable" ||
            h.freshness_state === "stale",
        );
        for (const h of rotas) {
          contradicciones.push(
            `${nombre}: estado "ok" pero ${h.dataset} tiene credencial=${h.credential_state}, sesión=${h.session_state}, frescura=${h.freshness_state}${h.reason_code ? ` (${h.reason_code})` : ""}`,
          );
        }
        if (s.freshness_state === "stale") {
          contradicciones.push(`${nombre}: estado "ok" con frescura "stale"`);
        }
        const ultima = s.last_sync ? fechaSantiago(s.last_sync) : null;
        if (ultima && diasEntre(ultima, hoy) > 35) {
          contradicciones.push(
            `${nombre}: estado "ok" con última sincronización el ${ultima} (${diasEntre(ultima, hoy)} días)`,
          );
        }
      }
      if (s.state === "stale" && s.freshness_state === "fresh") {
        contradicciones.push(`${nombre}: estado "desactualizado" con frescura "fresh"`);
      }
      const ultimaStale = s.state === "stale" && s.last_sync ? fechaSantiago(s.last_sync) : null;
      if (ultimaStale && diasEntre(ultimaStale, hoy) <= 1) {
        contradicciones.push(
          `${nombre}: "desactualizado" aunque sincronizó el ${ultimaStale} (la política de frescura no calza con la periodicidad de la fuente)`,
        );
      }
    }
    expect(
      contradicciones,
      `Estados de fuente contradictorios:\n${contradicciones.join("\n")}`,
    ).toEqual([]);
  });
});
