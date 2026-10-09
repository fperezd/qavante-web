"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useIndustryTemplates, useApplyIndustryTemplate } from "@/lib/api/industry-templates";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";
import { buildIndustryTemplateGroups } from "./industry-template-ui";

/* Paso 5 — Elegir rubro. Selecciona una plantilla de industria; al continuar la
   aplica en modo `add_missing` (crea las vistas/dimensiones sugeridas, NUNCA
   destructivo §14.1). Reusa el data layer real de industry-templates. Opcional. */

const NEXT = routeAfter("industry");

export function IndustryView() {
  const router = useRouter();
  const onBack = useOnboardingBack("industry");
  const list = useIndustryTemplates();
  const apply = useApplyIndustryTemplate();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const templates = list.data?.items ?? [];
  const groups = React.useMemo(
    () => buildIndustryTemplateGroups(templates, search),
    [templates, search],
  );
  const visibleCount = groups.reduce((n, g) => n + g.items.length, 0);

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
      <div className="mx-auto w-full max-w-2xl space-y-5">
        {list.isLoading && (
          <div className="space-y-4" aria-hidden="true">
            <div className="h-10 animate-pulse rounded-lg bg-neutral-light/30" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-neutral-light/30" />
                <div className="h-14 animate-pulse rounded-xl bg-neutral-light/30" />
              </div>
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
          <>
            <label className="relative block">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-mid"
                aria-hidden="true"
              />
              <span className="sr-only">Buscar rubro</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o tipo de negocio…"
                className="h-10 w-full rounded-lg border border-border-strong bg-surface py-2 pr-3 pl-9 text-sm text-neutral-dark placeholder:text-neutral-mid focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
              />
            </label>

            {visibleCount === 0 ? (
              <p className="text-sm text-neutral-mid" role="status">
                Ningún rubro coincide con «{search.trim()}». Prueba otra palabra o{" "}
                <button
                  type="button"
                  className="font-medium text-brand-primary hover:underline"
                  onClick={() => setSearch("")}
                >
                  ver todos
                </button>
                .
              </p>
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <section key={group.family} aria-labelledby={`rubro-group-${group.family}`}>
                    <h2
                      id={`rubro-group-${group.family}`}
                      className="text-xs font-semibold uppercase tracking-wider text-neutral-mid"
                    >
                      {group.label}
                    </h2>
                    <ul
                      className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label={group.label}
                    >
                      {group.items.map((t) => {
                        const active = selected === t.code;
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setSelected(active ? null : t.code)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
                                active
                                  ? "border-brand-primary bg-brand-primary-50 shadow-sm"
                                  : "border-border bg-surface hover:border-brand-primary/40 hover:bg-surface-muted",
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-neutral-dark">
                                  {t.name}
                                </span>
                                {t.description && (
                                  <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-mid">
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
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {apply.isError && <QavanteInlineError error={apply.error} what="la aplicación del rubro" />}

        <OnboardingStepActions
          continueType="button"
          continueLabel={selected ? "Aplicar y continuar" : "Continuar"}
          continueLoading={apply.isPending}
          onContinue={handleContinue}
          onSkip={() => router.push(NEXT)}
          onBack={onBack}
        />
      </div>
    </OnboardingShell>
  );
}
