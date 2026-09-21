import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BankMovementsParams } from "@/lib/api/treasury";
import type { MovimientosDetalleProps } from "./movimientos-detalle";
import type { BankResolutionDetailDrawerProps } from "./v03/bank-resolution-detail-drawer";

type DialogProps = {
  movementId: string | null;
  currencyCode?: string | null;
  open: boolean;
  onChoose: (documentId: string) => Promise<void> | void;
};

const arnes = vi.hoisted(() => ({
  stateCall: 0,
  writer: true,
  editorAvailable: true,
  resolutionError: null as Error | null,
  movementParams: undefined as BankMovementsParams | undefined,
  listProps: undefined as MovimientosDetalleProps | undefined,
  drawerProps: undefined as BankResolutionDetailDrawerProps | undefined,
  dialogProps: undefined as DialogProps | undefined,
  setSelected: vi.fn(),
  setPicker: vi.fn(),
  confirmDocument: vi.fn(),
  reviewEnabled: undefined as boolean | undefined,
  refetch: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState<T>(initial: T) {
      arnes.stateCall += 1;
      if (arnes.stateCall === 2) return ["mov-1", arnes.setSelected] as unknown as [T, () => void];
      if (arnes.stateCall === 3) return [true, arnes.setPicker] as unknown as [T, () => void];
      return actual.useState(initial);
    },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/auth/permissions", () => ({
  hasPermission: () => arnes.writer,
}));

vi.mock("@/lib/api/users", () => ({
  useMyPermissions: () => ({ data: { permissions: ["financial.write"] } }),
}));

const query = <T,>(data: T) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  dataUpdatedAt: 1,
  refetch: arnes.refetch,
});

vi.mock("@/lib/api/treasury", () => ({
  BANK_MOVEMENTS_LIMIT_MAX: 500,
  treasuryKeys: { all: ["treasury"] },
  createTreasuryIdempotencyKey: () => "idem-1",
  useBankAccounts: () =>
    query({
      items: [{ id: "account-1", name: "Cuenta USD", bank_name: "Banco", currency_code: "USD" }],
    }),
  useBankMovements: (params: BankMovementsParams) => {
    arnes.movementParams = params;
    return query({
      total: 1,
      items: [
        {
          id: "mov-1",
          bank_account_id: "account-1",
          external_id: "ext-1",
          date: "2026-09-09",
          description: "Pago proveedor",
          amount: "1200",
          direction: "debit",
          currency_code: "USD",
          canonical_category: null,
          management_account_id: null,
          reconciliation_status: "unmatched",
          classification_status: "unclassified",
        },
      ],
    });
  },
  useBankMovementResolution: () => ({
    ...query(undefined),
    isError: arnes.resolutionError != null,
    error: arnes.resolutionError,
  }),
  useFinancialEventTypes: () =>
    query({ items: arnes.editorAvailable ? [{ code: "supplier_payment" }] : [] }),
  useReplaceBankMovementClassification: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUnclassifyBankMovement: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/api/reconciliation", () => ({
  useReconciliationReview: (enabled: boolean) => {
    arnes.reviewEnabled = enabled;
    return query({ items: [] });
  },
  useConfirmReconciliation: () => ({ mutate: vi.fn() }),
  useConfirmReconciliationBatch: () => ({ mutate: vi.fn(), isPending: false }),
  useConfirmReconciliationWithDocument: () => ({
    isPending: false,
    mutateAsync: arnes.confirmDocument,
  }),
  useRejectReconciliation: () => ({ mutate: vi.fn() }),
  useRevertReconciliation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/api/management", () => ({
  useClassificationDimensions: () => ({ data: [] }),
  useManagementAccountsTree: () =>
    query({
      items: arnes.editorAvailable
        ? [
            {
              id: "management-1",
              name: "Proveedores",
              display_name: "Proveedores",
              active: true,
              is_visible: true,
              children: [],
            },
          ]
        : [],
    }),
}));

vi.mock("./movimientos-detalle", () => ({
  MovimientosDetalle: (props: MovimientosDetalleProps) => {
    arnes.listProps = props;
    return <p>Movimientos</p>;
  },
}));

