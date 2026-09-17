import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HOY, pagos } from "./pagar-v05-fixtures";
import { esPostergable } from "./pagar-v05-model";
import { PagarV05View } from "./pagar-v05-view";
import { montoCLP, montoCLPFaltante } from "@/components/pagar/pagos-format";
import { parseAmount } from "@/lib/formatters/amount";
import { formatClp } from "@/lib/formatters/clp";

describe("Pagar V05 D02 view", () => {
  it("declara abstención de nómina cuando la frescura no está confirmada", () => {
    const ap = pagos({
      next_payroll: null,
      payroll_coverage: {
        complete: false,
        sources: [
          {
            source: "buk",
            status: "ready",
            last_success_at: null,
            freshness_confirmed: false,
            covered: false,
          },
          {
            source: "previred",
            status: "ready",
            last_success_at: null,
            freshness_confirmed: false,
            covered: false,
          },
        ],
      },
    });
    const html = renderToStaticMarkup(<PagarV05View pagos={ap} hoy={new Date("2026-08-30")} />);
    expect(html).toContain("Próxima nómina: no determinada");
    expect(html).not.toContain("No hay obligaciones vivas de nómina");
  });

  it("rotula la exportación y navegación como página, no como universo", () => {
    const html = renderToStaticMarkup(
      <PagarV05View pagos={pagos()} pagina={2} onAnterior={() => undefined} />,
    );
    expect(html).toContain("Página 2 · exporta sólo esta página");
    expect(html).toContain("Exportar esta página");
    expect(html).toContain("Anterior");
  });

  it("no publica un monto negociable derivado de los ítems de la página (#302 P3)", () => {
    /* La página deja fuera al último proveedor (Chipax) para que la suma de la página no
       coincida con el bucket `supplier` de `by_category` del servidor, que sí incluye a todos. */
    const base = pagos();
    const ap = pagos({ items: base.items!.slice(0, -1) });
    const html = renderToStaticMarkup(<PagarV05View pagos={ap} hoy={HOY} />);

    /* La cifra que publicaba el banner heredado ("$X de lo que vence es negociable · Ver Hoy"):
       lo postergable de la PÁGINA sumado en CLP. Se recalcula acá con los mismos helpers para
       que el negativo mida ese número y no una frase que ya no existe. */
    const negociablePagina = ap
      .items!.filter((it) => esPostergable(it) && !montoCLPFaltante(it))
      .reduce((s, it) => s + montoCLP(it), 0);
    expect(negociablePagina).toBeGreaterThan(0);
    /* Guard del propio test: la suma no coincide con ningún agregado del servidor del fixture.
       Si apareciera en el HTML, sólo puede haber salido de la página. */
    const agregadosServidor = [
      ap.total,
      ap.due_7d,
      ap.due_14d,
      ap.due_30d,
      ap.overdue_summary?.known_amount_clp,
      ap.non_postponable_or_overdue_14d?.known_amount_clp,
      ...(ap.by_category ?? []).map((b) => b.known_amount_clp),
    ].map((v) => parseAmount(v ?? "0"));
    expect(agregadosServidor).not.toContain(negociablePagina);
    expect(html).not.toContain(formatClp(negociablePagina));

    // Gemelo positivo: lo que SÍ se publica es el agregado del servidor sobre todo el registro.
    expect(html).toContain("$16.807.705 críticos · 6 pagos");

    /* Tampoco hay un enlace que mande a Hoy a decidir postergaciones; la vista sí renderea
       enlaces (el detalle de cada pago), así que la ausencia se mide sobre anclas reales. */
    expect(html).toMatch(/<a\b/);
    expect(html).not.toMatch(/<a\b[^>]*>[^<]*\bHoy\b[^<]*<\/a>/);
  });

  it("muestra todos los ítems de la página API sin una segunda paginación", () => {
    const base = pagos();
    const items = Array.from({ length: 30 }, (_, index) => ({
      ...base.items![0]!,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      label: `Proveedor ${index + 1}`,
      counterparty_name: `Proveedor ${index + 1}`,
    }));
    const html = renderToStaticMarkup(
      <PagarV05View
        pagos={{
          ...base,
          items,
          items_total: items.length,
          filter_metadata: {
            ...base.filter_metadata,
            matched_items_total: items.length,
            unfiltered_items_total: items.length,
          },
        }}
      />,
    );
    expect(html).toContain("Proveedor 30");
    expect(html).not.toContain('aria-label="Página siguiente"');
  });

  it("una moneda excluida no se presenta como un solo pago", () => {
    const base = pagos();
    const html = renderToStaticMarkup(
      <PagarV05View
        pagos={{
          ...base,
          non_postponable_or_overdue_14d: {
            amount_clp: null,
            known_amount_clp: "0",
            complete: false,
            count: 10,
            unknown_due_date_count: 0,
            excluded_by_currency: [{ currency: "USD", amount: "8300" }],
          },
        }}
      />,
    );
    expect(html).toContain("10 pagos críticos · monto sin dato");
    expect(html).not.toContain("1 moneda excluida");
    expect(html).not.toContain("1 pago crítico");
  });
});
