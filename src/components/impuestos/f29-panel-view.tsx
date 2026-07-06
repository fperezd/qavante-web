"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, RefreshCw } from "lucide-react";
import { QavanteCard, QavanteButton, QavanteInlineError } from "@/components/qavante";
import { cn } from "@/lib/utils";
import {
  useSiiF29EstadoMulti,
  useSyncF29,
  useSiiContribuyente,
  siiKeys,
  type F29EstadoMes,
  type F29EstadoMesEstado,
} from "@/lib/api/sii";
import { useMe } from "@/lib/api/users";
import { normalizeRut } from "@/lib/validators/rut";
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

/** Años hacia atrás (además del actual) cuando no hay inicio de actividades. */
const YEARS_BACK = 5;
/** Tope de columnas para no dibujar una grilla enorme (empresas muy antiguas). */
const MAX_YEARS = 10;

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

  /* Acotar la grilla por inicio de actividades (CC-API #2): company_rut → SII
     `/contribuyente` → `inicio_actividades`. Sin ese dato usamos el fallback de
     `YEARS_BACK` años. Cap de MAX_YEARS para no dibujar una grilla enorme si la
     empresa es muy antigua. */
  const me = useMe();
  const companyRut = me.data?.user.company_rut ?? "";
  const contribuyente = useSiiContribuyente(
    companyRut ? normalizeRut(companyRut) : "",
    Boolean(companyRut),
  );
  const startYear = React.useMemo(() => {
    const iso = contribuyente.data?.status === "ok" ? contribuyente.data.inicio_actividades : null;
    const y = iso ? Number(String(iso).slice(0, 4)) : NaN;
    const fromInicio =
      Number.isInteger(y) && y >= 2000 && y <= currentYear ? y : currentYear - YEARS_BACK;
    return Math.max(fromInicio, currentYear - MAX_YEARS + 1);
  }, [contribuyente.data, currentYear]);
  const years = React.useMemo(
    () => Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i),
    [currentYear, startYear],
  );

  const results = useSiiF29EstadoMulti(years);
  const [selected, setSelected] = React.useState<SelectedCell | null>(null);

  /* "Actualizar F29": sincroniza los años visibles (secuencial — el SII permite
     un sync por tenant a la vez). Llena `/f29/estado` (los sin_dato pasan a real). */
  const qc = useQueryClient();
  const syncF29 = useSyncF29();
  const [syncYear, setSyncYear] = React.useState<number | null>(null);
  const syncing = syncYear !== null;

  async function actualizar() {
    if (syncing) return;
    let ok = 0;
    let errored = 0;
    let inProgress = false;
    for (const y of years) {
      setSyncYear(y);
      try {
        const res = await syncF29.mutateAsync(y);
        if (res.status === "in_progress") {
          inProgress = true;
          break;
        }
        ok += 1;
      } catch {
        errored += 1; // 502 del SII (best-effort) → seguimos con el resto
      }
    }
    setSyncYear(null);
    // Una sola invalidación al final (evita el refetch-storm de la grilla).
    if (ok > 0) qc.invalidateQueries({ queryKey: siiKeys.all });
    if (inProgress) {
      toast.info("Actualización en curso", {
        description: "Ya hay una sincronización de F29 corriendo. Espera unos minutos.",
      });
    } else if (ok === 0 && errored > 0) {
      toast.error("No pudimos actualizar", {
        description: "El SII no respondió. Intenta de nuevo en un rato.",
      });
    } else if (errored > 0) {
      // Éxito parcial: no ocultar que algunos años fallaron.
      toast.warning("Actualización parcial", {
        description: `Algunos años no se pudieron traer del SII (${errored}). El resto se actualizó.`,
      });
    } else {
      toast.success("F29 actualizados", { description: "Tu estado de F29 se actualizó." });
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-mid">
          Si ves &quot;sin dato&quot;, sincroniza para traer tus F29 del SII.
        </p>
        <QavanteButton size="sm" onClick={actualizar} loading={syncing} disabled={syncing}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {syncing ? `Actualizando ${syncYear ?? ""}…` : "Actualizar F29"}
        </QavanteButton>
      </div>

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
  /* Sin dato (o estado fuera de contrato): vencido pero sin F29 sincronizado, o un
     `estado` que no reconocemos (el contrato tipa `meses[]` laxo). NO lo pintamos
     rojo ni rendeamos un botón roto "undefined" — marca neutra, no clickeable. */
  const CLICKABLE = ["declarado", "no_declarado_vencido", "por_declarar", "en_curso"];
  if (estado === "sin_dato" || !CLICKABLE.includes(estado)) {
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
