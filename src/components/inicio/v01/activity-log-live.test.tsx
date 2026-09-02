import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reversibleActions = vi.hoisted(() => ({
  useReversibleActions: vi.fn(),
  mutateAsync: vi.fn(),
}));

const reactHooks = vi.hoisted(() => ({ useState: vi.fn() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  reactHooks.useState.mockImplementation(actual.useState);
  return { ...actual, useState: reactHooks.useState };
});

vi.mock("@/lib/api/reversible-actions", () => ({
  useReversibleActions: reversibleActions.useReversibleActions,
  useRevertReversibleAction: () => ({ mutateAsync: reversibleActions.mutateAsync }),
}));

import { ActivityLogLive } from "./activity-log-live";

function respuesta(total: number) {
  return {
    total,
    items: [
      {
        action_id: "accion-1",
        action_type: "bank_movement.auto_classify",
        summary: "Clasificó movimientos automáticamente.",
        created_at: "2026-09-01T12:00:00Z",
        undo_expires_at: "2026-09-08T12:00:00Z",
        undo_available: true,
        status: "active" as const,
      },
    ],
  };
}

describe("ActivityLogLive — contrato del reader reversible (#65)", () => {
  beforeEach(() => {
    reversibleActions.useReversibleActions.mockReset();
    reversibleActions.mutateAsync.mockReset();
    reversibleActions.useReversibleActions.mockReturnValue({
      data: respuesta(1),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("la portada consulta sólo automatismos deshacibles y acota a cinco", () => {
    renderToStaticMarkup(<ActivityLogLive />);

    expect(reversibleActions.useReversibleActions).toHaveBeenCalledWith({
      onlyUndoable: true,
      limit: 5,
      offset: 0,
    });
  });

  it("la ruta completa conserva el mismo filtro y pagina con total y offset", () => {
    reversibleActions.useReversibleActions.mockReturnValue({
      data: respuesta(41),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    reactHooks.useState.mockReturnValueOnce([20, vi.fn()]);

    const html = renderToStaticMarkup(<ActivityLogLive complete />);

    expect(reversibleActions.useReversibleActions).toHaveBeenCalledWith({
      onlyUndoable: true,
      limit: 20,
      offset: 20,
    });
    expect(html).toContain("21–40 de 41");
    // Gemelo positivo del control de siguiente página: con el total anterior hay otra página.
    expect(html).toMatch(/<button[^>]*>Siguientes<\/button>/);
  });
});
