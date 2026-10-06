import { describe, expect, it } from "vitest";
import type {
  PayrollWorkerOutstanding,
  PayrollWorkerOutstandingWorker,
} from "@/lib/api/payroll-evidence";
import {
  abstentionCopy,
  evidenceRutKey,
  evidenceWorkerRows,
  evidenceWorkerTally,
  legacyQualityCopy,
  workerStateCopy,
} from "./payroll-evidence-model";

/* #203: separar pago observado, lote confirmado y asignación por trabajador.

   Cada test del comportamiento viene con su gemelo: el que probaría lo contrario. Lo que estos
   tests NO dejan pasar es que la pantalla afirme por su cuenta que alguien está pagado. El
   estado lo dice el backend; el modelo no lo deriva de comparar montos. */

const BASE: PayrollWorkerOutstanding = {
  period: "202608",
  currency_code: "CLP",
  snapshot_id: "3f2f8a1e-1111-4222-8333-444455556666",
  obligation_observed_at: "2026-09-01T12:00:00Z",
  obligation_amount: "13953387.0000",
  batch_allocated_amount: "13113627.0000",
  worker_allocated_amount: "13113627.0000",
  distribution_gap_amount: "0.0000",
  superseded_obligation_allocated_amount: "0.0000",
  confirmed_outstanding_amount: "839760.0000",
  legacy_payable_outstanding_amount: "3000010.00",
  legacy_worker_outstanding_amount: "839760.00",
  legacy_divergence_amount: "2160250.00",
  legacy_assumed_paid_amount: "0.00",
  legacy_outstanding_quality: "legacy_unverified",
  workers: [],
  abstention_reasons: [],
};

function worker(over: Partial<PayrollWorkerOutstandingWorker>): PayrollWorkerOutstandingWorker {
  return {
    worker_rut: "10.341.986-7",
    worker_name: "Trabajador A",
    obligation_amount: "1000000.0000",
    confirmed_paid_amount: "0.0000",
    outstanding_amount: "1000000.0000",
    line_count: 1,
    currency_code: "CLP",
    state: "unallocated",
    ...over,
  };
}

describe("estado por trabajador · lo dice el backend, no lo deriva la pantalla", () => {
  it("traduce los tres estados que el backend nombra", () => {
    expect(workerStateCopy("confirmed_paid").tone).toBe("confirmed");
    expect(workerStateCopy("partially_confirmed").tone).toBe("partial");
    expect(workerStateCopy("unallocated").tone).toBe("neutral");
  });

  it("un estado que el backend agregue y la pantalla no conozca NO se pinta como pagado", () => {
    // El gemelo. Si un código desconocido cayera al tono `confirmed`, un estado nuevo del
    // backend pondría a alguien en verde sin que nadie lo decidiera.
    const copy = workerStateCopy("algo_que_todavia_no_existe");
    expect(copy.tone).toBe("neutral");
    expect(copy.tone).not.toBe("confirmed");
  });

  it("un monto confirmado igual a la obligación NO alcanza para ponerlo en verde", () => {
    // El gemelo que protege la regla central de #203: no inferir persona desde monto. El
    // backend dice `unallocated` aunque las cifras calcen; el modelo le hace caso.
    const rows = evidenceWorkerRows({
      ...BASE,
      workers: [
        worker({
          confirmed_paid_amount: "1000000.0000",
          outstanding_amount: "0.0000",
          state: "unallocated",
        }),
      ],
    });
    expect(rows[0]?.state.tone).toBe("neutral");
    expect(rows[0]?.state.label).toBe("Sin pago repartido a su nombre");
  });
});

