"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BudgetVsActualResponse } from "@/lib/api/planning";
import { parseAmount } from "@/lib/formatters/amount";
import { formatClp } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import { DataState } from "@/components/rediseno/data-state";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import {
  concordar,
  csvDesviosV09,
  desviosV09,
  estadoDatosV09,
  resultRealCoincideConResultado,
  triadaV09,
  type DesvioLineaV09,
} from "./presupuesto-v09-model";

/* V09 · Presupuesto — "¿cómo vas contra tu plan?" (rediseño Fase 2, issue #74, ESPECIFICACION
 * §V09). PRESENTACIONAL, como `gestion-v08-view.tsx` / `remuneraciones-v16-view.tsx`: entra el
 * `BudgetVsActualResponse` ya resuelto, sale la pantalla. El cableado vive en
 * `presupuesto-v09-live.tsx`.
 *
 * ── ALCANCE (issue #74) ──────────────────────────────────────────────────────────────────────
 * Entra: la tríada Plan/Real/Desvío (línea `result`) y la tabla de desvíos por concepto.
 * NO entra, huecos DECLARADOS acá mismo (no un default plausible tapándolos):
 *   1. Link a los documentos que explican cada desvío (drill-down monto→documentos): fork de
 *      diseño del BO (ADR-0091 F1b), no se decide sin Fernando.
 *   2. Banner de proyección de cierre ("a este ritmo…") + CTA "Ajustar plan": depende de la MISMA
 *      decisión de forma del hueco 1 (issue #74, "el segundo depende del primero").
 * Ver `HuecosDeclarados` más abajo — el mensaje vive EN la pantalla, no sólo en el PR.
 *
 * ── LEY 1 — el "Real" de acá es el "Resultado" de V08 ───────────────────────────────────────
 * `triada.real` SIEMPRE pinta el `actual` de la línea `result` de `budget-vs-actual` — nunca el
 * de `operational-result`, ni siquiera cuando el guard de abajo detecta que difieren.
 *
 * INV-FIN-001 canónico (`docs/factory/proposal-pack/08_BUSINESS_INVARIANTS.md`):
 * `budget-vs-actual.actual.result == operational-result.result`. `presupuesto-v09-live.tsx` SÍ pide
 * `operational-result` del mismo período — sólo para este guard, no para pintar un segundo "Real"
 * — y pasa su `result` acá como `resultOperacional`. Si `resultRealCoincideConResultado` (modelo)
 * da `false`, `BannerInvarianteRoto` declara AMBOS números en pantalla: Ley 1 prohíbe elegir uno
 * en silencio cuando dos fuentes que deberían coincidir no lo hacen. `resultOperacional` ausente
 * (todavía sin respuesta, o la consulta secundaria falló) simplemente no corre el guard — no
 * bloquea el resto de la pantalla, que ya tiene sus propios estados de "no sé" (Ley 3).
 *
 * ── "NO SÉ" EXPLÍCITO (Ley 3, §5.4) ──────────────────────────────────────────────────────────
 * `estadoDatosV09` decide entre 3 estados reales: sin presupuesto (empty state con CTA), datos
 * incompletos (banner declarando qué falta, ENCIMA de la pantalla — no se esconde) y completo. */

export interface PresupuestoV09ViewProps {
  periodoLabel: string;
  /** `GET /api/planning/budget-vs-actual?period=`. `undefined` = todavía sin respuesta o la
   *  consulta falló (ver `error`). */
  bva: BudgetVsActualResponse | undefined;
  /** Presente cuando la consulta falló (red/backend). `bva` se ignora. */
  error?: string | null;
  onReintentar?: () => void;
  /** Proponer presupuesto (ADR-0091 F1a, endpoint YA vivo) para el estado "sin presupuesto" — Ley
   *  8: el estado vacío siempre trae un botón que lo resuelve, no sólo un texto. */
  onProponer?: () => void;
  proponiendo?: boolean;
  errorProponer?: boolean;
  /** Issue sucesor de los huecos declarados (drill-down + proyección de cierre). */
  issueSucesor?: string;
  /** `GET /api/management/operational-result?period=`.`result`, del MISMO período que `bva` —
   *  SOLO para el guard de INV-FIN-001 (Ley 1, ver cabecera del módulo). La tríada nunca pinta
   *  este valor. `undefined`/`null` = todavía sin respuesta, con error, o no se pidió: el guard
   *  no corre (best-effort, no bloquea el resto de la pantalla). */
  resultOperacional?: string | null;
}

