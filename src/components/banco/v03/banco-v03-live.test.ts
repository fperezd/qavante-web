import { describe, expect, it } from "vitest";
import { BANK_MOVEMENTS_LIMIT_MAX } from "@/lib/api/treasury";
import {
  alcanceDeLaCartola,
  initialBankSelection,
  LIMITE_MOVIMIENTOS,
  MESES_ALCANCE,
  unclassifyFeedback,
  movementFromResolution,
} from "./banco-v03-live";

/* El cableado de V03, fijado contra el CONTRATO.
 *
 * Antecedente medido (pase §6 del PR #85): `LIMITE_MOVIMIENTOS = 1000` se mandaba como `limit=1000`
 * y el backend acepta hasta 500 (`bank_movements_list.limit.maximum`, `Query(50, ge=1, le=500)`):
 * FastAPI respondía 422 y, con el flag ON, la sección de movimientos caía al estado de error en
 * todos los tenants. Ningún test lo fijaba. Este sí. */

describe("BancoV03Live — el limit que se pide al backend", () => {
  it("no supera el máximo del contrato (un limit mayor es 422 y tumba la sección entera)", () => {
    expect(LIMITE_MOVIMIENTOS).toBeLessThanOrEqual(BANK_MOVEMENTS_LIMIT_MAX);
    expect(LIMITE_MOVIMIENTOS).toBeGreaterThanOrEqual(1);
  });

  it("pide el máximo permitido: menos filas = más 'mostrando N de M' sin motivo", () => {
    expect(LIMITE_MOVIMIENTOS).toBe(BANK_MOVEMENTS_LIMIT_MAX);
  });

  it("la ventana es de 3 meses CALENDARIO, y el texto nombra esos meses (B17)", () => {
    expect(MESES_ALCANCE).toBe(3);
    // El 6 de octubre la ventana arranca el 1 de agosto. El texto lo dice.
    expect(alcanceDeLaCartola("2026-08", "2026-10")).toBe("agosto a octubre de 2026");
    expect(alcanceDeLaCartola("2025-12", "2026-02")).toBe("diciembre de 2025 a febrero de 2026");
  });

  it("MUTANTE (c): el texto no puede prometer 90 días corridos que la ventana no cubre", () => {
    // La promesa vieja era "los últimos 3 meses", que una persona lee como noventa días hacia
    // atrás. El 6 de octubre eso incluiría el 10 y el 17 de julio — justo los movimientos que
    // faltaban en la cuenta en dólares. La ventana nunca los cubrió: empieza el 1 de agosto.
    const texto = alcanceDeLaCartola("2026-08", "2026-10");
    expect(texto).not.toMatch(/últimos|90|noventa|días/i);
    // Y nombra los DOS extremos, para que el lector sepa dónde empieza y dónde termina.
    expect(texto).toContain("agosto");
    expect(texto).toContain("octubre");

    // El mutante al revés: si alguien cambia la ventana a 90 días corridos y deja este texto,
    // el texto pasa a mentir en la otra dirección (diría "agosto" cubriendo julio).
    const inicioDe90Dias = new Date(Date.UTC(2026, 9, 6) - 90 * 86_400_000);
    expect(inicioDe90Dias.getUTCMonth()).toBe(6); // julio
    expect(texto).not.toContain("julio");
  });

  it("no anuncia éxito cuando el backend informa que no desclasificó nada", () => {
    expect(unclassifyFeedback(false)).toEqual({
      kind: "error",
      message: "No había una clasificación vigente; el movimiento se volvió a cargar",
    });
    expect(unclassifyFeedback(true)).toEqual({
      kind: "success",
      message: "Clasificación eliminada",
    });
  });

  it("consume la cuenta y el movimiento del enlace documental para abrir el origen", () => {
    expect(
      initialBankSelection({ initialAccountId: "account-7", initialMovementId: "movement-9" }),
    ).toEqual({ accountId: "account-7", movementId: "movement-9" });
    expect(initialBankSelection({ initialAccountId: "", initialMovementId: "" })).toEqual({
      accountId: "",
      movementId: null,
    });
  });

  it("construye el movimiento del enlace aunque esté fuera de los últimos tres meses", () => {
    const response = {
      movement: {
        id: "movement-old",
        amount: "125000",
        direction: "debit",
        date: "2025-01-15",
        description: "Pago histórico",
        external_id: "ext-1",
        bank_account_id: "account-old",
        currency_code: "CLP",
        bank_account: { bank_name: "BICE", account_name: "Cuenta antigua" },
        /* Un movimiento de 2025: entró por una carga que no mira contraparte y no hubo relleno
           retroactivo. La procedencia lo dice; el enlace documental la arrastra tal cual. */
        counterparty_source: "not_captured",
      },
      reconciliation: {
        stored_status: "matched",
        effective_status: "matched",
        topology: "1:1",
        allocations: [],
        legacy_documents: [],
        components: [],
        evidence: [],
        history: [],
        remaining_amount: "0",
      },
      classification: {
        status: "unclassified",
        allocations: [],
        history: [],
      },
    } as Parameters<typeof movementFromResolution>[0];

    expect(movementFromResolution(response)).toMatchObject({
      id: "movement-old",
      bankAccountId: "account-old",
      monto: -125000,
      estadoConciliacion: "conciliado",
    });
  });
});
