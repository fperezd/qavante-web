import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdministracionV12View } from "./administracion-v12-view";
import { FILAS_HUB_EJEMPLO } from "./administracion-v12-fixtures";
import type { FilaHubV12 } from "./administracion-v12-model";

/* V12 · Administración — la vista del hub, renderizada de verdad (react-dom/server, sin browser).
 * Mismo criterio que `pagar-v05-view.test.tsx`: se fija sobre el HTML plano. */

function html(filas: FilaHubV12[]): string {
  return renderToStaticMarkup(<AdministracionV12View filas={filas} />);
}

function texto(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("AdministracionV12View", () => {
  it("pinta todas las filas del fixture, cada una con su título", () => {
    const h = html(FILAS_HUB_EJEMPLO);
    for (const fila of FILAS_HUB_EJEMPLO) {
      expect(h).toContain(fila.titulo);
    }
  });

  it("Ley 7 — el título NUNCA trunca: no lleva la clase `truncate`", () => {
    const h = html(FILAS_HUB_EJEMPLO);
    // El título vive en la celda principal (`TablePrimaryCell.value`), sin `truncate`;
    // sólo el `.sub` (la descripción) la lleva. Se verifica que el título aparece FUERA
    // de cualquier bloque marcado `truncate`.
    const bloqueTitulo = new RegExp(
      `<div class="font-semibold text-rediseno-tinta">${FILAS_HUB_EJEMPLO[0]!.titulo}</div>`,
    );
    expect(bloqueTitulo.test(h)).toBe(true);
  });

  it("la descripción (metadato) envuelve y no se trunca", () => {
    const h = html(FILAS_HUB_EJEMPLO);
    expect(h).toContain("whitespace-normal");
    expect(h).toContain("break-words");
    expect(h).not.toContain("truncate");
  });

  it("credenciales con N=1 muestra 'requiere' en singular, no 'requieren'", () => {
    const filas = FILAS_HUB_EJEMPLO.map((f) =>
      f.id === "credenciales"
        ? { ...f, estado: { tono: "warn" as const, texto: "1 requiere tu acción → Renovar" } }
        : f,
    );
    const t = texto(html(filas));
    expect(t).toContain("1 requiere tu acción");
    expect(t).not.toContain("1 requieren tu acción");
  });

  it("credenciales con N=2 muestra 'requieren' en plural, no 'requiere' suelto", () => {
    const filas = FILAS_HUB_EJEMPLO.map((f) =>
      f.id === "credenciales"
        ? { ...f, estado: { tono: "warn" as const, texto: "2 requieren tu acción → Renovar" } }
        : f,
    );
    const t = texto(html(filas));
    expect(t).toContain("2 requieren tu acción");
    // Sin \b nativo entre palabras raras: se verifica la ausencia del patrón singular exacto.
    expect(t).not.toContain("2 requiere tu acción");
  });

  it("una tarjeta con estado=null (hueco declarado) NO pinta pill en esa tarjeta", () => {
    const filas = FILAS_HUB_EJEMPLO.filter((f) => f.id === "monedas");
    const h = html(filas);
    expect(h).not.toContain("rounded-full");
  });

  it("una fila CON estado sí pinta su texto (control positivo del assert anterior)", () => {
    const filas = FILAS_HUB_EJEMPLO.filter((f) => f.id === "empresas");
    const h = html(filas);
    expect(h).toContain("rounded-full");
    expect(h).toContain("2 empresas");
  });

  it("cada módulo enlaza a su href (tabla: Ver; tarjetas: card entera)", () => {
    const h = html(FILAS_HUB_EJEMPLO);
    for (const fila of FILAS_HUB_EJEMPLO) {
      expect(h).toContain(`href="${fila.href}"`);
    }
    expect(h).toContain(">Ver<");
  });

  it("tabla vacía: usa el emptyMessage declarado, no un 'Cargando' desnudo", () => {
    const h = texto(html([]));
    expect(h).toContain("No hay módulos que mostrar.");
    expect(h).not.toMatch(/Cargando\s*(\.{3}|…)?\s*(<|$)/);
  });

  it("lista de cuenta no muestra encabezados de tabla ni conteo de módulos", () => {
    const t = texto(html(FILAS_HUB_EJEMPLO));
    expect(t).not.toContain("Módulo");
    expect(t).not.toContain("Estado");
    expect(t).not.toMatch(/\d+\s+módulos?/);
  });

  it("tarjetas incluyen sección Por empresa y credenciales con pill de estado", () => {
    const h = html(FILAS_HUB_EJEMPLO);
    expect(h).toContain("Por empresa");
    expect(h).toContain("1 requiere tu acción");
  });
});
