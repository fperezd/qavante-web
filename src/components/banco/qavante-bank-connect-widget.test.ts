import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { LegalEntity } from "@/lib/api/legal-entities";
import { companiesForHolder, notifyFintocCompletion } from "./qavante-bank-connect-widget";

afterEach(() => {
  vi.restoreAllMocks();
});

function company(id: string, legalName: string, rut: string): LegalEntity {
  return {
    id,
    legal_name: legalName,
    is_default: false,
    identifiers: [
      {
        id: `${id}-rut`,
        jurisdiction_code: "CL",
        identifier_scheme: "rut",
        normalized_value: rut,
        label: "RUT",
        assertion_quality: "manual",
        evidence_ref: null,
        valid_from: "2026-01-01T00:00:00Z",
      },
    ],
  };
}

describe("companiesForHolder", () => {
  it("reconoce el mismo RUT aunque FinToc lo devuelva con puntos", () => {
    const matching = company("bice", "Tooxs Digital SpA", "76828485-7");
    const other = company("other", "Otra sociedad", "76454786-1");

    expect(companiesForHolder([matching, other], "76.828.485-7")).toEqual([matching]);
  });
});

describe("notifyFintocCompletion", () => {
  it("mantiene visible la notificación sin botón ni recarga automática", () => {
    const success = vi.spyOn(toast, "success").mockImplementation(() => "fintoc-toast");

    notifyFintocCompletion({ status: "ok", accounts: 1, imported: 300, per_account: [] });

    expect(success).toHaveBeenCalledOnce();
    const options = success.mock.calls[0]?.[1];
    expect(options?.duration).toBe(Infinity);
    expect(options?.action).toBeUndefined();
  });

  it("espera el clic antes de continuar en onboarding", () => {
    const onConnected = vi.fn();
    const warning = vi.spyOn(toast, "warning").mockImplementation(() => "fintoc-toast");

    notifyFintocCompletion(
      {
        status: "partial",
        accounts: 0,
        imported: 0,
        per_account: [{ sync_error: { message: "No se pudieron importar cuentas" } }],
      },
      onConnected,
    );

    expect(onConnected).not.toHaveBeenCalled();
    const options = warning.mock.calls[0]?.[1];
    expect(options?.duration).toBe(Infinity);
    expect(options?.description).toBe("No se pudieron importar cuentas");
    const action = options?.action as { label: string; onClick: () => void };
    expect(action.label).toBe("Continuar");
    action.onClick();
    expect(onConnected).toHaveBeenCalledOnce();
  });
});