export function PresupuestoV09View({
  periodoLabel,
  bva,
  error,
  onReintentar,
  onProponer,
  proponiendo = false,
  errorProponer = false,
  issueSucesor,
  resultOperacional,
}: PresupuestoV09ViewProps) {
  if (error) {
    return (
      <DataState
        status="error"
        what="tu presupuesto vs. real"
        cause={error}
        action={
          onReintentar
            ? { label: "Reintentar", onClick: onReintentar }
            : { label: "Revisar conexiones", href: "/conexiones" }
        }
      />
    );
  }

  if (!bva) {
    /* Defensivo: en producción `presupuesto-v09-live.tsx` nunca llega hasta acá sin `bva` ni
       `error` (muestra su propio skeleton mientras `isLoading`) — este estado sólo se alcanza
       usando la vista sin el wrapper (tests/stories). §5.4: el texto dice qué se espera y su ETA,
       no un "Cargando…" desnudo. */
    return (
      <DataState
        status="empty"
        what={`presupuesto de ${periodoLabel}`}
        hint="Estamos trayendo tu presupuesto vs. real (~3 s)."
      />
    );
  }

  const estado = estadoDatosV09(bva);

  if (estado === "sin_presupuesto") {
    return (
      <EmptyStateSinPresupuesto
        periodoLabel={periodoLabel}
        onProponer={onProponer}
        proponiendo={proponiendo}
        error={errorProponer}
      />
    );
  }

  const triada = triadaV09(periodoLabel, bva);
  const desvios = desviosV09(bva);
  /* Guard de INV-FIN-001 (Ley 1, ver cabecera): sólo corre cuando llegó un `resultOperacional`
   * (la consulta secundaria a `operational-result` respondió). `bva` sigue siendo el único origen
   * de `triada.real` — este chequeo NUNCA lo reemplaza, sólo decide si hay que declarar que las
   * dos fuentes discreparon. */
  const invarianteRoto =
    resultOperacional != null && !resultRealCoincideConResultado(bva, resultOperacional);

  if (!triada) {
    // Contrato roto: has_budget=true pero sin línea `result`. No se inventa un plan.
    return (
      <DataState
        status="error"
        what="la línea de resultado del presupuesto"
        cause="El presupuesto de este período no trajo la línea de resultado. Vuelve a intentar en un momento."
        action={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-rediseno-tinta-3">
        ¿Cómo vas contra tu plan de {periodoLabel.toLowerCase()}?
      </p>

      {estado === "incompleto" && (
        <BannerIncompleto missingSources={bva.missing_sources ?? []} dataState={bva.data_state} />
      )}

      {invarianteRoto && (
        <BannerInvarianteRoto real={triada.real} resultado={parseAmount(resultOperacional)} />
      )}

      {/* (1) Tríada: Plan / Real / Desvío (línea `result`, Ley 1). */}
      <section aria-label="Plan, real y desvío del resultado" className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Plan"
          value={formatClp(triada.plan)}
          detail={`Presupuesto de ${periodoLabel}`}
        />
        <KpiCard
          label="Real"
          value={formatClp(triada.real)}
          detail="= Resultado de Gestión (V08)"
        />
        <KpiCard
          label="Desvío"
          value={
            <span className="inline-flex items-baseline gap-2">
              {triada.desvio < 0 ? "−" : ""}
              {formatClp(Math.abs(triada.desvio))}
            </span>
          }
          detail={
            <Pill variant={triada.favorable ? "ok" : "warn"}>
              {triada.favorable ? "a favor" : "en contra"}
              {triada.desvioPct != null ? ` · ${formatPct(Math.abs(triada.desvioPct))}` : ""}
            </Pill>
          }
        />
      </section>

      {/* (2) Tabla de desvíos por concepto. */}
      <section aria-labelledby="v09-desvios" className="space-y-2">
        <h2
          id="v09-desvios"
          className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3"
        >
          Lo que se desvía
        </h2>

        {desvios.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-6 py-8 text-center text-[13px] text-rediseno-tinta-2">
            Vas clavado al plan: ningún concepto se desvía todavía.
          </div>
        ) : (
          <TablaDesvios desvios={desvios} periodoLabel={periodoLabel} />
        )}
      </section>

      <HuecosDeclarados issueSucesor={issueSucesor} />
    </div>
  );
}

/* ── Estado vacío: sin presupuesto del período (Ley 8 — siempre con acción) ──────────────────── */
function EmptyStateSinPresupuesto({
  periodoLabel,
  onProponer,
  proponiendo,
  error,
}: {
  periodoLabel: string;
  onProponer?: () => void;
  proponiendo: boolean;
  error: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-6 py-10 text-center">
      <h3 className="font-rediseno-sans text-[17px] font-medium text-rediseno-tinta">
        Todavía no tienes presupuesto de {periodoLabel.toLowerCase()}
      </h3>
      <p className="max-w-[26rem] text-[13px] leading-relaxed text-rediseno-tinta-2">
        No lo llenas a mano: Qavante te lo propone desde tu historial real (tendencia,
        estacionalidad y gastos recurrentes) y después lo ajustas con un gesto.
      </p>
      {onProponer && (
        <button
          type="button"
          onClick={onProponer}
          disabled={proponiendo}
          className="mt-1 inline-flex items-center rounded-full bg-rediseno-tinta px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul"
        >
          {proponiendo ? "Proponiendo…" : "Proponer presupuesto"}
        </button>
      )}
      {error && (
        <p className="text-[12.5px] text-rediseno-ambar">
          No pudimos proponer el presupuesto ahora. Vuelve a intentar en un momento.
        </p>
      )}
    </div>
  );
}

/* ── Banner de dato incompleto (Ley 3: se dice, no se esconde) ────────────────────────────────── */
function BannerIncompleto({
  missingSources,
  dataState,
}: {
  missingSources: string[];
  dataState: BudgetVsActualResponse["data_state"];
}) {
  const n = missingSources.length;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rediseno-hairline border-l-[3px] border-l-rediseno-ambar-border bg-rediseno-superficie px-4 py-2.5 text-[13px] text-rediseno-tinta-2">
      <span>
        {dataState === "estimated" ? "Dato estimado: " : "Dato parcial: "}
        {n > 0
          ? `${n} ${concordar(n, "fuente", "fuentes")} sin consultar (${missingSources.join(", ")}).`
          : "el motor no confirma todas las fuentes de este período."}
      </span>
    </div>
  );
}

