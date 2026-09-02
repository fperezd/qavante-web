import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const activityLog = vi.hoisted(() => ({ useActivityLog: vi.fn() }));
vi.mock("@/lib/api/activity-log", () => ({ useActivityLog: activityLog.useActivityLog }));

import { ActivityRegisteredLive } from "./activity-registered-live";

describe("ActivityRegisteredLive", () => {
  beforeEach(() => {
    activityLog.useActivityLog.mockReset();
    activityLog.useActivityLog.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("consulta la ruta nueva con límite contractual y sin mezclar el reader reversible", () => {
    renderToStaticMarkup(<ActivityRegisteredLive />);
    expect(activityLog.useActivityLog).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it("propaga un fallo del reader como no-sé, con reintento y sin convertirlo en vacío", () => {
    activityLog.useActivityLog.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    const html = renderToStaticMarkup(<ActivityRegisteredLive />);

    expect(html).toContain("No sabemos qué actividad hubo en estas fuentes.");
    expect(html).toMatch(/<button[^>]*>Reintentar<\/button>/);
    // El gemelo positivo de este copy vive en el test de vista de estado vacío.
    expect(html).not.toContain("Aún no hay hechos registrados en las fuentes disponibles.");
  });
});
