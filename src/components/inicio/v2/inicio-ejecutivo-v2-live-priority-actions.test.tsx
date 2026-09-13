import { describe, expect, it } from "vitest";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import { buildAcciones } from "./inicio-ejecutivo-v2-live";

const priorityActions = [
  {
    priority: 4,
    reason: "Cuarta publicada primero por el servidor",
    deadline: "Viernes",
    cta_label: "Ver cuarta",
    cta_href: "/cobrar?decision_id=cuarta",
  },
  {
    priority: 1,
    reason: "Revisa el pago que evita que tu caja quede bajo cero",
    deadline: "Hoy",
    cta_label: "Ver propuesta",
    cta_href: "/caja/conciliacion?decision_id=evitar-caja-negativa",
  },
  {
    priority: 2,
    reason: "Tercera publicada",
    deadline: "Mañana",
    cta_label: "Ver tercera",
    cta_href: "/pagar?decision_id=tercera",
  },
  {
    priority: 3,
    reason: "Cuarta publicada",
    deadline: "Próxima semana",
    cta_label: "Ver cuarta",
    cta_href: "/gestion?decision_id=cuarta",
  },
] as const;

describe("buildAcciones · priority_actions server-owned", () => {
  it("preserva todas las acciones, en su orden y con sus CTA", () => {
    const actions = buildAcciones({
      priority_actions: priorityActions,
    } as unknown as DashboardSummaryV2);

    expect(actions.map(({ titulo, href, cta }) => ({ titulo, href, cta }))).toEqual(
      priorityActions.map(({ reason, cta_href, cta_label }) => ({
        titulo: reason,
        href: cta_href,
        cta: cta_label,
      })),
    );
    expect(actions).toHaveLength(4);
    expect(actions[1]).toMatchObject({
      titulo: "Revisa el pago que evita que tu caja quede bajo cero",
      href: "/caja/conciliacion?decision_id=evitar-caja-negativa",
      cta: "Ver propuesta",
    });
  });
});
