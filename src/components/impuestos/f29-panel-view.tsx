"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { QavanteCard, QavanteInlineError } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { useSiiF29EstadoMulti, type F29EstadoMes, type F29EstadoMesEstado } from "@/lib/api/sii";
import { F29MonthDetail } from "./f29-month-detail";

/* Panel F29 (handoff CC-API 2026-07-05) — grilla estilo "Consulta Estado F29"
   del SII: meses en filas, años en columnas, semáforo por celda. Al clickear un
   mes con período, abre el detalle (con/sin IVA). Datos: `GET /f29/estado?anio=`
   por cada año (acepta cookie). */

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Cantidad de años hacia atrás (además del actual) en la grilla. */
const YEARS_BACK = 5;

const ESTADO_LABEL: Record<F29EstadoMesEstado, string> = {
  declarado: "Declarado",
  sin_dato: "Sin dato (sincronizá)",
  no_declarado_vencido: "No declarado (vencido)",
  por_declarar: "Por declarar",
  en_curso: "En curso",
  sin_periodo: "Sin período",
};

interface SelectedCell {
  anio: number;
  mes: number;
}

export function F29PanelView({ now = new Date() }: { now?: Date }) {
  const currentYear = now.getFullYear();
  const years = React.useMemo(
    () => Array.from({ length: YEARS_BACK + 1 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const results = useSiiF29EstadoMulti(years);
  const [selected, setSelected] = React.useState<SelectedCell | null>(null);

  /* year → (mes → F29EstadoMes). El contrato tipa `meses[]` laxo; lo afinamos. */
  const byYear = React.useMemo(() => {
    const map = new Map<number, Map<number, F29EstadoMes>>();
    years.forEach((anio, i) => {
      const meses = (results[i]?.data?.meses ?? []) as unknown as F29EstadoMes[];
      const inner = new Map<number, F29EstadoMes>();
      for (const m of meses) if (typeof m?.mes === "number") inner.set(m.mes, m);
      map.set(anio, inner);
    });
    return map;
  }, [results, years]);

  const anyLoading = results.some((r) => r.isLoading);
  const allError = results.length > 0 && results.every((r) => r.isError);
  const firstError = results.find((r) => r.isError)?.error;

  if (allError) {
    return <QavanteInlineError error={firstError} what="el estado del F29" />;
  }

  return (
    <div className="space-y-4">
      <QavanteCard variant="bordered" aria-label="Estado del F29 por período" role="region">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
                >
                  Mes
                </th>
                {years.map((y) => (
                  <th
                    key={y}
                    scope="col"
                    className="px-2 py-2 text-center text-xs font-semibold text-neutral-dark tabular-nums"
                  >
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MESES.map((label, idx) => {
                const mes = idx + 1;
                return (
                  <tr key={mes} className="border-t border-border/60">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left text-sm font-medium text-neutral-dark"
                    >
                      {label}
                    </th>
                    {years.map((y) => {
                      const cell = byYear.get(y)?.get(mes);
                      const loading = anyLoading && !cell;
                      const isSelected = selected?.anio === y && selected?.mes === mes;
                      return (
                        <td key={y} className="px-2 py-1.5 text-center">
                          <StatusCell
                            cell={cell}
                            loading={loading}
                            selected={isSelected}
                            onSelect={() => setSelected({ anio: y, mes })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Legend />
      </QavanteCard>

      {selected && (
        <F29MonthDetail
          key={`${selected.anio}-${selected.mes}`}
          anio={selected.anio}
          mes={selected.mes}
          mesLabel={MESES[selected.mes - 1] ?? String(selected.mes)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ── Celda de estado (semáforo) ─────────────────────────────────────────── */

function StatusCell({
  cell,
  loading,
  selected,
  onSelect,
}: {
  cell?: F29EstadoMes;
  loading: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  if (loading) {
    return <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-neutral-light/60" />;
  }

  const estado = cell?.estado ?? "sin_periodo";
  // Sin período (futuro / sin declaración esperada): no clickeable.
  if (!cell || estado === "sin_periodo") {
    return (
      <span className="text-neutral-light" aria-label="Sin período">
        –
      </span>
    );
  }
  /* Sin dato: vencido pero sin F29 sincronizado. NO es "no declaró" — no lo
     pintamos rojo. Marca neutra (círculo hueco), no clickeable: sincronizá. */
  if (estado === "sin_dato") {
    return (
      <span
        className="inline-block h-3 w-3 rounded-full border border-neutral-mid/50"
        title="Sin dato — sincronizá tus F29 para ver el estado real"
        aria-label="Sin dato, sincronizá"
      />
    );
  }

  const ringSel = selected ? "ring-2 ring-brand-primary ring-offset-1" : "";
  const title = `${ESTADO_LABEL[estado]}${cell.folio ? ` · folio ${cell.folio}` : ""}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={title}
      aria-label={`${ESTADO_LABEL[estado]} — ver detalle`}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        ringSel,
      )}
    >
      {estado === "declarado" && (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-surface">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
      {estado === "no_declarado_vencido" && (
        <span className="text-[11px] font-bold text-danger-500">ND</span>
      )}
      {estado === "por_declarar" && (
        <span className="inline-block h-3 w-3 rounded-full bg-warning-500" aria-hidden="true" />
      )}
      {estado === "en_curso" && <span className="text-xs text-neutral-mid">•••</span>}
    </button>
  );
}

/* ── Leyenda ────────────────────────────────────────────────────────────── */

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-neutral-mid">
      <LegendItem>
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-500 text-surface">
          <Check className="h-2.5 w-2.5" />
        </span>
        Declarado
      </LegendItem>
      <LegendItem>
        <span className="inline-block h-3 w-3 rounded-full border border-neutral-mid/50" />
        Sin dato (sincronizá)
      </LegendItem>
      <LegendItem>
        <span className="text-[11px] font-bold text-danger-500">ND</span>
        No declarado (vencido)
      </LegendItem>
      <LegendItem>
        <span className="inline-block h-3 w-3 rounded-full bg-warning-500" />
        Por declarar
      </LegendItem>
      <LegendItem>
        <span className="text-neutral-mid">•••</span>
        En curso
      </LegendItem>
      <LegendItem>
        <span className="text-neutral-light">–</span>
        Sin período
      </LegendItem>
    </div>
  );
}

function LegendItem({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}