/* ── INV-FIN-001 roto con datos reales (Ley 1: dos fuentes que discrepan se declaran las dos,
 * jamás se elige una en silencio) — hallazgo de revisión adversarial, PR #102 vuelta 2. Ámbar, no
 * rojo (Ley 2): es una discrepancia a investigar, no una alarma de una acción bloqueada. */
function BannerInvarianteRoto({ real, resultado }: { real: number; resultado: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rediseno-hairline border-l-[3px] border-l-rediseno-ambar-border bg-rediseno-superficie px-4 py-2.5 text-[13px] text-rediseno-tinta-2">
      <span>
        El &quot;Real&quot; de este presupuesto ({formatClp(real)}) no coincide con el
        &quot;Resultado&quot; de Gestión ({formatClp(resultado)}) del mismo período. No elegimos uno
        de los dos en silencio: repórtalo.
      </span>
    </div>
  );
}

/* ── Huecos declarados (issue #74): visibles EN la pantalla, no sólo en el PR ────────────────── */
function HuecosDeclarados({ issueSucesor }: { issueSucesor?: string }) {
  return (
    <p className="pt-1 text-center text-[12px] text-rediseno-tinta-3-light">
      Todavía no: el link de cada desvío a los documentos que lo explican, y el aviso de cómo vas a
      cerrar el año. Esperan una decisión de forma del dueño (ADR-0091 F1b)
      {issueSucesor ? ` · issue sucesor ${issueSucesor}` : ""}.
    </p>
  );
}

