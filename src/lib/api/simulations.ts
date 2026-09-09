import { useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type { components } from "./types";

export type SimulationEvaluateRequest = components["schemas"]["SimulationEvaluateRequest"];
export type SimulationEvaluateResponse = components["schemas"]["SimulationEvaluateResponse"];

/** V14 sólo evalúa. El contrato garantiza que no persiste ni ejecuta acciones. */
export function useSimulationEvaluate() {
  return useMutation({
    mutationFn: (body: SimulationEvaluateRequest) =>
      api.post<SimulationEvaluateResponse>("/api/treasury/simulations/evaluate", { body }),
  });
}