describe("filas por trabajador", () => {
  it("ordena primero lo que falta y deja al final las líneas sin RUT", () => {
    const rows = evidenceWorkerRows({
      ...BASE,
      workers: [
        worker({ worker_rut: "14.632.789-3", worker_name: "Confirmada", state: "confirmed_paid" }),
        worker({ worker_rut: null, worker_name: null, state: "unallocated" }),
        worker({ worker_rut: "10.341.986-7", worker_name: "Pendiente", state: "unallocated" }),
        worker({
          worker_rut: "11.111.111-1",
          worker_name: "Parcial",
          state: "partially_confirmed",
        }),
      ],
    });
    expect(rows.map((r) => r.workerName)).toEqual([
      "Pendiente",
      "Parcial",
      "Confirmada",
      null, // la línea sin RUT, al final
    ]);
  });

  it("no toca los montos: los pasa tal como los publicó el backend", () => {
    // El dinero no se recalcula en el cliente ni pasa por `number`. El string exacto del
    // contrato llega intacto al formateador.
    const rows = evidenceWorkerRows({
      ...BASE,
      workers: [worker({ obligation_amount: "5630113.0000", outstanding_amount: "5280113.0000" })],
    });
    expect(rows[0]?.obligationAmount).toBe("5630113.0000");
    expect(rows[0]?.outstandingAmount).toBe("5280113.0000");
  });

  it("una fila sin RUT igual tiene clave estable, y dos no colisionan", () => {
    const rows = evidenceWorkerRows({
      ...BASE,
      workers: [
        worker({ worker_rut: null, worker_name: null }),
        worker({ worker_rut: null, worker_name: null }),
      ],
    });
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it("sin respuesta devuelve cero filas en vez de reventar", () => {
    expect(evidenceWorkerRows(undefined)).toEqual([]);
    expect(evidenceWorkerRows(null)).toEqual([]);
  });
});

describe("conteo por estado", () => {
  it("cuenta sobre el `state` del backend", () => {
    const tally = evidenceWorkerTally({
      ...BASE,
      workers: [
        worker({ worker_rut: "1-9", state: "confirmed_paid" }),
        worker({ worker_rut: "2-7", state: "partially_confirmed" }),
        worker({ worker_rut: "3-5", state: "unallocated" }),
        worker({ worker_rut: null, state: "unallocated" }),
      ],
    });
    expect(tally).toEqual({ total: 4, confirmed: 1, partial: 1, unallocated: 2, withoutRut: 1 });
  });

  it("un lote asignado y no repartido no confirma a nadie", () => {
    // El gemelo del caso que api#422 prohíbe producir: el período tiene pago asignado y
    // `distribution_gap_amount` distinto de cero, y ninguna persona queda confirmada.
    const data: PayrollWorkerOutstanding = {
      ...BASE,
      batch_allocated_amount: "13113627.0000",
      worker_allocated_amount: "0.0000",
      distribution_gap_amount: "13113627.0000",
      workers: [worker({ state: "unallocated" })],
      abstention_reasons: ["batch_not_distributed_per_worker"],
    };
    expect(evidenceWorkerTally(data).confirmed).toBe(0);
    expect(abstentionCopy(data.abstention_reasons?.[0] ?? "")).toContain(
      "todavía no está repartido persona por persona",
    );
  });
});

describe("copy de abstenciones y de la calidad legada", () => {
  it("traduce los códigos que el backend publica hoy", () => {
    expect(abstentionCopy("obligation_snapshot_missing")).toContain("obligación sellada");
    expect(abstentionCopy("payment_evidence_missing")).toContain("Ningún pago confirmado");
    expect(abstentionCopy("payment_payroll_portion_unreadable")).toContain("más que nómina");
  });

  it("un código desconocido se NOMBRA en vez de desaparecer", () => {
    // El gemelo. Una abstención que el backend agregue y la pantalla no conozca no puede
    // quedarse muda: callarla convertiría una advertencia en silencio.
    const texto = abstentionCopy("una_abstencion_nueva");
    expect(texto).toContain("una_abstencion_nueva");
    expect(texto.length).toBeGreaterThan("una_abstencion_nueva".length);
  });

  it("distingue un pago legado respaldado de uno asumido", () => {
    expect(legacyQualityCopy("legacy_bank_evidenced")).toContain("movimiento bancario");
    expect(legacyQualityCopy("assumed_paid_no_bank_evidence")).toContain("sin un solo enlace");
    expect(legacyQualityCopy(null)).toBeNull();
  });
});

describe("clave de RUT", () => {
  it("compara por dígitos, no por el formato del origen", () => {
    expect(evidenceRutKey("10.341.986-7")).toBe(evidenceRutKey("103419867"));
    expect(evidenceRutKey("12.345.678-k")).toBe(evidenceRutKey("12345678-K"));
  });

  it("dos RUT distintos no colapsan en la misma clave", () => {
    expect(evidenceRutKey("10.341.986-7")).not.toBe(evidenceRutKey("14.632.789-3"));
  });
});

describe("la copia nunca usa palabras que el producto prohíbe", () => {
  it("ninguna frase dice 'no disponible', 'sin dato', 'preliminar' ni 'estimado'", () => {
    const frases = [
      ...["confirmed_paid", "partially_confirmed", "unallocated", "otro"].flatMap((s) => [
        workerStateCopy(s).label,
        workerStateCopy(s).detail,
      ]),
      ...[
        "obligation_snapshot_missing",
        "obligation_snapshot_conflict",
        "obligation_coverage_incomplete",
        "obligation_lines_without_worker",
        "payment_evidence_missing",
        "batch_not_distributed_per_worker",
        "payment_evidence_on_superseded_obligation",
        "payment_payroll_portion_unreadable",
        "legacy_payable_settled_without_worker_evidence",
        "legacy_worker_paid_without_any_link",
        "legacy_payable_ambiguous",
        "payment_currency_conflict",
        "payment_currency_missing",
      ].map(abstentionCopy),
      ...[
        "legacy_bank_evidenced",
        "legacy_manual_adjustment",
        "assumed_paid_no_bank_evidence",
        "legacy_absent",
      ].map((q) => legacyQualityCopy(q) ?? ""),
    ];
    const prohibidas = [
      "no disponible",
      "sin dato",
      "preliminar",
      "estimado",
      "no evaluable",
      "confianza",
    ];
    for (const frase of frases) {
      for (const palabra of prohibidas) {
        expect(frase.toLowerCase()).not.toContain(palabra);
      }
    }
  });
});
