import { describe, expect, it } from "vitest";
import type { WorkInboxQueue } from "@/lib/api/work-inbox";
import { emptyQueueLabel, formattedQueueAmounts, pendingCount } from "./work-inbox-model";

function queue(overrides: Partial<WorkInboxQueue> = {}): WorkInboxQueue {
  return {
    action_label: "Abrir",
    amounts: [],
    count: 0,
    data_state: "available",
    href: "/bandeja",
    items: [],
    kind: "reconciliation",
    label: "Conciliar",
    limitations: [],
    next_date: null,
    ...overrides,
  };
}

describe("work inbox model", () => {
  it("mantiene cada moneda separada y no calcula un total mixto", () => {
    expect(
      formattedQueueAmounts(
        queue({
          amounts: [
            { amount: "1250000.00", currency: "CLP" },
            { amount: "80.25", currency: "USD" },
          ],
        }),
      ),
    ).toEqual(["$1.250.000", "US$ 80,25"]);
  });

  it("no presenta una cola parcial vacía como trabajo completado", () => {
    expect(emptyQueueLabel(queue({ data_state: "partial" }))).toBe("Sin pendientes confirmados");
  });

  it("suma sólo conteos de casos, no montos", () => {
    expect(pendingCount([queue({ count: 2 }), queue({ count: 3, kind: "payables" })])).toBe(5);
  });
});
