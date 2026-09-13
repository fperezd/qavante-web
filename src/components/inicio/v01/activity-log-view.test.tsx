import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityLogView } from "./activity-log-view";

const ACTIVIDAD = {
  actionId: "accion-1",
  resumen: "Clasificó 14 movimientos del banco con una regla.",
  creadaEn: "2026-09-01T12:00:00Z",
  venceEn: "2026-09-08T12:00:00Z",
  deshacerDisponible: true,
  deshacerResultado: null,
};

describe("ActivityLogView — Mientras no estabas (Ley 5, #65)", () => {
  it("muestra sólo una acción publicada por Qavante, con Ver y Deshacer cuando el contrato lo permite", () => {
    const html = renderToStaticMarkup(
      <ActivityLogView
        activities={[ACTIVIDAD]}
        onUndo={async () => ({
          action_id: "accion-1",
          action_type: "bank_movement.auto_classify",
          result: "reverted",
        })}
        detailLinks
      />,
    );
    expect(html).toContain(ACTIVIDAD.resumen);
    expect(html).toMatch(/<button[^>]*>Deshacer<\/button>/);
    expect(html).toMatch(/href="\/inicio\/actividad#actividad-accion-1"[^>]*>Ver acción<\/a>/);
  });

  it("no ofrece un Deshacer mudo si el backend dice que el estado ya no permite revertir", () => {
    const html = renderToStaticMarkup(
      <ActivityLogView
        activities={[{ ...ACTIVIDAD, actionId: "derivada", deshacerDisponible: false }]}
        onUndo={async () => ({
          action_id: "derivada",
          action_type: "bank_movement.auto_classify",
          result: "undo_not_supported",
        })}
      />,
    );
    // Gemelo positivo con la MISMA regex vive en el test anterior.
    expect(html).not.toMatch(/<button[^>]*>Deshacer<\/button>/);
    expect(html).toContain("Deshacer no disponible");
  });

  it("distingue vacío y falla sin inventar una acción", () => {
    const empty = renderToStaticMarkup(<ActivityLogView activities={[]} />);
    const error = renderToStaticMarkup(
      <ActivityLogView activities={null} error onRetry={() => {}} />,
    );
    expect(empty).toContain("Aún no hay automatismos reversibles registrados");
    expect(error).toContain("No sabemos qué hizo Qavante");
    expect(error).not.toContain("Clasificó");
  });
});
