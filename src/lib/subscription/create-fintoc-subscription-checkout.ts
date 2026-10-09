import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import type { QavantePlanId } from "./onboarding-plans";

export interface FintocSubscriptionCheckoutResponse {
  checkout_session_id: string;
  redirect_url: string;
  mode: string;
}

export async function startFintocSubscriptionCheckout(
  planId: QavantePlanId,
): Promise<FintocSubscriptionCheckoutResponse> {
  const origin = window.location.origin;
  try {
    return await api.post<FintocSubscriptionCheckoutResponse>("/api/fintoc/subscription-checkout", {
      body: {
        plan_id: planId,
        success_url: `${origin}/onboarding/plan?checkout=success&plan=${planId}`,
        cancel_url: `${origin}/onboarding/plan?checkout=cancel&plan=${planId}`,
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(apiErrorToUserMessage(err));
    }
    throw err;
  }
}
