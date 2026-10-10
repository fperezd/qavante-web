"use client";

import * as React from "react";
import { downloadXlsx } from "@/lib/export/xlsx";
import type {
  BudgetAccountLine,
  BudgetByAccountResponse,
  BudgetClosingProjectionResponse,
  BudgetLine,
  BudgetVsActualResponse,
} from "@/lib/api/planning";
import type { BudgetGridModel } from "../budget-grid-model";
import { BudgetGridView } from "../budget-grid-view";
import type { OperationalResultDocuments } from "@/lib/api/gestion";
import { resolverDrill } from "@/components/gestion/v08/gestion-v08-model";
import { parseAmount } from "@/lib/formatters/amount";
import { formatClp, formatClpBare } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatCount } from "@/lib/formatters/count";
import { formatPct } from "@/lib/formatters/pct";
import { DataState } from "@/components/rediseno/data-state";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { TablePrimaryCell } from "@/components/rediseno/table";
import { cn } from "@/lib/utils";
import {
  bucketSinAsignar,
  concordar,
  crossFootConcepto,
  csvDesviosV09Table,
  cuentasDeConcepto,
  desviosV09,
  estadoDatosV09,
  resolverProyeccionCierre,
  resultRealCoincideConResultado,
  triadaV09,
  type BucketSinAsignarV09,
  type DesvioLineaV09,
} from "./presupuesto-v09-model";

/* V09 · Presupuesto — "¿cómo vas contra tu plan?" (rediseño Fase 2, issue #74/#101, ESPECIFICACION
 * §V09). PRESENTACIONAL, como `gestion-v08-view.tsx` / `remuneraciones-v16-view.tsx`: entra el
 * `BudgetVsActualResponse` ya resuelto, sale la pantalla. El cableado vive en
 * `presupuesto-v09-live.tsx`.
 *
 * ── ALCANCE (issue #101 — cierra los dos huecos que #74 dejó declarados) ────────────────────────
 * Entra: la tríada Plan/Real/Desvío (línea `result`), la tabla de desvíos por concepto, el
 * drill-down concepto→cuentas→documentos (decisión BO 2026-09-20: MISMA interacción de V08 ·
 * Gestión, Ley 1 — nunca una propia) y el banner de proyección de cierre autoritativo del
 * servidor con su CTA "Ajustar plan" (abre la grilla anual existente integrada en esta pantalla,
 * nunca una ruta nueva). Ver `HuecosDeclarados` más abajo por lo que SIGUE sin resolver.
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
 * ── DRILL-DOWN: dos niveles, dos fuentes de datos distintas ─────────────────────────────────────
 * Nivel 1 (concepto→cuentas): `porCuenta` es UNA sola consulta de `budget-by-account` del período
 * (`presupuesto-v09-live.tsx` la pide siempre, no sólo cuando se abre una fila) — este archivo
 * sólo FILTRA la misma respuesta por `concept`/`concept_status` (`cuentasDeConcepto`/
 * `bucketSinAsignar`, modelo puro). El bucket "Sin asignar / conflicto" es una fila FIJA al final
 * de la tabla de desvíos, fuera de cualquier concepto — nunca se reparte por heurística.
 * Nivel 2 (cuenta→documentos): `cuentaAbierta`/`documentos` están CONTROLADOS por el padre (mismo
 * patrón que `drill`/`drillDocs` de `gestion-v08-view.tsx`) porque abrir una cuenta dispara una
 * consulta nueva a `/operational-result/documents` — se reusa `resolverDrill` de V08 tal cual: el
 * shape de `OperationalResultDocuments` es el mismo contrato.
 *
 * ── PROYECCIÓN DE CIERRE: autoritativa, nunca extrapolada en el cliente ─────────────────────────
 * `proyeccion` es la traducción legible (`resolverProyeccionCierre`) de
 * `GET /api/planning/budget-closing-projection`. Si el servidor se abstiene (`projected_result:
 * null`), esta vista muestra `abstentionReasons` tal cual — Ley 3, nunca un 0 ni un "cierre
 * completo" inventado. El CTA "Ajustar plan" abre/cierra la grilla anual YA existente
 * (`BudgetGridView`, mismos hooks `useBudgetGrid`/`useEditBudgetLine`/`useAcceptBudget` que la
 * pantalla Presupuesto Fase 1a) como un panel integrado en ESTA pantalla — nunca una ruta nueva ni
 * un cálculo de edición nuevo.
 *
 * ── "NO SÉ" EXPLÍCITO (Ley 3, §5.4) ──────────────────────────────────────────────────────────
 * `estadoDatosV09` decide entre 3 estados reales: sin presupuesto (empty state con CTA), datos
 * incompletos (banner declarando qué falta, ENCIMA de la pantalla — no se esconde) y completo. */

