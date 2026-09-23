import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { colaConciliar, MOV_DATTATEC, MOV_VOLCAN, sinClasificar } from "./bandeja-v07-fixtures";
import type { BandejaV07ViewProps } from "./bandeja-v07-view";

const arnes = vi.hoisted(() => ({
  vistaProps: undefined as BandejaV07ViewProps | undefined,
  clasificar: vi.fn(),
  refetch: vi.fn(),
  reviewPending: false,
  reviewError: false,
}));

const consulta = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: arnes.refetch,
});

vi.mock("@/components/bandeja/bandeja-scope", () => ({
  useBandejaLegalEntityId: () => "company-1",
}));

vi.mock("./bandeja-v07-view", () => ({
  BandejaV07View: (props: BandejaV07ViewProps) => {
    arnes.vistaProps = props;
    return <p>Clasificar · {props.clasificarTotal}</p>;
  },
}));

vi.mock("@/lib/api/reconciliation", () => ({
  useReconciliationReview: () =>
    arnes.reviewPending
      ? { ...consulta(undefined), isLoading: true }
      : arnes.reviewError
        ? { ...consulta(undefined), isError: true, error: new Error("review failed") }
        : consulta(colaConciliar()),
  useDocumentSuggestions: () => consulta(undefined),
  useConfirmReconciliation: () => ({ mutateAsync: vi.fn() }),
  useConfirmReconciliationWithDocument: () => ({ mutateAsync: vi.fn() }),
  useRejectReconciliationSuggestion: () => ({ mutateAsync: vi.fn() }),
  useRevertReconciliation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/api/treasury", () => ({
  useBankMovements: ({ status }: { status: string }) =>
    status === "unclassified"
      ? consulta({ ...sinClasificar([MOV_DATTATEC]), total: 137 })
      : consulta({ items: [], total: 0 }),
  useCanonicalCategories: () => consulta({ items: [] }),
  useClassifyBankMovement: () => ({ mutateAsync: arnes.clasificar }),
  useClassifyBankMovementsBulk: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/lib/api/management", () => ({
  useManagementAccountsTree: () => consulta({ items: [] }),
}));

vi.mock("@/lib/api/classification-rules", () => ({
  useCreateClassificationRule: () => ({ mutateAsync: vi.fn() }),
  useSuggestRuleForMovement: () => ({ mutateAsync: vi.fn() }),
  useSuggestedCategory: () => consulta(undefined),
}));

vi.mock("@/lib/api/reversible-actions", () => ({
  ACTION_TYPE_BANK_MOVEMENT_AUTO_CLASSIFY: "bank_movement.auto_classify",
  useReversibleActions: () => consulta({ items: [], total: 0 }),
  useRevertReversibleAction: () => ({ mutateAsync: vi.fn() }),
}));

import { BandejaV07Live } from "./bandeja-v07-live";

describe("BandejaV07Live · total real y fallos de escritura", () => {
  beforeEach(() => {
    arnes.vistaProps = undefined;
    arnes.clasificar.mockReset();
    arnes.refetch.mockReset();
    arnes.reviewPending = false;
    arnes.reviewError = false;
  });

  it("publica data.total aunque la página tenga menos items", () => {
    const html = renderToStaticMarkup(<BandejaV07Live />);

    expect(html).toContain("Clasificar · 137");
    expect(arnes.vistaProps?.clasificar).toHaveLength(1);
    expect(arnes.vistaProps?.clasificarTotal).toBe(137);
  });

  it("entrega el movimiento enlazado a la vista que pinta la carta", () => {
    renderToStaticMarkup(
      <BandejaV07Live tabInicial="clasificar" movimientoInicial={MOV_DATTATEC} />,
    );

    expect(arnes.vistaProps?.tabInicial).toBe("clasificar");
    expect(arnes.vistaProps?.movimientoInicial).toBe(MOV_DATTATEC);
  });

  it("conserva el enlace de conciliación mientras carga después de clasificación", () => {
    arnes.reviewPending = true;
    renderToStaticMarkup(<BandejaV07Live tabInicial="conciliar" movimientoInicial={MOV_VOLCAN} />);
    expect(arnes.vistaProps?.enlaceListo).toBe(false);
    expect(arnes.vistaProps?.conciliar).toEqual([]);

    arnes.reviewPending = false;
    renderToStaticMarkup(<BandejaV07Live tabInicial="conciliar" movimientoInicial={MOV_VOLCAN} />);
    expect(arnes.vistaProps?.enlaceListo).toBe(true);
    expect(arnes.vistaProps?.conciliar?.[1]?.id).toBe(MOV_VOLCAN);
  });

  it("conserva el enlace tras error para abrirlo al reintentar", () => {
    arnes.reviewError = true;
    renderToStaticMarkup(<BandejaV07Live tabInicial="conciliar" movimientoInicial={MOV_VOLCAN} />);
    expect(arnes.vistaProps?.enlaceListo).toBe(false);
    expect(arnes.vistaProps?.conciliar).toBeNull();

    arnes.reviewError = false;
    renderToStaticMarkup(<BandejaV07Live tabInicial="conciliar" movimientoInicial={MOV_VOLCAN} />);
    expect(arnes.vistaProps?.enlaceListo).toBe(true);
    expect(arnes.vistaProps?.conciliar?.[1]?.id).toBe(MOV_VOLCAN);
  });

  it("propaga mutateAsync fallido para que la vista no marque el movimiento resuelto", async () => {
    const error = new Error("falló classify");
    arnes.clasificar.mockRejectedValueOnce(error);
    renderToStaticMarkup(<BandejaV07Live />);

    const item = arnes.vistaProps?.clasificar?.[0];
    expect(item).toBeDefined();
    await expect(
      arnes.vistaProps?.onClasificar?.(item!, "cuenta-1", "operational_expense", ""),
    ).rejects.toBe(error);
    expect(arnes.refetch).toHaveBeenCalledTimes(2);
  });
});
