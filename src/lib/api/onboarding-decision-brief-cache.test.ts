import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { cashDecisionBriefKey, invalidateCashDecisionBrief } from "./cash-decision-brief";
import { triggerOnboardingSyncMutationOptions } from "./onboarding-status";
import { invalidateDecisionBriefAfterOnboardingSync } from "./onboarding-sync-runs";
import { server } from "@/test/msw/node";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

const BASE = "http://api.test";

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function seedBrief(qc: QueryClient) {
  qc.setQueryData(cashDecisionBriefKey, {
    decision_id: "6cb9e47a-f682-46d6-9d8a-3c851c8ff420",
    context_hash: "ed0c2b7304923da062e78ac73c54352bd3925d5c4bbee006fe9ae9d43346d66f",
  });
}

afterEach(() => {
  server.resetHandlers();
});

describe("onboarding → Decision Brief", () => {
  it("la invalidación compartida refresca de inmediato el Brief visible", async () => {
    const qc = queryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue();

    await invalidateCashDecisionBrief(qc);

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: cashDecisionBriefKey,
      refetchType: "active",
    });
  });

  it("al terminar una importación no reutiliza un brief previo: invalida la misma clave compartida", async () => {
    const qc = queryClient();
    seedBrief(qc);
    server.use(
      http.post(`${BASE}/api/onboarding/sync`, () =>
        HttpResponse.json({
          sources: { sii: { status: "ok" }, bank: { status: "skipped" } },
        }),
      ),
    );

    const sync = new MutationObserver(qc, triggerOnboardingSyncMutationOptions(qc));
    await sync.mutate();

    await vi.waitFor(() => {
      expect(qc.getQueryState(cashDecisionBriefKey)?.isInvalidated).toBe(true);
    });
  });

  it("un run asíncrono terminado invalida ese mismo brief sin construir uno dentro del onboarding", () => {
    const qc = queryClient();
    seedBrief(qc);

    invalidateDecisionBriefAfterOnboardingSync(qc);

    expect(qc.getQueryState(cashDecisionBriefKey)?.isInvalidated).toBe(true);
  });
});