/* ── (2) La tabla (§1.3 `.tw > table.t`, §5.5) ───────────────────────────────────────────────── */
function TablaDesvios({
  desvios,
  periodoLabel,
}: {
  desvios: DesvioLineaV09[];
  periodoLabel: string;
}) {
  const columns = React.useMemo<ColumnDef<DesvioLineaV09, unknown>[]>(
    () => [
      {
        id: "concepto",
        accessorFn: (d) => d.label,
        header: "Concepto",
        meta: { principal: true },
        cell: ({ row }) => {
          const sub = `Plan ${formatClp(Math.abs(row.original.plan))} · Real ${formatClp(
            Math.abs(row.original.real),
          )}`;
          return (
            <TablePrimaryCell
              value={row.original.label}
              /* El `.sub` ENVUELVE en vez de truncar cuando la tabla es angosta (mismo hallazgo
                 documentado en `table.tsx` y arreglado en `cobrar-v04-view.tsx`): su `nowrap` por
                 defecto fija el ancho MÍNIMO de la columna en el metadato entero y empuja el
                 monto del desvío (el dato primario) fuera del contenedor — medido con la Ley 7 a
                 360 px (15 px de desborde antes de este fix). */
              sub={
                <span className="@max-[640px]:whitespace-normal" title={sub}>
                  {sub}
                </span>
              }
            />
          );
        },
      },
      {
        id: "monto",
        accessorFn: (d) => d.desvio,
        header: `Desvío ${periodoLabel}`,
        /* El monto NUNCA se oculta (Ley 7: "el dato primario — contraparte, monto — no se trunca
           jamás"): en esta tabla el monto del desvío ES el dato primario junto al concepto. Lo que
           SÍ colapsa en viewport angosto es el pill de abajo (interpretación "a favor/en contra" +
           %), que es apoyo — el signo +/− del monto ya comunica la dirección. */
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.desvio < 0 ? "−" : "+"}
            {formatClp(Math.abs(row.original.desvio))}
          </span>
        ),
      },
      {
        id: "pill",
        accessorFn: (d) => d.desvio,
        header: "",
        enableSorting: false,
        meta: { align: "right", hideBelowTable: "sm" },
        cell: ({ row }) => (
          <Pill variant={row.original.favorable ? "ok" : "warn"}>
            {row.original.favorable ? "a favor" : "en contra"}
            {row.original.desvioPct != null
              ? ` · ${formatPct(Math.abs(row.original.desvioPct))}`
              : ""}
          </Pill>
        ),
      },
    ],
    [periodoLabel],
  );

  return (
    <RedisenoTable
      columns={columns}
      data={desvios}
      totalCount={desvios.length}
      pageSize={25}
      countNoun={concordar(desvios.length, "concepto desviado", "conceptos desviados")}
      emptyMessage="Sin desvíos en este período."
      onExport={() =>
        descargarCsv(`presupuesto-desvios-${periodoLabel}.csv`, csvDesviosV09(desvios))
      }
      /* Ley 7 a 320 px (revisión adversarial, PR #102 vuelta 2): en el Chromium headless de Linux
         que corre `test-storybook`, la tabla desbordaba 1 px a 320 — las fuentes de ese runner
         miden más ancho que en Windows (mismo tipo de brecha ya visto en V08/V12/V16). Ganar ancho
         angostando el padding lateral de celda (18→10 px, opt-in, ya existe en `table.tsx`) en vez
         de tocar el umbral del test o `table.tsx`: 8 px por lado × 2 columnas visibles a ese ancho
         (concepto + monto — el pill ya colapsa con `hideBelowTable: "sm"`) = 32 px de margen, muy
         por encima del 1 px que faltaba. */
      celdasCompactasEnAngosto
    />
  );
}

/** Exportar (§5.5): descarga el CSV en el navegador. Sólo corre en cliente (mismo patrón que
 *  `gestion-v08-view.tsx` / `remuneraciones-v16-view.tsx` — cada V-pantalla trae su propia copia,
 *  consolidación pendiente allá también). */
function descargarCsv(nombre: string, contenido: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
