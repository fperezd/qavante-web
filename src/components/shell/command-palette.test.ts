import { describe, it, expect } from "vitest";
import { matches, visibleCommands } from "./command-palette-commands";

/* Lógica de filtrado del command palette (⌘K). Puro/testeable: match tolerante
   por label, grupo y keywords, con múltiples términos en AND (sin importar el
   orden). */

const f29 = { label: "F29", group: "SII", keywords: "impuestos iva ppm declaracion mensual" };
const ventas = {
  label: "Facturas de venta",
  group: "SII",
  keywords: "sii ventas facturas emitidas libro rcv",
};

describe("command-palette · matches", () => {
  it("query vacío matchea todo", () => {
    expect(matches(f29, "")).toBe(true);
  });

  it("matchea por label (case-insensitive)", () => {
    expect(matches(ventas, "libro")).toBe(true);
    expect(matches(ventas, "VENTAS")).toBe(true);
  });

  it("matchea por keyword aunque no esté en el label", () => {
    expect(matches(f29, "iva")).toBe(true); // "iva" solo está en keywords
    expect(matches(f29, "impuestos")).toBe(true);
  });

  it("múltiples términos: todos deben matchear (AND), sin importar el orden", () => {
    expect(matches(ventas, "libro ventas")).toBe(true);
    expect(matches(ventas, "ventas libro")).toBe(true);
    expect(matches(ventas, "libro compras")).toBe(false); // "compras" no está
  });

  it("no matchea términos ausentes", () => {
    expect(matches(f29, "remuneraciones")).toBe(false);
  });
});

describe("command-palette · visibleCommands (gating por rol)", () => {
  it("owner ve Administración; viewer no", () => {
    const asOwner = visibleCommands("owner").map((c) => c.id);
    const asViewer = visibleCommands("viewer").map((c) => c.id);
    expect(asOwner).toContain("admin");
    expect(asViewer).not.toContain("admin");
    // Los destinos sin `roles` los ven todos.
    expect(asViewer).toContain("cobrar");
  });
});
