import { describe, expect, it } from "vitest";
import type { BankMovement } from "@/lib/api/treasury";
import type { ManagementAccountNode } from "@/lib/api/management";
import {
  buildAccountsLookup,
  buildCategoriesLookup,
  buildClasificadosStats,
  type CategoryLookupItem,
  type AccountLookupItem,
} from "./build-clasificados-stats";

/* Sanity del helper de agregación que alimenta el bloque "Resumen de
 * movimientos clasificados" en /caja/clasificados. Helper puro = tests
 * unitarios sin MSW ni React. */

function mov(
  partial: Partial<BankMovement> & Pick<BankMovement, "id" | "direction" | "amount">,
): BankMovement {
  return {
    bank_account_id: "acct-1",
    external_id: `ext-${partial.id}`,
    date: "2026-05-01",
    description: "",
    canonical_category: null,
    management_account_id: null,
    reconciliation_status: "unmatched",
    data_status: "available",
    imported_at: "2026-05-01T00:00:00Z",
    classification_status: "classified",
    ...partial,
  } as BankMovement;
}

const CATEGORIES: ReadonlyArray<CategoryLookupItem> = [
  { code: "supplier_payment", label: "Pago a proveedor" },
  { code: "client_collection", label: "Cobro de cliente" },
  { code: "payroll_payment", label: "Sueldos" },
];

function categoriesLookup() {
  return buildCategoriesLookup(CATEGORIES);
}

function accountsLookup() {
  const out = new Map<string, AccountLookupItem>();
  out.set("acc-servicios", { id: "acc-servicios", name: "Servicios", path: "Costos / Servicios" });
  out.set("acc-ventas", { id: "acc-ventas", name: "Ventas", path: "Ingresos / Ventas" });
  out.set("acc-sueldos", { id: "acc-sueldos", name: "Sueldos", path: "Costos / Sueldos" });
  return out;
}

