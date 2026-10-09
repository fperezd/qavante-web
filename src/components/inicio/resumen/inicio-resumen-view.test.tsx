import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InicioResumenView } from "./inicio-resumen-view";
import { DEFICIT, NOW } from "./inicio-resumen.fixtures";

describe("InicioResumenView · acciones prioritarias server-owned", () => {
  it("muestra el contexto y CTA de una decisión de conciliación con decision_id", () => {
    const html = renderToStaticMarkup(
      <InicioResumenView
        data={{
          ...DEFICIT,
          priority_actions: [
            {
              priority: 1,
              reason: "Revisa el pago que evita que tu caja quede bajo cero",
              deadline: "Hoy",
              cta_label: "Ver propuesta",
              cta_href: "/caja/conciliacion?decision_id=evitar-caja-negativa",
            },
          ],
        }}
        empresa="Empresa SpA"
        hoy={NOW}
      />,
    );

    expect(html).toContain("Revisa el pago que evita que tu caja quede bajo cero");
    expect(html).toContain("Decisión del día");
    expect(html).toContain('href="/caja/conciliacion?decision_id=evitar-caja-negativa"');
  });
});
