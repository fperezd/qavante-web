"use client";

import * as React from "react";
import { downloadXlsx } from "@/lib/export/xlsx";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { formatDateTimeLike } from "@/lib/formatters/date";
import { DataState } from "@/components/rediseno/data-state";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import { SinDato } from "@/components/rediseno/sin-dato";
import {
  ESTADO_LABEL_V06,
  ESTADO_TONO_V06,
  LEY_9_TEXTO_V06,
  concordar,
  csvCalendarioV06Table,
  elUnicoRojoV06,
  estimacionF29V06,
  f29EstimadoHuecoV06,
  proximoVencimientoV06,
  triadaTgrV06,
  type EstimacionF29V06,
  type FilaCalendarioV06,
} from "./impuestos-v06-model";

/* V06 · Impuestos — "¿qué impuestos vencen, y cuáles ya declaraste?" (rediseño Fase 2, issue #73,
 * ESPECIFICACION §V06). PRESENTACIONAL, como `presupuesto-v09-view.tsx` / `pagar-v05-view.tsx`:
 * entra `filas` ya resuelto (el modelo puro de `impuestos-v06-model.ts` construido en
 * `impuestos-v06-live.tsx`), sale la pantalla.
 *
 * ── ALCANCE (issue #73) ──────────────────────────────────────────────────────────────────────
 * Entra: la tríada (Próximo vencimiento / F-29 del mes en curso / Deudas TGR) y la tabla
 * calendario (F-29 declarado o no, IVA postergado del SII, Previred, TGR).
 * La estimación del mes consume el contrato R2 de qavante-api #401. Sólo se muestra si el backend
 * afirma `estimable=true`; incluye desglose, fuentes y frescura. NO entra, como hueco declarado:
 *   1. El vínculo "conciliado con el cargo bancario" de un F-29 ya declarado: el contrato no liga
 *      hoy un F-29 a un movimiento de banco específico (verificado contra `PayableItem` y el motor
 *      de conciliación). El "comprobante" de cada fila declarada enlaza al F-29 real del SII.
 *
 * ── LEY 9 — el footer lleva el texto FIJO literal del issue #73 (no el de `pagar-v05-model.ts`:
 * ese es sobre postergaciones automáticas en general; éste es el que la espec pide LITERAL para
 * esta pantalla). Ningún botón de esta vista ofrece postergar un impuesto, una cotización ni un
 * PPM — ni siquiera cuando el SII ya postergó el IVA por su cuenta (esa fila sólo INFORMA).
 *
 * ── LEY 2 — el único rojo lo decide `elUnicoRojoV06` (modelo): el F-29 no declarado y vencido más
 * antiguo, si existe. El resto de los "no declarado (vencido)" queda en ámbar. */

export interface ImpuestosV06ViewProps {
  hoy: Date;
  /** `undefined` = todavía sin respuesta (ver `error` cuando la consulta falló). */
  filas: FilaCalendarioV06[] | undefined;
  /** Contrato de `/api/sii/f29/impuesto` ya protegido por `estimable`. */
  estimacionF29?: EstimacionF29V06;
  error?: string | null;
  onReintentar?: () => void;
  /** Compatibilidad de stories antiguas; nunca se presenta al usuario. */
  issueSucesor?: string;
}

