"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useIndustryTemplates, useApplyIndustryTemplate } from "@/lib/api/industry-templates";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 5 — Elegir rubro. Selecciona una plantilla de industria; al continuar la
   aplica en modo `add_missing` (crea las vistas/dimensiones sugeridas, NUNCA
   destructivo §14.1). Reusa el data layer real de industry-templates. Opcional. */

const NEXT = routeAfter("industry");

export function IndustryView() {
  const router = useRouter();
  const list = useIndustryTemplates();
  const apply = useApplyIndustryTemplate();
  const [selected, setSelected] = React.useState<string | null>(null);

  const templates = list.data?.items ?? [];

  function handleContinue() {
    if (!selected) {
      router.push(NEXT);
      return;
    }
    apply.mutate(
      { templateCode: selected, body: { mode: "add_missing", overwrite_existing: false } },
      { onSuccess: () => router.push(NEXT) },
    );
  }

  return (
    <OnboardingShell
      step="industry"
      description="Elige tu rubro y dejamos lista una estructura de gestión sugerida. Puedes cambiarla después."
    >
      <div className="space-y-5">
        {list.isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-light/30" />
            ))}
          </div>
        )}

        {list.isError && <QavanteInlineError error={list.error} what="los rubros" />}

        {list.data && templates.length === 0 && (
          <QavanteEmpty
            title="No hay rubros disponibles"
            description="Puedes continuar y configurar tu estructura de gestión más tarde."
          />
        )}

        {templates.length > 0 && (
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Rubro"
          >
            {templates.map((t) => {
              const active = selected === t.code;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelected(active ? null : t.code)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
                      active
                        ? "border-brand-primary bg-brand-primary-50 shadow-sm"
                        : "border-border hover:border-brand-primary/50 hover:bg-surface-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-neutral-dark">{t.name}</span>
                      {t.description && (
                        <span className="mt-0.5 block text-sm text-neutral-mid">
                          {t.description}
                        </span>
                      )}
                    </span>
                    {active && (
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary text-surface">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {apply.isError && <QavanteInlineError error={apply.error} what="la aplicación del rubro" />}

        <OnboardingStepActions
          continueType="button"
          continueLabel={selected ? "Aplicar y continuar" : "Continuar"}
          continueLoading={apply.isPending}
          onContinue={handleContinue}
          onSkip={() => router.push(NEXT)}
        />
      </div>
    </OnboardingShell>
  );
}
