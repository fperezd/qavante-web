import { describe, expect, it } from "vitest";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

describe("MSW cash projection runs", () => {
  it("crea H=14 y repite la misma intención sin otro run", async () => {
    const scope = {
      legal_entity_id: "11111111-1111-4111-8111-111111111111",
      currency: "CLP",
      as_of: "2026-09-08",
    };
    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "intent-payment-14" },
      body: JSON.stringify({ horizon_days: 14, ...scope }),
    };
    const first = await fetch(`${API}/api/treasury/cash-projection-runs`, init);
    const replay = await fetch(`${API}/api/treasury/cash-projection-runs`, init);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    const body = await replay.json();
    expect(body.horizon_days).toBe(14);
    expect(body.scenarios).toHaveLength(4);
    expect(body.calculation_version).toBe("cash-projection-run-v1");

    const conflict = await fetch(`${API}/api/treasury/cash-projection-runs`, {
      ...init,
      body: JSON.stringify({ horizon_days: 90, ...scope }),
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      detail: { code: "idempotency_key_reused" },
    });

    const missingHeader = await fetch(`${API}/api/treasury/cash-projection-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horizon_days: 14, ...scope }),
    });
    expect(missingHeader.status).toBe(422);

    expect(body.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenario_id: "scheduled_expected_v1",
          opening_cash: "10000000",
          inflows_total: "5000000",
          outflows_total: "12000000",
          ending_cash: "3000000",
          minimum_cash: "-1000000",
          gap_against_zero: "1000000",
        }),
        expect.objectContaining({
          scenario_id: "outflows_only_v1",
          ending_cash: "-2000000",
          minimum_cash: "-2000000",
          gap_against_zero: "2000000",
        }),
      ]),
    );
    const expected = body.scenarios.find(
      (item: { scenario_id: string }) => item.scenario_id === "scheduled_expected_v1",
    );
    expect(expected.series).toHaveLength(14);
    expect(expected.series[0].date).toBe("2026-09-09");
    expect(expected.series[3]).toMatchObject({
      date: "2026-09-12",
      closing_cash: "-1000000",
    });
    expect(expected.series[13]).toMatchObject({
      date: "2026-09-22",
      closing_cash: "3000000",
    });
    expect(
      expected.series.every(
        (point: { date: string }, index: number, all: Array<{ date: string }>) =>
          index === 0 ||
          Date.parse(point.date) - Date.parse(all[index - 1]!.date) === 24 * 60 * 60 * 1000,
      ),
    ).toBe(true);
    expect(expected.bridge.component_count).toBe(expected.bridge.components.length);

    const horizon90 = await fetch(`${API}/api/treasury/cash-projection-runs`, {
      ...init,
      headers: {
        ...init.headers,
        "Idempotency-Key": "intent-general-90-series",
      },
      body: JSON.stringify({ horizon_days: 90, ...scope }),
    });
    expect(horizon90.status).toBe(201);
    const body90 = await horizon90.json();
    expect(body90.scenarios[0].series).toHaveLength(90);
    expect(body90.scenarios[0].series.at(-1).date).toBe("2026-12-07");
  });

  it("liga Payment al mismo run y escenario; no acepta una referencia a medias", async () => {
    const run = "11111111-1111-4111-8111-111111111114";
    const scenario = "scheduled_expected_v1";
    const ok = await fetch(
      `${API}/api/treasury/decision-plans/payment?projection_run_id=${run}&scenario_id=${scenario}`,
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.projection_reference).toMatchObject({ run, scenario, horizon_days: 14 });

    const incomplete = await fetch(
      `${API}/api/treasury/decision-plans/payment?projection_run_id=${run}`,
    );
    expect(incomplete.status).toBe(422);

    const mismatch = await fetch(
      `${API}/api/treasury/decision-plans/payment?projection_run_id=99999999-9999-4999-8999-999999999999&scenario_id=${scenario}`,
    );
    expect(mismatch.status).toBe(404);

    const abstain = await fetch(
      `${API}/api/treasury/decision-plans/payment?projection_run_id=${run}&scenario_id=scheduled_with_recurring_income_v1`,
    );
    expect(abstain.status).toBe(200);
    expect(await abstain.json()).toMatchObject({
      state: "abstain",
      projection_reference: { coverage_valid_through: null },
    });
  });
});
