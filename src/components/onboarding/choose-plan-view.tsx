"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { QavanteButton } from "@/components/qavante";
import {
  QAVANTE_ONBOARDING_PLANS,
  planIdFromQuery,
  planRequiresFintocCheckout,
  type QavantePlanId,
} from "@/lib/subscription/onboarding-plans";
import { startFintocSubscriptionCheckout } from "@/lib/subscription/create-fintoc-subscription-checkout";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";

const NEXT = routeAfter("choose-plan");

export function ChoosePlanView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onBack = useOnboardingBack("choose-plan");
  const fromQuery = planIdFromQuery(searchParams.get("plan"));
  const checkoutStatus = searchParams.get("checkout");
  const checkoutSucceeded = checkoutStatus === "success";

  const [selected, setSelected] = React.useState<QavantePlanId>(() => fromQuery ?? "starter");
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [activatingPlanId, setActivatingPlanId] = React.useState<QavantePlanId | null>(null);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (fromQuery) setSelected(fromQuery);
  }, [fromQuery]);

  const paidPlanSelected = planRequiresFintocCheckout(selected);

  function handleContinue() {
    router.push(NEXT);
  }

  async function handleActivatePlan(planId: QavantePlanId) {
    setSelected(planId);
    setCheckoutError(null);
    setCheckoutLoading(true);
    setActivatingPlanId(planId);
    try {
      const { redirect_url: redirectUrl } = await startFintocSubscriptionCheckout(planId);
      window.location.assign(redirectUrl);
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : "No pudimos abrir la activación del plan. Intenta de nuevo en un momento.",
      );
      setCheckoutLoading(false);
      setActivatingPlanId(null);
    }
  }

  const continueLabel = checkoutSucceeded
    ? "Continuar"
    : paidPlanSelected
      ? "Continuar sin activar aún"
      : "Continuar con Starter";

  return (
    <OnboardingShell
      step="choose-plan"
      description="Elige con qué plan quieres empezar. Puedes activar el cobro ahora o seguir configurando tu empresa y hacerlo más adelante."
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {checkoutSucceeded && (
          <div
            className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800"
            role="status"
          >
            <p className="font-medium">Plan listo</p>
            <p className="mt-0.5 text-success-800/90">
              Ya puedes seguir con la configuración de tu empresa.
            </p>
          </div>
        )}
        {checkoutStatus === "cancel" && (
          <div
            className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-neutral-dark"
            role="status"
          >
            <p className="font-medium">Quedó pendiente la activación</p>
            <p className="mt-0.5 text-neutral-mid">
              No pasa nada: puedes intentarlo otra vez o continuar y activarlo después.
            </p>
          </div>
        )}

        {checkoutError && (
          <div
            role="alert"
            className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
          >
            <p className="font-medium text-danger-700">No pudimos continuar</p>
            <p className="mt-1 text-neutral-mid">{checkoutError}</p>
          </div>
        )}

        <ul className="grid gap-4 sm:grid-cols-3" role="list">
          {QAVANTE_ONBOARDING_PLANS.map((plan) => {
            const isSelected = selected === plan.id;
            const isPaid = planRequiresFintocCheckout(plan.id);
            const isActivating = checkoutLoading && activatingPlanId === plan.id;

            return (
              <li key={plan.id} className="flex">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelected(plan.id);
                    setCheckoutError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(plan.id);
                      setCheckoutError(null);
                    }
                  }}
                  className={cn(
                    "relative flex h-full w-full cursor-pointer flex-col rounded-xl border p-4 text-left transition-colors",
                    isSelected
                      ? "border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/30"
                      : "border-border bg-surface hover:border-brand-primary/40",
                  )}
                  aria-pressed={isSelected}
                >
                  {plan.recommended && (
                    <span className="absolute -top-2.5 left-4 rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Recomendado
                    </span>
                  )}
                  <span className="font-display text-lg font-bold text-neutral-dark">
                    {plan.name}
                  </span>
                  <span className="mt-1 text-sm font-semibold text-brand-primary">
                    {plan.priceLabel}
                  </span>
                  {plan.priceNote && (
                    <span className="mt-0.5 text-xs text-neutral-mid">{plan.priceNote}</span>
                  )}
                  <span className="mt-3 text-sm text-neutral-mid">{plan.headline}</span>
                  <ul className="mt-3 flex-1 space-y-1 border-t border-border/60 pt-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-neutral-dark">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success-600"
                          aria-hidden
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div
                    className="mt-4 pt-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {isPaid ? (
                      <QavanteButton
                        type="button"
                        size="md"
                        className="w-full"
                        loading={isActivating}
                        disabled={checkoutLoading && !isActivating}
                        onClick={() => void handleActivatePlan(plan.id)}
                      >
                        Activar {plan.name}
                      </QavanteButton>
                    ) : (
                      isSelected && (
                        <span className="block text-center text-xs font-medium text-brand-primary">
                          Plan seleccionado
                        </span>
                      )
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <OnboardingStepActions
          onBack={onBack}
          onContinue={handleContinue}
          continueLabel={continueLabel}
          continueDisabled={checkoutLoading}
        />
      </div>
    </OnboardingShell>
  );
}
