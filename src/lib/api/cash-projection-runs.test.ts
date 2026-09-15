import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";
import { ApiError } from "./errors";
import {
  cacheImmutableRun,
  cashProjectionRunKeys,
  createCashProjectionRun,
  scenarioFromRun,
  type CashProjectionRun,
} from "./cash-projection-runs";

const run = {
  projection_run_id: "11111111-1111-4111-8111-111111111111",
  input_digest: "a".repeat(64),
  cutoff_at: "2026-09-08T12:00:00Z",
  as_of: "2026-09-08",
  horizon_days: 14,
  currency: "CLP",
  calculation_version: "cash-projection-run-v1",
  scenarios: [
    { scenario_id: "scheduled_expected_v1", scenario_name: "scheduled_expected_v1" },
    { scenario_id: "outflows_only_v1", scenario_name: "outflows_only_v1" },
    {
      scenario_id: "scheduled_with_arrears_recovery_v1",
      scenario_name: "scheduled_with_arrears_recovery_v1",
    },
    {
      scenario_id: "scheduled_with_recurring_income_v1",
      scenario_name: "scheduled_with_recurring_income_v1",
    },
  ],
} as CashProjectionRun;

const scope = {
  legal_entity_id: "11111111-1111-4111-8111-111111111111",
  currency: "CLP",
  as_of: "2026-09-08",
};

describe("cash projection run cache", () => {
  afterEach(() => vi.restoreAllMocks());

  it("particiona el run por tenant+run_id y el escenario además por versión", () => {
    const client = new QueryClient();
    cacheImmutableRun(client, "tenant-a", run);
    expect(client.getQueryData(cashProjectionRunKeys.run("tenant-a", run.projection_run_id))).toBe(
      run,
    );
    expect(
      client.getQueryData(
        cashProjectionRunKeys.scenario(
          "tenant-a",
          run.projection_run_id,
          "scheduled_expected_v1",
          run.calculation_version,
        ),
      ),
    ).toBe(run.scenarios[0]);
    expect(
      client.getQueryData(cashProjectionRunKeys.run("tenant-b", run.projection_run_id)),
    ).toBeUndefined();
  });

  it("selecciona sólo escenarios que pertenecen al mismo run", () => {
    expect(scenarioFromRun(run, "outflows_only_v1")).toBe(run.scenarios[1]);
    expect(scenarioFromRun({ ...run, scenarios: [] }, "outflows_only_v1")).toBeNull();
  });

  it("conserva la clave tras respuesta perdida y la rota en el refresh post-éxito", async () => {
    const client = new QueryClient();
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new Error("respuesta perdida"))
      .mockResolvedValue(run);

    await expect(createCashProjectionRun(client, "tenant-a", 14, scope)).rejects.toThrow(
      "respuesta perdida",
    );
    await expect(createCashProjectionRun(client, "tenant-a", 14, scope)).resolves.toBe(run);
    await expect(createCashProjectionRun(client, "tenant-a", 14, scope)).resolves.toBe(run);

    const header = (call: number) =>
      (post.mock.calls[call]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    expect(header(0)).toBe(header(1));
    expect(header(2)).not.toBe(header(1));
  });

  it("rota la clave cuando recibe un 409 conocido", async () => {
    const client = new QueryClient();
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError("conflict", 409, "idempotency_conflict"))
      .mockResolvedValue(run);
    await expect(createCashProjectionRun(client, "tenant-a", 14, scope)).rejects.toMatchObject({
      status: 409,
    });
    await createCashProjectionRun(client, "tenant-a", 14, scope);
    const first = (post.mock.calls[0]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    const retry = (post.mock.calls[1]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    expect(retry).not.toBe(first);
  });

  it("envía la entidad, moneda y fecha resueltas por el servidor", async () => {
    const client = new QueryClient();
    const post = vi.spyOn(api, "post").mockResolvedValue(run);

    await createCashProjectionRun(client, "tenant-a", 14, scope);

    expect(post).toHaveBeenCalledWith(
      "/api/treasury/cash-projection-runs",
      expect.objectContaining({ body: { horizon_days: 14, ...scope } }),
    );
  });

  it("particiona la intención cuando cambia el alcance financiero", async () => {
    const client = new QueryClient();
    const post = vi.spyOn(api, "post").mockRejectedValue(new Error("respuesta perdida"));

    await expect(createCashProjectionRun(client, "tenant-a", 14, scope)).rejects.toThrow();
    await expect(
      createCashProjectionRun(client, "tenant-a", 14, {
        ...scope,
        as_of: "2026-09-09",
      }),
    ).rejects.toThrow();

    const first = (post.mock.calls[0]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    const second = (post.mock.calls[1]?.[1]?.headers as Record<string, string>)["Idempotency-Key"];
    expect(second).not.toBe(first);
  });
});
