import { describe, it, expect } from "vitest";
import { computeObligationProgress } from "./obligation-lifecycle";

const cuota = (number: number, due_date: string, status: string) => ({ number, due_date, status });

describe("computeObligationProgress", () => {
  it("cuenta pagadas, ubica próxima impaga (la más temprana) y la última", () => {
    const p = computeObligationProgress([
      cuota(1, "2026-01-15", "paid"),
      cuota(2, "2026-02-15", "paid"),
      cuota(3, "2026-03-15", "overdue"),
      cuota(4, "2026-04-15", "pending"),
    ]);
    expect(p.paidCount).toBe(2);
    expect(p.overdueCount).toBe(1);
    expect(p.total).toBe(4);
    expect(p.nextDueDate).toBe("2026-03-15");
    expect(p.payoffDate).toBe("2026-04-15");
    expect(p.settled).toBe(false);
  });

  it("acepta labels en español (pagada/vencida)", () => {
    const p = computeObligationProgress([
      cuota(1, "2026-01-15", "pagada"),
      cuota(2, "2026-02-15", "vencida"),
    ]);
    expect(p.paidCount).toBe(1);
    expect(p.overdueCount).toBe(1);
    expect(p.nextDueDate).toBe("2026-02-15");
  });

  it("marca settled cuando todas están pagadas y no deja próxima", () => {
    const p = computeObligationProgress([
      cuota(1, "2026-01-15", "paid"),
      cuota(2, "2026-02-15", "pagada"),
    ]);
    expect(p.settled).toBe(true);
    expect(p.nextDueDate).toBeNull();
    expect(p.payoffDate).toBe("2026-02-15");
  });

  it("no está settled con calendario vacío", () => {
    const p = computeObligationProgress([]);
    expect(p.settled).toBe(false);
    expect(p.total).toBe(0);
    expect(p.nextDueDate).toBeNull();
    expect(p.payoffDate).toBeNull();
  });

  it("prefiere installmentsTotal y NO liquida con calendario parcial", () => {
    const p = computeObligationProgress([cuota(1, "2026-01-15", "paid")], 24);
    expect(p.total).toBe(24);
    // 1 pagada de 24 nominales → no liquidado, aunque las cuotas cargadas estén todas pagadas.
    expect(p.settled).toBe(false);
  });
});