export function ImpuestosV06View({
  hoy,
  filas,
  estimacionF29,
  error,
  onReintentar,
}: ImpuestosV06ViewProps) {
  if (error) {
    return (
      <DataState
        status="error"
        what="tu calendario tributario"
        cause={error}
        action={
          onReintentar
            ? { label: "Reintentar", onClick: onReintentar }
            : { label: "Revisar conexiones", href: "/conexiones" }
        }
      />
    );
  }

  if (!filas) {
    return (
      <DataState
        status="empty"
        what="tu calendario tributario"
        hint="Estamos trayendo tus F-29, Previred y TGR. El servicio todavía no publica un tiempo estimado para esta consulta."
      />
    );
  }

  const proximo = proximoVencimientoV06(filas, hoy);
  const tgr = triadaTgrV06(filas);
  const f29 = estimacionF29 ?? estimacionF29V06(undefined);
  const rojoKey = elUnicoRojoV06(filas);

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-rediseno-tinta-3">
        ¿Qué impuestos vencen, y cuáles ya declaraste?
      </p>

      {/* (1) Tríada: Próximo vencimiento / F-29 del mes en curso / Deudas TGR. */}
      <section
        aria-label="Próximo vencimiento, F-29 del mes en curso y deudas TGR"
        className="grid gap-3 sm:grid-cols-3"
      >
        {proximo ? (
          <KpiCard
            label="Próximo vencimiento"
            value={proximo.relativoLabel}
            detail={`${proximo.label} · vence ${proximo.vencimientoLabel}`}
          />
        ) : (
          <KpiCard
            label="Próximo vencimiento"
            sinDato={{ reason: "No hay ningún vencimiento pendiente con fecha conocida todavía." }}
          />
        )}

        {f29.monto != null ? (
          <KpiCard
            label="F-29 · mes en curso (estimado)"
            value={formatClp(f29.monto)}
            detail={<DetalleEstimacionF29 estimacion={f29} />}
          />
        ) : (
          <KpiCard
            label="F-29 · mes en curso (estimado)"
            sinDato={{ reason: f29.motivoSinMonto ?? f29EstimadoHuecoV06().reason }}
            detail={<DetalleEstimacionF29 estimacion={f29} />}
          />
        )}

        {tgr.totales != null ? (
          <KpiCard
            label="Deudas TGR"
            value={
              tgr.sinDeudaConfirmada
                ? "Sin deuda"
                : tgr.totales
                    .map(({ moneda, monto }) => `${moneda} ${formatMoney(monto, moneda)}`)
                    .join(" · ")
            }
            detail={
              tgr.n > 0
                ? `${tgr.n} ${concordar(tgr.n, "giro o deuda vigente", "giros o deudas vigentes")}`
                : "Consulta TGR exitosa · 0 deudas vigentes"
            }
          />
        ) : (
          <KpiCard
            label="Deudas TGR"
            sinDato={{ reason: tgr.motivo ?? "Información no disponible." }}
          />
        )}
      </section>

      {/* (2) Tabla calendario. */}
      <section aria-labelledby="v06-calendario" className="space-y-2">
        <h2
          id="v06-calendario"
          className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3"
        >
          Calendario tributario
        </h2>

        {filas.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-rediseno-hairline bg-rediseno-superficie px-6 py-8 text-center text-[13px] text-rediseno-tinta-2">
            Sin movimientos tributarios que mostrar todavía.
          </div>
        ) : (
          <TablaCalendario filas={filas} rojoKey={rojoKey} />
        )}
      </section>

      {/* Ley 9 — texto fijo literal del issue #73. */}
      <p className="text-[12.5px] leading-relaxed text-rediseno-tinta-3">
        <b className="font-semibold text-rediseno-tinta-2">{LEY_9_TEXTO_V06}.</b> No existe un botón
        para postergar un impuesto, una cotización ni un PPM en esta pantalla · ni siquiera la fila
        de IVA postergado, que sólo informa una postergación que ya hizo el SII.
      </p>

      <HuecosDeclarados />
    </div>
  );
}

/* ── Huecos declarados (issue #73): visibles EN la pantalla, no sólo en el PR ────────────────── */
function HuecosDeclarados() {
  return (
    <p className="pt-1 text-center text-[12px] text-rediseno-tinta-3-light">
      La declaración del F-29 y la verificación de su pago son estados distintos. Qavante todavía no
      puede vincular este F-29 con un movimiento bancario específico.
    </p>
  );
}

