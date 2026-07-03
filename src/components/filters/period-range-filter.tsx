"use client";

import * as React from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import {
  formatRangeLabel,
  matchingPreset,
  presetRange,
  orderRange,
  type PeriodRange,
  type RangePreset,
} from "@/lib/period/period-range";

/* Filtro de rango de períodos (mes/rango/presets) — estilo Chipax. El trigger
   muestra el rango vigente ("feb-2026 a jul-2026"); el dropdown ofrece presets
   rápidos + fecha inicial/final (input month nativo) + Aplicar. Presentacional:
   recibe el rango y emite el nuevo al aplicar. Auto-carga: el caller arranca con
   un rango por defecto (no hay estado "sin consultar"). */

const PRESETS: ReadonlyArray<{ id: RangePreset; label: string }> = [
  { id: "ano_anterior", label: "Año anterior" },
  { id: "este_ano", label: "Este año" },
  { id: "seis_meses", label: "Seis meses" },
  { id: "tres_meses", label: "Tres meses" },
];

export interface PeriodRangeFilterProps {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
  /** Inyección de fecha para tests/presets. */
  now?: Date;
  /** Texto de ayuda opcional debajo del trigger. */
  hint?: React.ReactNode;
}

export function PeriodRangeFilter({ value, onChange, now, hint }: PeriodRangeFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<PeriodRange>(value);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activePreset = matchingPreset(value, now);

  function apply() {
    onChange(orderRange(draft));
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-neutral-dark hover:border-brand-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <CalendarRange className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
        {formatRangeLabel(value)}
        <ChevronDown className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
      </button>
      {hint && <p className="mt-1 text-xs text-neutral-mid">{hint}</p>}

      {open && (
        <div
          role="dialog"
          aria-label="Elegir rango de períodos"
          className="absolute left-0 z-30 mt-2 w-[320px] rounded-xl border border-border bg-surface p-3 shadow-xl"
        >
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map(({ id, label }) => {
              const active = activePreset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const r = presetRange(id, now);
                    setDraft(r);
                    onChange(r);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-brand-primary bg-brand-primary text-surface"
                      : "border-border text-neutral-dark hover:bg-surface-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Fecha inicial
              <input
                type="month"
                value={draft.desde}
                onChange={(e) => setDraft((d) => ({ ...d, desde: e.target.value || d.desde }))}
                className="block h-9 w-full rounded-md border border-border bg-surface px-2 text-sm font-normal normal-case text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Fecha final
              <input
                type="month"
                value={draft.hasta}
                onChange={(e) => setDraft((d) => ({ ...d, hasta: e.target.value || d.hasta }))}
                className="block h-9 w-full rounded-md border border-border bg-surface px-2 text-sm font-normal normal-case text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
            </label>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <QavanteButton size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </QavanteButton>
            <QavanteButton size="sm" onClick={apply}>
              Aplicar
            </QavanteButton>
          </div>
        </div>
      )}
    </div>
  );
}