vi.mock("./v03/bank-resolution-detail-drawer", () => ({
  BankResolutionDetailDrawer: (props: BankResolutionDetailDrawerProps) => {
    arnes.drawerProps = props;
    return <p>Detalle</p>;
  },
}));

vi.mock("@/components/caja/conciliacion/document-suggestions-dialog", () => ({
  DocumentSuggestionsDialog: (props: DialogProps) => {
    arnes.dialogProps = props;
    return <p>Selector</p>;
  },
}));

import { CuentaDetalleLive } from "./cuenta-detalle-live";

describe("CuentaDetalleLive · wiring de resolución bancaria", () => {
  beforeEach(() => {
    arnes.stateCall = 0;
    arnes.writer = true;
    arnes.editorAvailable = true;
    arnes.resolutionError = null;
    arnes.movementParams = undefined;
    arnes.listProps = undefined;
    arnes.drawerProps = undefined;
    arnes.dialogProps = undefined;
    arnes.reviewEnabled = undefined;
    arnes.setSelected.mockReset();
    arnes.setPicker.mockReset();
    arnes.confirmDocument.mockReset();
    arnes.confirmDocument.mockResolvedValue({ status: "confirmed" });
    arnes.refetch.mockReset();
  });

  it("consulta la cuenta completa, abre el selector y confirma movimiento + documento", async () => {
    renderToStaticMarkup(
      <CuentaDetalleLive numeroCuenta="account-1" mesActual="2026-09" conciliarEnabled />,
    );

    expect(arnes.movementParams).toEqual({
      period: "2026-09",
      bank_account_id: "account-1",
      limit: 500,
    });
    expect(arnes.listProps?.conciliarEnabled).toBe(true);
    expect(arnes.drawerProps?.onReconcile).toBeTypeOf("function");
    expect(arnes.drawerProps?.classificationEditor?.onSave).toBeTypeOf("function");
    arnes.drawerProps?.onReconcile?.();
    expect(arnes.setPicker).toHaveBeenCalledWith(true);
    expect(arnes.dialogProps).toMatchObject({
      movementId: "mov-1",
      currencyCode: "USD",
      open: true,
    });

    await arnes.dialogProps?.onChoose("doc-9");
    expect(arnes.confirmDocument).toHaveBeenCalledWith({
      movementId: "mov-1",
      documentId: "doc-9",
    });
  });

  it("un viewer abre el detalle de lectura, pero no recibe controles ni consultas de escritura", () => {
    arnes.writer = false;
    renderToStaticMarkup(
      <CuentaDetalleLive numeroCuenta="account-1" mesActual="2026-09" conciliarEnabled />,
    );

    expect(arnes.listProps?.conciliarEnabled).toBe(false);
    expect(arnes.listProps?.onOpenMovement).toBeTypeOf("function");
    arnes.listProps?.onOpenMovement?.(arnes.listProps.movimientos[0]!);
    expect(arnes.setSelected).toHaveBeenCalledWith("mov-1");
    expect(arnes.listProps?.onConciliar).toBeUndefined();
    expect(arnes.listProps?.onRechazar).toBeUndefined();
    expect(arnes.reviewEnabled).toBe(false);
    expect(arnes.drawerProps?.onReconcile).toBeUndefined();
    expect(arnes.drawerProps?.onUnreconcile).toBeUndefined();
    expect(arnes.drawerProps?.onUnclassify).toBeUndefined();
    expect(arnes.drawerProps?.classificationEditor).toBeUndefined();
    expect(arnes.dialogProps?.open).toBe(false);
  });

  it("un fallo del detalle canónico se declara y deshabilita todas sus acciones", () => {
    arnes.resolutionError = new Error("falló el detalle");
    renderToStaticMarkup(
      <CuentaDetalleLive numeroCuenta="account-1" mesActual="2026-09" conciliarEnabled />,
    );

    expect(arnes.drawerProps?.resolutionError).toBe(arnes.resolutionError);
    expect(arnes.drawerProps?.onRetryResolution).toBeTypeOf("function");
    expect(arnes.drawerProps?.onReconcile).toBeUndefined();
    expect(arnes.drawerProps?.onUnreconcile).toBeUndefined();
    expect(arnes.drawerProps?.onUnclassify).toBeUndefined();
    expect(arnes.drawerProps?.classificationEditor).toBeUndefined();
  });
});
