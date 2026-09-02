import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityRegisteredView } from "./activity-registered-view";

const ACTIVITIES = [{ id: "sync_run:1", fuente: "sync_run" as const, etiquetaFuente: "Sincronización registrada", tipo: "sii.sync", resumen: "Se registró una sincronización.", creadaEn: "2026-09-02T12:00:00Z", resultado: "completed" }];

describe("ActivityRegisteredView", () => {
  it("muestra la fuente explícita y el único outcome que publicó el reader", () => {
    const html = renderToStaticMarkup(<ActivityRegisteredView activities={ACTIVITIES} />);
    expect(html).toContain("Sincronización registrada");
    expect(html).toContain("Resultado registrado: completed");
    expect(html).toContain(ACTIVITIES[0]?.resumen ?? "");
  });

  it("distingue vacío y error sin afirmar que no hubo actividad", () => {
    const empty = renderToStaticMarkup(<ActivityRegisteredView activities={[]} />);
    const error = renderToStaticMarkup(<ActivityRegisteredView activities={null} error onRetry={() => {}} />);
    expect(empty).toContain("Aún no hay hechos registrados en las fuentes disponibles.");
    expect(error).toContain("No sabemos qué actividad hubo en estas fuentes.");
    expect(error).not.toContain(ACTIVITIES[0]?.resumen ?? "");
  });
});