export interface CuentaAbiertaV09 {
  accountCode: string;
  accountName: string;
}

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
  /** Compatibilidad de stories antiguas; nunca se presenta al usuario. */
  issueSucesor?: string;
  /** `GET /api/management/operational-result?period=`.`result`, del MISMO período que `bva` —
   *  SOLO para el guard de INV-FIN-001 (Ley 1, ver cabecera del módulo). La tríada nunca pinta
   *  este valor. `undefined`/`null` = todavía sin respuesta, con error, o no se pidió: el guard
   *  no corre (best-effort, no bloquea el resto de la pantalla). */
  resultOperacional?: string | null;

  /* ── Drill-down nivel 1: concepto → cuentas (issue #101) ──────────────────────────────────── */
  /** `GET /api/planning/budget-by-account?period=` — UNA sola consulta del período, siempre
   *  pedida (alimenta el drill-down Y el bucket fijo "Sin asignar"). `undefined` = todavía sin
   *  responder; `porCuentaError` presente = la consulta falló. */
  porCuenta?: BudgetByAccountResponse;
  porCuentaError?: string | null;
  onReintentarPorCuenta?: () => void;
  /** Qué fila de concepto (o el bucket "sin_asignar") está expandida — `null` = ninguna. Sin
   *  `onAbrirConcepto` la vista cae a estado interno (uso sin cableado: tests/stories simples);
   *  con `onAbrirConcepto` queda totalmente controlada, igual que `cuentaAbierta` — necesario para
   *  poder fijar "concepto Y cuenta abiertos" en un mismo render (tests/stories del nivel 2). */
  conceptoAbierto?: Exclude<BudgetLine["concept"], "result"> | "sin_asignar" | null;
  onAbrirConcepto?: (c: Exclude<BudgetLine["concept"], "result"> | "sin_asignar" | null) => void;

  /* ── Drill-down nivel 2: cuenta → documentos (issue #101, mismo patrón que V08) ───────────── */
  /** Cuenta actualmente expandida, o `null` si ninguna. Controlado por el padre: abrir una cuenta
   *  dispara `useOperationalResultDocuments` allá. */
  cuentaAbierta?: CuentaAbiertaV09 | null;
  onAbrirCuenta?: (cuenta: CuentaAbiertaV09 | null) => void;
  documentos?: OperationalResultDocuments | null;
  documentosCargando?: boolean;

  /* ── Proyección de cierre (CC-API #431) ───────────────────────────────────────────────────── */
  /** `undefined` = todavía sin responder; `proyeccionError` presente = la consulta falló. */
  proyeccion?: BudgetClosingProjectionResponse;
  proyeccionError?: string | null;
  onReintentarProyeccion?: () => void;

  /* ── CTA "Ajustar plan": grilla anual integrada (reusa useBudgetGrid/useEditBudgetLine ya
     existentes, nunca un cálculo de edición nuevo) ─────────────────────────────────────────── */
  ajustarPlanAbierto?: boolean;
  onToggleAjustarPlan?: () => void;
  grid?: BudgetGridModel | null;
  gridCargando?: boolean;
  gridSaving?: boolean;
  gridAccepting?: boolean;
  onEditarCeldaGrid?: (
    accountId: string | null,
    impactType: string,
    month: number,
    montoSignado: number,
  ) => void;
  onAceptarGrid?: () => void;
}

