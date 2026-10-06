import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { test, expect, dirEvidencia, esperarApi, jsonDeRespuesta } from "./support/fixtures";
import { SESSION, SIN_SESION } from "./support/env";
import type { AccountNode, AccountTree, BankMovementsList } from "./support/tipos";

/* Accesibilidad WCAG 2 A/AA con axe-core en las cinco páginas del informe. Falla por violaciones
   `serious` o `critical`; el reporte completo queda en `test-results/qa-produccion/<ID>/axe.json`. */

const PAGINAS = [
  { id: "inicio", ruta: "/inicio", api: /^\/api\/dashboard\/summary/ },
  { id: "bandeja", ruta: "/bandeja", api: /^\/api\/treasury\/reconciliation\/review/ },
  { id: "decisiones", ruta: "/decisiones", api: /^\/api\/legal-entities/ },
  { id: "caja", ruta: "/caja", api: /^\/api\/dashboard\/summary/ },
  { id: "banco", ruta: "/banco", api: /^\/api\/treasury\/bank-accounts/ },
] as const;

async function esperarCarga(page: Page): Promise<void> {
  // Señal funcional: no quedan zonas marcadas como "cargando".
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
}

async function guardarAxe(info: TestInfo, nombre: string, resultado: unknown): Promise<void> {
  const json = JSON.stringify(resultado, null, 2);
  const dir = dirEvidencia(info);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nombre), json);
  await info.attach(nombre, { body: json, contentType: "application/json" });
}

type Violacion = {
  id: string;
  impact?: string | null;
  help: string;
  nodes: { target: unknown[] }[];
};

function resumen(v: Violacion[]): string {
  return v
    .map(
      (x) =>
        `  · [${x.impact}] ${x.id}: ${x.help} (${x.nodes.length} nodo(s), p.ej. ${JSON.stringify(x.nodes[0]?.target)})`,
    )
    .join("\n");
}

test.describe("QA producción · Accesibilidad", () => {
  test.skip(!SESSION, SIN_SESION);

  for (const p of PAGINAS) {
    test(`A11Y-${p.id} — ${p.ruta} sin violaciones WCAG 2 A/AA serias o críticas`, async ({
      page,
    }, info) => {
      const carga = esperarApi(page, p.api);
      await page.goto(p.ruta);
      await carga;
      await esperarCarga(page);
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      await guardarAxe(info, "axe.json", res);
      const graves = (res.violations as Violacion[]).filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        graves,
        `${p.ruta}: ${graves.length} violación(es) serias/críticas:\n${resumen(graves)}`,
      ).toEqual([]);
    });
  }

  test("B21 — Clasificar: selectores con etiqueta accesible y sólo cuentas imputables, con código y nombre", async ({
    page,
    evidencia,
  }, info) => {
    const pMovs = esperarApi(page, /^\/api\/bank-movements\?.*status=unclassified/);
    const pArbol = esperarApi(page, /^\/api\/management\/accounts\/tree/);
    await page.goto("/bandeja?tab=clasificar");
    const movs = await jsonDeRespuesta<BankMovementsList>(await pMovs);
    const arbol = await jsonDeRespuesta<AccountTree>(await pArbol);
    test.skip((movs?.items ?? []).length === 0, "Hoy no hay movimientos por clasificar.");

    const carta = page.getByRole("region", { name: "Excepción por clasificar" });
    await expect(carta).toBeVisible();

    // (1) Etiqueta accesible de los selectores (Tipo de movimiento / Cuenta de gestión).
    const axe = await new AxeBuilder({ page })
      .include('section[aria-label="Excepción por clasificar"]')
      .withRules(["select-name", "label", "aria-input-field-name"])
      .analyze();
    await guardarAxe(info, "axe-clasificar.json", axe);
    expect
      .soft(
        axe.violations as Violacion[],
        `Selectores sin etiqueta accesible:\n${resumen(axe.violations as Violacion[])}`,
      )
      .toEqual([]);

    // (2) Cuentas agrupadoras (con hijos) no se pueden elegir; (3) las imputables muestran código.
    const agrupadoras = new Map<string, AccountNode>();
    const hojas = new Map<string, AccountNode>();
    const recorrer = (nodos: AccountNode[]) => {
      for (const n of nodos) {
        if (n.children && n.children.length > 0) {
          agrupadoras.set(n.id, n);
          recorrer(n.children);
        } else hojas.set(n.id, n);
      }
    };
    recorrer(arbol?.items ?? []);
    const opciones = await carta.locator("select#bandeja-categoria option").evaluateAll((els) =>
      els.map((o) => ({
        value: (o as HTMLOptionElement).value,
        texto: (o.textContent ?? "").trim(),
        disabled: (o as HTMLOptionElement).disabled,
      })),
    );
    expect(opciones.length, "No se encontró el selector de Cuenta de gestión").toBeGreaterThan(0);
    const elegiblesAgrupadoras = opciones
      .filter((o) => o.value && !o.disabled && agrupadoras.has(o.value))
      .map((o) => o.texto);
    const sinCodigo = opciones
      .filter((o) => o.value && hojas.has(o.value))
      .filter((o) => {
        const code = hojas.get(o.value)!.code;
        return code && !o.texto.includes(code);
      })
      .map((o) => o.texto);
    evidencia.nota(
      `Árbol: ${agrupadoras.size} agrupadoras, ${hojas.size} imputables; opciones en el selector: ${opciones.length}`,
    );
    expect
      .soft(
        elegiblesAgrupadoras,
        `Se pueden elegir ${elegiblesAgrupadoras.length} cuentas agrupadoras`,
      )
      .toEqual([]);
    expect(
      sinCodigo.slice(0, 15),
      `${sinCodigo.length} cuenta(s) imputable(s) sin código en el selector`,
    ).toEqual([]);
  });
});
