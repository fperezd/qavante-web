/* Sanity del contrato de la fecha de inicio declarada, vía MSW, y estabilidad de la query key.
 *
 * Esta prueba existe por una razón concreta: los tipos de `onboarding-activity-start.ts` están
 * transcritos a mano (el snapshot que este repo versiona todavía no trae el contrato), así que
 * un error de RUTA o de nombre de campo no lo caza el compilador. Acá se ejercita el camino
 * completo contra el mock: la ruta exacta, la forma de la respuesta y el efecto de declarar. */
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_START_PATH,
  activityStartKeys,
  contractShapeOf,
  type OnboardingActivityStartResponse,
} from "./onboarding-activity-start";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const RUTA = `${API}${ACTIVITY_START_PATH}`;

describe("activityStartKeys", () => {
  it("namespacing estable", () => {
    expect(activityStartKeys.census).toEqual(["onboarding", "activity-start"]);
  });
});

describe("MSW — GET /api/onboarding/activity-start", () => {
  it("la ruta responde y trae los siete campos del censo", async () => {
    const r = await fetch(RUTA);
    expect(r.status).toBe(200);
    const body = (await r.json()) as OnboardingActivityStartResponse;
    expect(Object.keys(body).sort()).toEqual([...contractShapeOf.response].sort());
    expect(Object.keys(body.entities[0]!).sort()).toEqual([...contractShapeOf.entity].sort());
    expect(Object.keys(body.unattributed_history).sort()).toEqual(
      [...contractShapeOf.unattributed].sort(),
    );
    expect(Object.keys(body.live_debt_protected).sort()).toEqual(
      [...contractShapeOf.liveDebt].sort(),
    );
    expect(Object.keys(body.opening_cutoff_overlap).sort()).toEqual(
      [...contractShapeOf.overlap].sort(),
    );
  });

  it("los montos llegan como string decimal, nunca como number", async () => {
    const body = (await (await fetch(RUTA)).json()) as OnboardingActivityStartResponse;
    expect(typeof body.unattributed_history.amount).toBe("string");
    expect(typeof body.live_debt_protected.payables_amount).toBe("string");
    expect(typeof body.unattributed_history.documents).toBe("number");
  });

  it("la procedencia es uno de los tres valores del contrato", async () => {
    const body = (await (await fetch(RUTA)).json()) as OnboardingActivityStartResponse;
    for (const e of body.entities) {
      expect(contractShapeOf.provenances).toContain(e.provenance);
    }
  });
});

describe("MSW — PUT /api/onboarding/activity-start", () => {
  it("declarar mueve la procedencia a la declaración y baja lo que falta", async () => {
    const antes = (await (await fetch(RUTA)).json()) as OnboardingActivityStartResponse;
    const objetivo = antes.entities.find((e) => !e.declared)!;
    const faltabanAntes = antes.undeclared_count;

    const r = await fetch(RUTA, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal_entity_id: objetivo.legal_entity_id,
        start_date: "2017-01-01",
      }),
    });
    expect(r.status).toBe(200);
    const despues = (await r.json()) as OnboardingActivityStartResponse;

    const declarada = despues.entities.find((e) => e.legal_entity_id === objetivo.legal_entity_id)!;
    expect(declarada.declared).toBe(true);
    expect(declarada.provenance).toBe("declared_by_company");
    expect(declarada.effective_from).toBe("2017-01-01");
    /* Una fecha de 2017 se acepta: la declaración no tiene el tope de seis meses que SÍ tiene
       la ventana de importación. Son dos cosas distintas. */
    expect(despues.undeclared_count).toBe(faltabanAntes - 1);
    expect(despues.declared_count).toBe(antes.declared_count + 1);
  });

  it("el 1970-01-01 se rechaza con 422: es el valor por omisión, no una declaración", async () => {
    const censo = (await (await fetch(RUTA)).json()) as OnboardingActivityStartResponse;
    const r = await fetch(RUTA, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal_entity_id: censo.entities[0]!.legal_entity_id,
        start_date: "1970-01-01",
      }),
    });
    expect(r.status).toBe(422);
    const body = (await r.json()) as { code: string };
    expect(body.code).toBe("invalid_activity_start_date");
  });

  it("una sociedad de otra empresa responde 404", async () => {
    const r = await fetch(RUTA, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal_entity_id: "00000000-0000-0000-0000-00000000dead",
        start_date: "2020-05-01",
      }),
    });
    expect(r.status).toBe(404);
    const body = (await r.json()) as { code: string };
    expect(body.code).toBe("legal_entity_not_found");
  });
});