export function PresupuestoV09View({
  periodoLabel,
  bva,
  error,
  onReintentar,
  onProponer,
  proponiendo = false,
  errorProponer = false,
  resultOperacional,
  porCuenta,
  porCuentaError,
  onReintentarPorCuenta,
  conceptoAbierto: conceptoAbiertoControlado,
  onAbrirConcepto,
  cuentaAbierta = null,
  onAbrirCuenta,
  documentos,
  documentosCargando = false,
  proyeccion,
  proyeccionError,
  onReintentarProyeccion,
  ajustarPlanAbierto = false,
  onToggleAjustarPlan,
  grid,
  gridCargando = false,
  gridSaving = false,
  gridAccepting = false,
  onEditarCeldaGrid,
  onAceptarGrid,
}: PresupuestoV09ViewProps) {
  if (error) {
    return (
      <DataState
        status="error"
        what="tu presupuesto vs. real"
        cause="No pudimos consultar el presupuesto de este período. No confirmamos sus cifras; vuelve a intentar."
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
        hint="Estamos trayendo tu presupuesto y su comparación con el resultado real."
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

      {/* (2) Proyección de cierre de año (CC-API #431) + CTA "Ajustar plan". */}
      <BannerProyeccionCierre
        proyeccion={proyeccion}
        error={proyeccionError}
        onReintentar={onReintentarProyeccion}
        ajustarPlanAbierto={ajustarPlanAbierto}
        onToggleAjustarPlan={onToggleAjustarPlan}
        grid={grid}
        gridCargando={gridCargando}
        gridSaving={gridSaving}
        gridAccepting={gridAccepting}
        onEditarCeldaGrid={onEditarCeldaGrid}
        onAceptarGrid={onAceptarGrid}
      />

      {/* (3) Tabla de desvíos por concepto, con drill-down concepto → cuentas → documentos. */}
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
          <TablaDesvios
            desvios={desvios}
            periodoLabel={periodoLabel}
            porCuenta={porCuenta}
            porCuentaError={porCuentaError}
            onReintentarPorCuenta={onReintentarPorCuenta}
            conceptoAbiertoControlado={conceptoAbiertoControlado}
            onAbrirConcepto={onAbrirConcepto}
            cuentaAbierta={cuentaAbierta}
            onAbrirCuenta={onAbrirCuenta}
            documentos={documentos}
            documentosCargando={documentosCargando}
            periodo={bva.period}
          />
        )}
      </section>

      <HuecosDeclarados />
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
          ? `${n} ${concordar(n, "fuente", "fuentes")} sin consultar. Revisa el detalle de conexiones para identificarlas.`
          : "no se pudieron confirmar todas las fuentes de este período."}
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

/* ── Huecos declarados (issue #101): lo que SIGUE sin resolver, visible EN la pantalla ────────── */
function HuecosDeclarados() {
  return (
    <p className="pt-1 text-center text-[12px] text-rediseno-tinta-3-light">
      Las cuentas sin código (impactos sin cuenta de gestión asociada) muestran su monto pero no
      abren documentos: no hay código de cuenta que mandarle a Gestión.
    </p>
  );
}

/* ── (2) Proyección de cierre (CC-API #431) + CTA "Ajustar plan" (issue #101) ────────────────────
 * Autoritativa del servidor — "sin extrapolación de interfaz" (ver cabecera del módulo). Esta
 * sección NUNCA calcula el monto: o lo muestra tal cual llegó, o declara por qué el servidor se
 * abstuvo (Ley 3). El CTA abre/cierra la grilla anual YA existente (`BudgetGridView`) integrada en
 * esta misma pantalla — nunca una ruta nueva. */