describe("buildClasificadosStats", () => {
  it("lista vacía → contadores en 0 y top* en null, scope filtered_total", () => {
    const stats = buildClasificadosStats({
      items: [],
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.count).toBe(0);
    expect(stats.incomeAmount).toBe(0);
    expect(stats.expenseAmount).toBe(0);
    expect(stats.netAmount).toBe(0);
    expect(stats.needsReviewCount).toBe(0);
    expect(stats.topCanonical).toBeNull();
    expect(stats.topAccount).toBeNull();
    expect(stats.lastClassifiedAt).toBeNull();
    expect(stats.dataScope).toBe("filtered_total");
    expect(stats.dataStatus).toBe("ok");
  });

  it("cuenta total de movimientos = items.length", () => {
    const items = [
      mov({ id: "1", direction: "credit", amount: "100" }),
      mov({ id: "2", direction: "debit", amount: "50" }),
      mov({ id: "3", direction: "debit", amount: "25" }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.count).toBe(3);
  });

  it("suma credit como incomeAmount y debit como expenseAmount (parsea amount string y usa valor absoluto)", () => {
    const items = [
      mov({ id: "1", direction: "credit", amount: "1000000.00" }),
      mov({ id: "2", direction: "credit", amount: "500000" }),
      mov({ id: "3", direction: "debit", amount: "-300000.00" }),
      mov({ id: "4", direction: "debit", amount: "200000" }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.incomeAmount).toBe(1_500_000);
    expect(stats.expenseAmount).toBe(500_000);
  });

  it("netAmount = income − expense (positivo)", () => {
    const items = [
      mov({ id: "1", direction: "credit", amount: "1000" }),
      mov({ id: "2", direction: "debit", amount: "400" }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.netAmount).toBe(600);
  });

  it("netAmount negativo cuando expense > income", () => {
    const items = [
      mov({ id: "1", direction: "credit", amount: "100" }),
      mov({ id: "2", direction: "debit", amount: "500" }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.netAmount).toBe(-400);
  });

  it("needsReviewCount considera classification_status, confidence baja y data_status no-available", () => {
    const items = [
      mov({
        id: "ok",
        direction: "credit",
        amount: "100",
        classification_status: "classified",
        confidence: "0.95",
      }),
      mov({ id: "ns", direction: "debit", amount: "100", classification_status: "needs_review" }),
      mov({ id: "low", direction: "debit", amount: "100", confidence: "0.5" }),
      mov({ id: "stale", direction: "debit", amount: "100", data_status: "stale" }),
      mov({ id: "miss", direction: "debit", amount: "100", data_status: "missing" }),
      /* No se cuenta dos veces aunque cumpla ambos criterios. */
      mov({
        id: "both",
        direction: "debit",
        amount: "100",
        classification_status: "needs_review",
        confidence: "0.3",
        data_status: "inconsistent",
      }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.needsReviewCount).toBe(5);
  });

  it("topCanonical devuelve label humano (nunca el code crudo) y respeta el conteo", () => {
    const items = [
      mov({ id: "1", direction: "debit", amount: "100", canonical_category: "supplier_payment" }),
      mov({ id: "2", direction: "debit", amount: "100", canonical_category: "supplier_payment" }),
      mov({ id: "3", direction: "debit", amount: "100", canonical_category: "supplier_payment" }),
      mov({
        id: "4",
        direction: "credit",
        amount: "999999",
        canonical_category: "client_collection",
      }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.topCanonical?.code).toBe("supplier_payment");
    expect(stats.topCanonical?.label).toBe("Pago a proveedor");
    expect(stats.topCanonical?.label).not.toBe("supplier_payment");
    expect(stats.topCanonical?.count).toBe(3);
  });

  it("topAccount devuelve path legible del lookup, no el id", () => {
    const items = [
      mov({ id: "1", direction: "debit", amount: "100", management_account_id: "acc-servicios" }),
      mov({ id: "2", direction: "debit", amount: "100", management_account_id: "acc-servicios" }),
      mov({ id: "3", direction: "credit", amount: "100", management_account_id: "acc-ventas" }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.topAccount?.id).toBe("acc-servicios");
    expect(stats.topAccount?.path).toBe("Costos / Servicios");
    expect(stats.topAccount?.count).toBe(2);
  });

  it("lastClassifiedAt = max(classified_at), ignora nulls", () => {
    const items = [
      mov({ id: "1", direction: "credit", amount: "100", classified_at: "2026-05-10T12:00:00Z" }),
      mov({ id: "2", direction: "credit", amount: "100", classified_at: null }),
      mov({ id: "3", direction: "credit", amount: "100", classified_at: "2026-05-20T15:30:00Z" }),
      mov({ id: "4", direction: "credit", amount: "100", classified_at: "2026-05-18T09:00:00Z" }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.lastClassifiedAt).toBe("2026-05-20T15:30:00Z");
  });

  it("dataScope='current_page' cuando isPartial=true (caller detectó alcance parcial)", () => {
    const items = [mov({ id: "1", direction: "credit", amount: "100" })];
    const stats = buildClasificadosStats({
      items,
      isPartial: true,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.dataScope).toBe("current_page");
    expect(stats.dataStatus).toBe("partial");
  });

  it("dataScope='filtered_total' cuando isPartial=false (caller tiene el universo completo)", () => {
    const items = [
      mov({ id: "1", direction: "credit", amount: "100" }),
      mov({ id: "2", direction: "debit", amount: "50" }),
    ];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.dataScope).toBe("filtered_total");
    expect(stats.dataStatus).toBe("ok");
  });

  it("completeRate = null en este PR (brecha backend documentada)", () => {
    const items = [mov({ id: "1", direction: "credit", amount: "100" })];
    const stats = buildClasificadosStats({
      items,
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.completeRate).toBeNull();
  });

  it("currencyCode='CLP' fijo mientras BankMovement no exponga currency", () => {
    const stats = buildClasificadosStats({
      items: [],
      isPartial: false,
      categoriesById: categoriesLookup(),
      accountsById: accountsLookup(),
    });
    expect(stats.currencyCode).toBe("CLP");
  });
});

describe("buildAccountsLookup", () => {
  it("aplana el árbol y arma paths legibles con ' / '", () => {
    const tree: ManagementAccountNode[] = [
      {
        id: "acc-costos",
        code: "costos",
        name: "Costos",
        type: "expense",
        parent_id: null,
        destination: "operational_income_statement",
        display_name: "Costos",
        description: null,
        level: 0,
        path: "costos",
        sort_order: 20,
        is_system: true,
        is_visible: true,
        affects_pulso: true,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        children: [
          {
            id: "acc-servicios",
            code: "costos.servicios",
            name: "Servicios",
            type: "expense",
            parent_id: "acc-costos",
            destination: "operational_income_statement",
            display_name: "Software y tecnología",
            description: null,
            level: 1,
            path: "costos/servicios",
            sort_order: 10,
            is_system: false,
            is_visible: true,
            affects_pulso: true,
            active: true,
            created_at: "2026-01-01T00:00:00Z",
            children: [],
          },
        ],
      },
    ] as unknown as ManagementAccountNode[];

    const lookup = buildAccountsLookup(tree);
    expect(lookup.get("acc-costos")?.path).toBe("Costos");
    expect(lookup.get("acc-servicios")?.path).toBe("Costos / Software y tecnología");
    expect(lookup.get("acc-servicios")?.name).toBe("Software y tecnología");
  });
});

describe("buildCategoriesLookup", () => {
  it("crea map code → { code, label }", () => {
    const lookup = buildCategoriesLookup(CATEGORIES);
    expect(lookup.get("supplier_payment")?.label).toBe("Pago a proveedor");
    expect(lookup.size).toBe(3);
  });
});
