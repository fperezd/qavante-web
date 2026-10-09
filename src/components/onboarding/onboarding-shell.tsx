"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/formatters/pct";
import {
  ONBOARDING_STEP_GROUPS,
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_GROUPS,
  groupForStep,
  groupNumber,
  groupStatus,
  progressPct,
  stepById,
  stepIndex,
  stepNumber,
  type OnboardingStepGroup,
  type OnboardingStepId,
} from "./onboarding-steps";

export interface OnboardingShellProps {
  step?: OnboardingStepId;
  children: React.ReactNode;
  description?: React.ReactNode;
  title?: string;
}

function GroupSubSteps({
  group,
  activeStep,
  activeIndex,
}: {
  group: OnboardingStepGroup;
  activeStep: OnboardingStepId;
  activeIndex: number;
}) {
  return (
    <ul className="mt-1.5 space-y-0.5 border-t border-border/30 pt-1.5">
      {group.steps.map((stepId) => {
        const sub = stepById(stepId);
        if (!sub) return null;
        const subIndex = stepIndex(stepId);
        const subDone = subIndex < activeIndex;
        const subActive = stepId === activeStep;
        return (
          <li
            key={stepId}
            className={cn(
              "flex items-start gap-1 text-[9px] leading-[1.25] sm:text-[10px]",
              subActive
                ? "font-semibold text-brand-primary"
                : subDone
                  ? "text-neutral-dark"
                  : "text-neutral-mid/90",
            )}
            aria-current={subActive ? "step" : undefined}
            title={sub.label}
          >
            <span className="mt-px w-2.5 flex-shrink-0 text-center" aria-hidden="true">
              {subDone ? (
                <Check className="mx-auto h-2 w-2 text-success-600" />
              ) : subActive ? (
                <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-brand-primary" />
              ) : (
                <span className="mx-auto block h-1 w-1 rounded-full bg-neutral-mid/50" />
              )}
            </span>
            <span className="min-w-0 line-clamp-2">{sub.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function OnboardingShell({ step, children, description, title }: OnboardingShellProps) {
  const current = step ? ONBOARDING_STEPS.find((s) => s.id === step) : undefined;
  const activeIndex = step ? stepIndex(step) : -1;
  const pct = step ? progressPct(step) : 0;
  const activeGroupN = step ? groupNumber(step) : 0;
  const showProgress = step ? groupForStep(step) != null : false;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-8 sm:max-w-3xl sm:py-12">
      {step && showProgress && (
        <div className="space-y-2.5">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-mid">
              Etapa {activeGroupN} de {TOTAL_ONBOARDING_GROUPS}
              <span className="hidden font-normal normal-case sm:inline">
                {" "}
                · Paso {stepNumber(step)}/{ONBOARDING_STEPS.length}
              </span>
            </span>
            <span className="text-[10px] font-semibold text-brand-primary">{current?.label}</span>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-light/40"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso del onboarding: ${formatPct(pct)}`}
          >
            <div
              className="bg-gradient-brand h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <ol
            className="grid grid-cols-2 items-start gap-1.5 pt-0.5 sm:grid-cols-4 sm:gap-2"
            aria-label="Etapas del onboarding"
          >
            {ONBOARDING_STEP_GROUPS.map((group, i) => {
              const status = groupStatus(group, activeIndex);
              const done = status === "done";
              const active = status === "active";

              return (
                <li
                  key={group.id}
                  className={cn(
                    "flex min-w-0 flex-col rounded-md border px-1.5 py-1.5 sm:px-2",
                    active
                      ? "border-brand-primary/35 bg-brand-primary/[0.03]"
                      : "border-border/50 bg-surface/40",
                    done && !active && "border-border/40",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5",
                      active
                        ? "font-semibold text-brand-primary"
                        : done
                          ? "text-neutral-dark"
                          : "text-neutral-mid",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px]",
                        done
                          ? "bg-success-500 text-surface"
                          : active
                            ? "bg-brand-primary text-surface"
                            : "bg-neutral-light/70 text-neutral-mid",
                      )}
                      aria-hidden="true"
                    >
                      {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                    </span>
                    <span className="truncate text-[10px] leading-tight sm:text-[11px]">
                      {group.label}
                    </span>
                  </div>
                  <GroupSubSteps group={group} activeStep={step} activeIndex={activeIndex} />
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className={cn("flex flex-1 flex-col items-center", step && "mt-6")}>
        <div className="w-full max-w-md text-left">
          <h1 className="text-2xl font-bold text-neutral-dark">{current?.title ?? title}</h1>
          {description && <p className="mt-1 text-sm text-neutral-mid">{description}</p>}
        </div>
        <div className="mt-6 flex w-full flex-1 flex-col items-center">{children}</div>
      </div>
    </div>
  );
}