function DetalleEstimacionF29({ estimacion }: { estimacion: EstimacionF29V06 }) {
  return (
    <div className="space-y-1">
      {estimacion.desglose && (
        <p>
          IVA débito {formatClp(estimacion.desglose.ivaDebito)} · IVA crédito{" "}
          {formatClp(estimacion.desglose.ivaCredito)} · remanente{" "}
          {formatClp(estimacion.desglose.remanente)} · PPM {formatClp(estimacion.desglose.ppm)} ·
          trabajadores {formatClp(estimacion.desglose.impuestoTrabajadores)}
        </p>
      )}
      {estimacion.faltantes.length > 0 && (
        <p>Insumos faltantes · {estimacion.faltantes.join(" · ")}</p>
      )}
      <p>
        Evaluación · {formatDateTimeLike(estimacion.evaluadaEn)} · fuente{" "}
        {estimacion.fuentes.length > 0
          ? estimacion.fuentes
              .map(
                (fuente) =>
                  `${fuente.label} (${fuente.frescura}${
                    fuente.sincronizadaEn
                      ? ` · sincronizada ${formatDateTimeLike(fuente.sincronizadaEn)}`
                      : ""
                  })`,
              )
              .join(" · ")
          : "sin trazabilidad publicada"}
      </p>
    </div>
  );
}

/* ── (2) La tabla (§1.3 `.tw > table.t`, §5.5) ───────────────────────────────────────────────── */
function TablaCalendario({
  filas,
  rojoKey,
}: {
  filas: FilaCalendarioV06[];
  rojoKey: string | null;
}) {
  const columns = React.useMemo<ColumnDef<FilaCalendarioV06, unknown>[]>(
    () => [
      {
        id: "concepto",
        accessorFn: (f) => f.label,
        header: "Concepto",
        meta: { principal: true },
        cell: ({ row }) => {
          const f = row.original;
          const vence = f.vencimiento ? `Vence ${f.vencimientoLabel} · ` : "";
          return (
            <TablePrimaryCell
              value={f.label}
              sub={
                <span className="@max-[640px]:whitespace-normal">
                  {vence}
                  {f.sub}
                  {f.href && f.hrefLabel && (
                    <>
                      {" · "}
                      <Link href={f.href} className="font-semibold text-rediseno-azul">
                        {f.hrefLabel}
                      </Link>
                    </>
                  )}
                </span>
              }
            />
          );
        },
      },
      {
        id: "estado",
        accessorFn: (f) => ESTADO_LABEL_V06[f.estado],
        header: "Estado",
        enableSorting: false,
        meta: { hideBelowTable: "sm" },
        cell: ({ row }) => {
          const f = row.original;
          const tono = f.key === rojoKey ? "bad" : ESTADO_TONO_V06[f.estado];
          return <Pill variant={tono}>{ESTADO_LABEL_V06[f.estado]}</Pill>;
        },
      },
      {
        id: "monto",
        accessorFn: (f) => f.monto ?? Number.NEGATIVE_INFINITY,
        header: "Monto y moneda",
        meta: { align: "right" },
        cell: ({ row }) => {
          const f = row.original;
          return f.monto == null ? (
            <SinDato
              reason={f.motivoSinMonto ?? "Información no disponible."}
              label={`el monto de ${f.label}`}
              variant="compact"
            />
          ) : (
            <span className="tabular-nums">
              {f.moneda ? `${f.moneda} ${formatMoney(f.monto, f.moneda)}` : "sin dato"}
            </span>
          );
        },
      },
    ],
    [rojoKey],
  );

  return (
    <RedisenoTable
      columns={columns}
      data={filas}
      totalCount={filas.length}
      pageSize={25}
      countNoun={concordar(filas.length, "obligación tributaria", "obligaciones tributarias")}
      emptyMessage="Sin movimientos tributarios."
      onExport={() => descargarExcel("impuestos-calendario.xlsx", csvCalendarioV06Table(filas))}
      celdasCompactasEnAngosto
    />
  );
}

/** Exportar (§5.5): descarga Excel con celdas tipadas en el navegador (mismo patrón que
 *  `presupuesto-v09-view.tsx` / `gestion-v08-view.tsx`). Sólo corre en cliente. */
const descargarExcel = downloadXlsx;