function BannerProyeccionCierre({
  proyeccion,
  error,
  onReintentar,
  ajustarPlanAbierto,
  onToggleAjustarPlan,
  grid,
  gridCargando,
  gridSaving,
  gridAccepting,
  onEditarCeldaGrid,
  onAceptarGrid,
}: {
  proyeccion: BudgetClosingProjectionResponse | undefined;
  error?: string | null;
  onReintentar?: () => void;
  ajustarPlanAbierto: boolean;
  onToggleAjustarPlan?: () => void;
  grid?: BudgetGridModel | null;
  gridCargando?: boolean;
  gridSaving?: boolean;
  gridAccepting?: boolean;
  onEditarCeldaGrid?: (
    accountId: string | null,
    impactType: string,
    month: number,
    montoSignado: number,
  ) => void;
  onAceptarGrid?: () => void;
}) {
  const resuelto = resolverProyeccionCierre(proyeccion);

  const cabecera = (
    <h2
      id="v09-proyeccion"
      className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3"
    >
      Proyección de cierre de año
    </h2>
  );

  const botonAjustarPlan = onToggleAjustarPlan && (
    <button
      type="button"
      onClick={onToggleAjustarPlan}
      aria-expanded={ajustarPlanAbierto}
      className="inline-flex items-center rounded-full border border-rediseno-azul px-3 py-1.5 text-[12.5px] font-bold text-rediseno-azul focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul"
    >
      {ajustarPlanAbierto ? "Cerrar ajuste" : "Ajustar plan"}
    </button>
  );

  let cuerpo: React.ReactNode;
  if (error) {
    cuerpo = (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rediseno-hairline bg-rediseno-superficie px-4 py-2.5 text-[13px] text-rediseno-tinta-2">
        <span>No pudimos traer la proyección de cierre. No confirmamos esta cifra.</span>
        {onReintentar && (
          <button type="button" onClick={onReintentar} className="font-bold text-rediseno-azul">
            Reintentar
          </button>
        )}
      </div>
    );
  } else if (!resuelto) {
    cuerpo = (
      <div
        className="h-16 animate-pulse rounded-xl bg-rediseno-neutro-bg"
        aria-busy="true"
        aria-live="polite"
      />
    );
  } else if (resuelto.disponible) {
    cuerpo = (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rediseno-hairline bg-rediseno-superficie px-4 py-3">
        <div className="min-w-0">
          <div className="text-[20px] font-semibold text-rediseno-tinta tabular-nums">
            {resuelto.monto! < 0 ? "−" : ""}
            {formatClp(Math.abs(resuelto.monto!))}
          </div>
          <p className="mt-0.5 text-[12.5px] text-rediseno-tinta-3-light">
            Cierre de {resuelto.fiscalYear}: {resuelto.metodoLabel}. Cobertura{" "}
            {resuelto.coberturaLabel} · corte al {formatDateLike(resuelto.asOf)}.
          </p>
        </div>
        {botonAjustarPlan}
      </div>
    );
  } else {
    cuerpo = (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rediseno-hairline border-l-[3px] border-l-rediseno-ambar-border bg-rediseno-superficie px-4 py-3">
        <div className="min-w-0 text-[13px] text-rediseno-tinta-2">
          <p className="font-semibold text-rediseno-tinta">
            Todavía no podemos cerrar el año {resuelto.fiscalYear}.
          </p>
          {resuelto.abstentionReasons.length > 0 ? (
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {resuelto.abstentionReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">
              Falta cobertura de algún mes requerido; el servidor no entregó el motivo exacto.
            </p>
          )}
        </div>
        {botonAjustarPlan}
      </div>
    );
  }

  return (
    <section aria-labelledby="v09-proyeccion" className="space-y-2">
      {cabecera}
      {cuerpo}
      {ajustarPlanAbierto && (
        <PanelAjustarPlan
          grid={grid}
          cargando={gridCargando}
          saving={gridSaving}
          accepting={gridAccepting}
          onEditarCelda={onEditarCeldaGrid}
          onAceptar={onAceptarGrid}
        />
      )}
    </section>
  );
}

/* ── Panel "Ajustar plan": la grilla anual EDITABLE ya existente, integrada acá (nunca un
 * cálculo de edición nuevo — mismas mutations `useEditBudgetLine`/`useAcceptBudget` que la
 * pantalla Presupuesto Fase 1a, cableadas en `presupuesto-v09-live.tsx`). */
function PanelAjustarPlan({
  grid,
  cargando,
  saving,
  accepting,
  onEditarCelda,
  onAceptar,
}: {
  grid?: BudgetGridModel | null;
  cargando?: boolean;
  saving?: boolean;
  accepting?: boolean;
  onEditarCelda?: (
    accountId: string | null,
    impactType: string,
    month: number,
    montoSignado: number,
  ) => void;
  onAceptar?: () => void;
}) {
  if (cargando && !grid) {
    return (
      <div
        className="h-40 animate-pulse rounded-[14px] bg-rediseno-neutro-bg"
        aria-busy="true"
        aria-live="polite"
      />
    );
  }
  if (!grid) {
    return (
      <p className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-4 py-6 text-center text-[13px] text-rediseno-tinta-2">
        No hay presupuesto anual que ajustar todavía.
      </p>
    );
  }
  return (
    <BudgetGridView
      model={grid}
      saving={saving ?? false}
      accepting={accepting ?? false}
      onEditCell={(accountId, impactType, month, montoSignado) =>
        onEditarCelda?.(accountId, impactType, month, montoSignado)
      }
      onAccept={() => onAceptar?.()}
    />
  );
}

/* ── (3) La tabla (§1.3 `.tw > table.t`, §5.5) — ahora con drill-down inline concepto → cuentas
 * → documentos (issue #101), MISMA interacción de V08 · Gestión: fila clickeable, 4 estados
 * (cargando / error / cero honesto / filas + cierre). `RedisenoTable` no soporta sub-filas, así
 * que esta tabla se arma a mano (igual que la pivote de `gestion-v08-view.tsx`), conservando el
 * mismo look (`.t` §1.3) y el footer de exportar. */
function TablaDesvios({
  desvios,
  periodoLabel,
  porCuenta,
  porCuentaError,
  onReintentarPorCuenta,
  conceptoAbiertoControlado,
  onAbrirConcepto,
  cuentaAbierta,
  onAbrirCuenta,
  documentos,
  documentosCargando,
  periodo,
}: {
  desvios: DesvioLineaV09[];
  periodoLabel: string;
  porCuenta?: BudgetByAccountResponse;
  porCuentaError?: string | null;
  onReintentarPorCuenta?: () => void;
  conceptoAbiertoControlado?: DesvioLineaV09["concepto"] | "sin_asignar" | null;
  onAbrirConcepto?: (c: DesvioLineaV09["concepto"] | "sin_asignar" | null) => void;
  cuentaAbierta?: CuentaAbiertaV09 | null;
  onAbrirCuenta?: (cuenta: CuentaAbiertaV09 | null) => void;
  documentos?: OperationalResultDocuments | null;
  documentosCargando?: boolean;
  periodo: string;
}) {
  /* `conceptoAbierto` es controlado cuando el padre pasa `onAbrirConcepto` (vivo:
   * `presupuesto-v09-live.tsx`); sin cableado (uso directo en tests/stories simples) cae a estado
   * interno — mismo patrón de "controlado si hay handler" que el resto de esta vista. */
  const [conceptoAbiertoLocal, setConceptoAbiertoLocal] = React.useState<
    DesvioLineaV09["concepto"] | "sin_asignar" | null
  >(null);
  const conceptoAbierto = onAbrirConcepto ? conceptoAbiertoControlado ?? null : conceptoAbiertoLocal;
  const setConceptoAbierto = onAbrirConcepto ?? setConceptoAbiertoLocal;

  const bucket = bucketSinAsignar(porCuenta);

  const abrirCuenta = (c: BudgetAccountLine) => {
    if (!c.account_code) return;
    const yaAbierta = cuentaAbierta?.accountCode === c.account_code;
    onAbrirCuenta?.(
      yaAbierta ? null : { accountCode: c.account_code, accountName: c.account_name },
    );
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie">
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-[#FAFBFD]">
            <tr className="border-b border-rediseno-hairline">
              <th
                scope="col"
                className="px-[18px] py-[11px] text-left font-rediseno-mono text-[12px] font-semibold tracking-[.1em] text-rediseno-tinta-3-light uppercase"
              >
                Concepto
              </th>
              <th
                scope="col"
                className="px-[18px] py-[11px] text-right font-rediseno-mono text-[12px] font-semibold tracking-[.1em] text-rediseno-tinta-3-light uppercase"
              >
                Desvío {periodoLabel}
              </th>
              <th
                scope="col"
                className="hidden px-[18px] py-[11px] text-right font-rediseno-mono text-[12px] font-semibold tracking-[.1em] text-rediseno-tinta-3-light uppercase sm:table-cell"
              >
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody>
            {desvios.map((fila) => {
              const abierto = conceptoAbierto === fila.concepto;
              return (
                <React.Fragment key={fila.concepto}>
                  <FilaConcepto
                    fila={fila}
                    abierto={abierto}
                    onToggle={() => setConceptoAbierto(abierto ? null : fila.concepto)}
                  />
                  {abierto && (
                    <FilasCuentasDeConcepto
                      fila={fila}
                      porCuenta={porCuenta}
                      porCuentaError={porCuentaError}
                      onReintentarPorCuenta={onReintentarPorCuenta}
                      cuentaAbierta={cuentaAbierta}
                      onAbrirCuenta={abrirCuenta}
                      documentos={documentos}
                      documentosCargando={documentosCargando}
                      periodo={periodo}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Bucket fijo "Sin asignar / conflicto": FUERA de cualquier concepto, visible aunque
                esté vacío cuando ya respondió `budget-by-account` — nunca se reparte entre
                conceptos por heurística (Ley de este módulo, ver cabecera). */}
            {porCuenta && bucket.cuentas.length > 0 && (
              <React.Fragment>
                <FilaSinAsignar
                  bucket={bucket}
                  abierto={conceptoAbierto === "sin_asignar"}
                  onToggle={() =>
                    setConceptoAbierto(conceptoAbierto === "sin_asignar" ? null : "sin_asignar")
                  }
                />
                {conceptoAbierto === "sin_asignar" && (
                  <FilasCuentas
                    cuentas={bucket.cuentas}
                    cuentaAbierta={cuentaAbierta}
                    onAbrirCuenta={abrirCuenta}
                    documentos={documentos}
                    documentosCargando={documentosCargando}
                    periodo={periodo}
                  />
                )}
              </React.Fragment>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-rediseno-hairline-row px-[18px] py-[11px] text-[12.5px] text-rediseno-tinta-3-light">
        <span>
          {formatCount(desvios.length)}{" "}
          {concordar(desvios.length, "concepto desviado", "conceptos desviados")}
        </span>
        <button
          type="button"
          onClick={() =>
            descargarExcel(`presupuesto-desvios-${periodoLabel}.xlsx`, csvDesviosV09Table(desvios))
          }
          className="font-bold text-rediseno-azul"
        >
          Exportar
        </button>
      </div>
    </div>
  );
}

const TD = "px-[18px] py-3 align-baseline text-rediseno-tinta-2";
const MONTO = "text-right font-semibold text-rediseno-tinta tabular-nums whitespace-nowrap";

function FilaConcepto({
  fila,
  abierto,
  onToggle,
}: {
  fila: DesvioLineaV09;
  abierto: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      tabIndex={0}
      aria-expanded={abierto}
      role="button"
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="cursor-pointer border-b border-rediseno-hairline-row-2 last:border-b-0 hover:bg-rediseno-neutro-bg focus-visible:bg-rediseno-neutro-bg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rediseno-azul focus-visible:outline-none"
    >
      <td className={TD}>
        <TablePrimaryCell
          value={fila.label}
          sub={`Plan ${formatClp(Math.abs(fila.plan))} · Real ${formatClp(Math.abs(fila.real))}`}
        />
      </td>
      <td className={cn(TD, MONTO)}>
        {fila.desvio < 0 ? "−" : "+"}
        {formatClp(Math.abs(fila.desvio))}
      </td>
      <td className={cn(TD, "hidden text-right sm:table-cell")}>
        <Pill variant={fila.favorable ? "ok" : "warn"}>
          {fila.favorable ? "a favor" : "en contra"}
          {fila.desvioPct != null ? ` · ${formatPct(Math.abs(fila.desvioPct))}` : ""}
        </Pill>
      </td>
    </tr>
  );
}

function FilaSinAsignar({
  bucket,
  abierto,
  onToggle,
}: {
  bucket: BucketSinAsignarV09;
  abierto: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      tabIndex={0}
      aria-expanded={abierto}
      role="button"
      onClick={onToggle}
      className="cursor-pointer border-b border-rediseno-hairline-row-2 bg-rediseno-neutro-bg/40 last:border-b-0 hover:bg-rediseno-neutro-bg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rediseno-azul focus-visible:outline-none"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <td className={TD}>
        <TablePrimaryCell
          value="Sin asignar / conflicto"
          sub={`${bucket.cuentas.length} ${concordar(bucket.cuentas.length, "cuenta", "cuentas")} fuera de todo concepto del P&L — nunca se reparten entre Ingresos/Costos/Gastos.`}
        />
      </td>
      <td className={cn(TD, MONTO)}>
        {bucket.totalActual < 0 ? "−" : ""}
        {formatClp(Math.abs(bucket.totalActual))}
      </td>
      <td className="hidden sm:table-cell" />
    </tr>
  );
}

/** Cuentas `assigned` de UN concepto + su cross-foot contra la fila de desvíos (committed vs
 *  devengado, ver cabecera del módulo). */
function FilasCuentasDeConcepto({
  fila,
  porCuenta,
  porCuentaError,
  onReintentarPorCuenta,
  cuentaAbierta,
  onAbrirCuenta,
  documentos,
  documentosCargando,
  periodo,
}: {
  fila: DesvioLineaV09;
  porCuenta?: BudgetByAccountResponse;
  porCuentaError?: string | null;
  onReintentarPorCuenta?: () => void;
  cuentaAbierta?: CuentaAbiertaV09 | null;
  onAbrirCuenta: (c: BudgetAccountLine) => void;
  documentos?: OperationalResultDocuments | null;
  documentosCargando?: boolean;
  periodo: string;
}) {
  if (porCuentaError) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={3} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          No pudimos traer el desglose por cuenta de {fila.label.toLowerCase()}.{" "}
          {onReintentarPorCuenta && (
            <button
              type="button"
              onClick={onReintentarPorCuenta}
              className="font-bold text-rediseno-azul"
            >
              Reintentar
            </button>
          )}
        </td>
      </tr>
    );
  }
  if (!porCuenta) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={3} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          Estamos trayendo las cuentas de {fila.label.toLowerCase()}.
        </td>
      </tr>
    );
  }

  const cuentas = cuentasDeConcepto(porCuenta, fila.concepto);
  const crossFoot = crossFootConcepto(cuentas, fila);

  if (cuentas.length === 0) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={3} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          Ninguna cuenta de gestión quedó asignada a {fila.label.toLowerCase()} este período.
        </td>
      </tr>
    );
  }

  return (
    <>
      <FilasCuentas
        cuentas={cuentas}
        cuentaAbierta={cuentaAbierta}
        onAbrirCuenta={onAbrirCuenta}
        documentos={documentos}
        documentosCargando={documentosCargando}
        periodo={periodo}
      />
      {/* Cross-foot: por diseño del contrato NO calza con la fila de arriba (caja committed vs
          devengado) — se declara con su propio copy, nunca como un "descuadra" rojo de dato
          incompleto (ese patrón es de V08, y acá no aplica). */}
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana">
        <td colSpan={3} className={cn(TD, "text-[12.5px] text-rediseno-tinta-3")}>
          Estas cuentas suman {formatClp(Math.abs(crossFoot.totalCuentasCommitted))} en caja
          (committed). La fila de arriba usa devengado (
          {formatClp(Math.abs(crossFoot.totalFilaDevengado))}): no van a calzar exacto · son dos
          bases contables distintas, no un error de datos.
        </td>
      </tr>
    </>
  );
}

/** Filas de cuentas (compartidas por el drill de un concepto y por el bucket "Sin asignar"), cada
 *  una expandible a sus documentos (nivel 2, reusa `resolverDrill`/`DrillResuelto` de V08: mismo
 *  contrato `OperationalResultDocuments`). */
function FilasCuentas({
  cuentas,
  cuentaAbierta,
  onAbrirCuenta,
  documentos,
  documentosCargando,
  periodo,
}: {
  cuentas: BudgetAccountLine[];
  cuentaAbierta?: CuentaAbiertaV09 | null;
  onAbrirCuenta: (c: BudgetAccountLine) => void;
  documentos?: OperationalResultDocuments | null;
  documentosCargando?: boolean;
  periodo: string;
}) {
  return (
    <>
      {cuentas.map((c) => {
        const abierta = c.account_code != null && cuentaAbierta?.accountCode === c.account_code;
        const abrible = c.account_code != null;
        return (
          <React.Fragment key={c.account_id ?? c.account_name}>
            <tr
              tabIndex={abrible ? 0 : undefined}
              role={abrible ? "button" : undefined}
              aria-expanded={abrible ? abierta : undefined}
              onClick={abrible ? () => onAbrirCuenta(c) : undefined}
              onKeyDown={
                abrible
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAbrirCuenta(c);
                      }
                    }
                  : undefined
              }
              className={cn(
                "border-b border-rediseno-hairline-row-2 bg-rediseno-porcelana last:border-b-0",
                abrible &&
                  "cursor-pointer hover:bg-rediseno-neutro-bg focus-visible:bg-rediseno-neutro-bg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rediseno-azul focus-visible:outline-none",
              )}
            >
              <td className={cn(TD, "pl-7 sm:pl-14")}>
                <span className="text-rediseno-tinta">{c.account_name}</span>
                {!abrible && (
                  <span className="ml-1 text-[12px] text-rediseno-tinta-3-light">
                    (sin código de cuenta: no abre documentos)
                  </span>
                )}
              </td>
              <td className={cn(TD, MONTO)}>
                {parseAmount(c.actual) < 0 ? "−" : ""}
                {formatClp(Math.abs(parseAmount(c.actual)))}
              </td>
              <td className="hidden sm:table-cell" />
            </tr>
            {abierta && (
              <FilasDocumentosCuenta
                cuenta={c}
                periodo={periodo}
                documentos={documentos}
                cargando={documentosCargando}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

/** Nivel 2: los documentos de UNA cuenta (reusa `resolverDrill` de V08 — mismo contrato
 *  `OperationalResultDocuments`, mismas 4 ramas: cargando / error / cero honesto / filas). */
function FilasDocumentosCuenta({
  cuenta,
  periodo,
  documentos,
  cargando,
}: {
  cuenta: BudgetAccountLine;
  periodo: string;
  documentos?: OperationalResultDocuments | null;
  cargando?: boolean;
}) {
  const resuelto = resolverDrill(documentos);

  if (cargando) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-neutro-bg/60">
        <td colSpan={3} className={cn(TD, "pl-11 text-[12.5px] text-rediseno-tinta-3 sm:pl-20")}>
          Estamos trayendo los documentos de {cuenta.account_name} en {periodo}.
        </td>
      </tr>
    );
  }
  if (!resuelto) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-neutro-bg/60">
        <td colSpan={3} className={cn(TD, "pl-11 text-[12.5px] text-rediseno-tinta-3 sm:pl-20")}>
          No pudimos traer los documentos de {cuenta.account_name}. Vuelve a intentar en un
          momento.
        </td>
      </tr>
    );
  }
  if (resuelto.documentos.length === 0) {
    return (
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-neutro-bg/60">
        <td colSpan={3} className={cn(TD, "pl-11 text-[12.5px] text-rediseno-tinta-3 sm:pl-20")}>
          Consultamos y esta cuenta no tiene documentos en {periodo}. Este cero es real.
        </td>
      </tr>
    );
  }
  return (
    <>
      {resuelto.documentos.map((d, i) => (
        <tr
          key={`${d.folio ?? "s-folio"}-${i}`}
          className="border-b border-rediseno-hairline-row-2 bg-rediseno-neutro-bg/60"
        >
          <td className={cn(TD, "pl-11 text-[12.5px] sm:pl-20")}>
            <span className="font-rediseno-mono">{d.folio ?? "sin folio"}</span> ·{" "}
            <span className="text-rediseno-tinta">{d.contraparte ?? "sin contraparte"}</span>
          </td>
          <td className={cn(TD, MONTO, "text-[12.5px]")}>{formatClpBare(d.monto)}</td>
          <td className={cn(TD, "hidden text-right text-[12.5px] text-rediseno-tinta-3-light sm:table-cell")}>
            {d.origen ?? "·"}
          </td>
        </tr>
      ))}
      <tr className="border-b border-rediseno-hairline-row-2 bg-rediseno-neutro-bg/60">
        <td colSpan={3} className={cn(TD, "pl-11 text-[12.5px] text-rediseno-tinta-3 sm:pl-20")}>
          {resuelto.descuadra ? (
            <span className="font-bold">
              {concordar(
                resuelto.documentos.length,
                "El documento listado suma",
                `Los ${resuelto.documentos.length} documentos listados suman`,
              )}{" "}
              {formatClp(resuelto.totalSumado)}, pero la cuenta declara{" "}
              {formatClp(resuelto.totalDeclarado)}: falta detalle, no confíes en esta lista como
              completa.
            </span>
          ) : (
            <>
              {resuelto.count} {concordar(resuelto.count, "documento", "documentos")} ·{" "}
              {concordar(resuelto.count, "suma", "suman")} {formatClp(resuelto.totalSumado)}.
            </>
          )}
        </td>
      </tr>
    </>
  );
}

/** Exportar (§5.5): descarga Excel con celdas tipadas en el navegador. Sólo corre en cliente (mismo patrón que
 *  `gestion-v08-view.tsx` / `remuneraciones-v16-view.tsx` — cada V-pantalla trae su propia copia,
 *  consolidación pendiente allá también). */
const descargarExcel = downloadXlsx;
