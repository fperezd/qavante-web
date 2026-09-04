"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Info } from "lucide-react";
import type { PayrollTotales } from "@/lib/api/buk";
import { concordar } from "@/lib/formatters/count";
import { formatClp } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import { formatDateShort } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { DataState } from "@/components/rediseno/data-state";
import { KpiCard } from "@/components/rediseno/kpi-card";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import { LEY_9_TEXTO } from "@/components/pagar/v05/pagar-v05-model";
import type { EmployeePayroll } from "../payroll-detalle";
import type { BankDebitLike } from "../payroll-conciliacion";
import {
  ESTADO_LABEL,
  personasProtegidas,
  personasV16,
  resumenPersonas,
  triadaV16,
  type EstadoPersonaV16,
  type PersonaV16,
} from "./remuneraciones-v16-model";

/* V16 · Remuneraciones — "Tu nómina" (rediseño Fase 2, issue #77, ESPECIFICACION §V16).
 *
 * PRESENTACIONAL, como `pagar-v05-view.tsx`: entran las respuestas ya resueltas (planilla,
 * detalle por persona, movimientos del banco, ingresos del período), sale una pantalla. El
 * cableado de hooks vive en `remuneraciones-v16-live.tsx`.
 *
 * LEY 1 — "Cotizaciones" es la MISMA cifra (`totales.total_cotizaciones`) que ya publica el
 * bucket Previred de Pagar (`previred-view.tsx`): una fuente, un número.
 *
 * TRAMPA #1 (doble conteo) — "Costo empresa" viene de `triadaV16` (modelo puro), que la calcula
 * como la suma del `costo_empresa` por persona que BUK ya entrega, NUNCA como
 * líquido + cotizaciones. Ver la cabecera de `remuneraciones-v16-model.ts` para el razonamiento
 * completo y `remuneraciones-v16-model.test.ts` para la guarda.
 *
 * LEY 2 — cero rojo en toda la pantalla: "Pendiente" (una persona sin débito calzado todavía)
 * es ámbar/neutro, nunca alarma. `ESTADO_LABEL` tiene un solo set cerrado de 3 estados y ninguno
 * usa el token `danger-`/`rediseno-rojo`.
 *
 * LEY 9 — el footer lleva el texto FIJO literal (`LEY_9_TEXTO`, reusado de `pagar-v05-model.ts`,
 * no retipeado): los sueldos jamás entran en postergaciones automáticas. No hay ningún botón de
 * "postergar" ni "pagar todo" en esta pantalla. */

export interface RemuneracionesV16ViewProps {
  periodo: string;
  /** `GET /api/buk/payroll?period=`. `undefined` = sin respuesta todavía o el período no trajo
   *  planilla — la vista no distingue los dos casos salvo por `payrollError`. */
  totales: PayrollTotales | undefined;
  /** Presente cuando la consulta de planilla falló (red/backend). `totales` se ignora. */
  payrollError?: string | null;
  onReintentar?: () => void;
  /** Detalle por persona (ADR-0057, owner-only). [] si no vino. */
  detalle: EmployeePayroll[];
  /** El detalle vino 403: "solo para el dueño", no "sin dato". */
  detalleForbidden?: boolean;
  /** Movimientos del banco del período, para el cruce de estado. `null` = todavía no se
   *  consultaron (o fallaron): el estado de CADA persona queda "No verificado", nunca
   *  "Pendiente" (eso afirmaría algo que no se sabe). */
  movimientos: BankDebitLike[] | null;
  /** Ingresos del período (`GET /api/management/operational-result`, campo `revenue`). `null` =
   *  sin dato: el % de ingresos de "Costo empresa" queda "no disponible", nunca 0%. */
  revenue: number | null;
}

export function RemuneracionesV16View({
  periodo,
  totales,
  payrollError,
  onReintentar,
  detalle,
  detalleForbidden = false,
  movimientos,
  revenue,
}: RemuneracionesV16ViewProps) {
  const triada = React.useMemo(
    () => triadaV16(periodo, totales, detalle, revenue),
    [periodo, totales, detalle, revenue],
  );
  const personas = React.useMemo(
    () => personasV16(detalle, movimientos, periodo),
    [detalle, movimientos, periodo],
  );
  const resumen = resumenPersonas(personas);
  const protegidos = triada ? personasProtegidas(triada, personas.length) : 0;
  const periodoLabel = formatPeriodLabel(periodo);

  if (payrollError) {
    return (
      <DataState
        status="error"
        what="la planilla de remuneraciones"
        cause={payrollError}
        action={
          onReintentar
            ? { label: "Reintentar", onClick: onReintentar }
            : { label: "Revisar conexiones", href: "/conexiones" }
        }
      />
    );
  }

  if (!triada) {
    return (
      <DataState
        status="empty"
        what={`planilla de ${periodoLabel}`}
        hint="No hay totales de remuneraciones para este mes. Si acabas de conectar BUK, prueba con el mes anterior."
        action={{ label: "Ver Remuneraciones (todos los períodos)", href: "/remuneraciones" }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-rediseno-tinta-3">
        La nómina como vista propia dentro de Pagar: líquidos, cotizaciones y su estado, conectada a
        Previred.
      </p>

      {/* (1) Tríada: Líquido / Cotizaciones / Costo empresa con % de ingresos ⓘ. */}
      <section
        aria-label="Líquido, cotizaciones y costo empresa"
        className="grid gap-3 sm:grid-cols-3"
      >
        <KpiCard
          label={`Líquido de ${periodoLabel}`}
          value={formatClp(triada.liquido)}
          detail={liquidoDetalleTexto(resumen, protegidos)}
        />

        {triada.cotizaciones != null ? (
          <KpiCard
            label="Cotizaciones (Previred)"
            value={formatClp(triada.cotizaciones)}
            detail={
              triada.cotizacionesVencimiento
                ? `vence el ${formatDateShort(triada.cotizacionesVencimiento)}`
                : "sin fecha de vencimiento"
            }
          />
        ) : (
          <KpiCard
            label="Cotizaciones (Previred)"
            sinDato={{
              reason: "El conector de Remuneraciones no trajo las cotizaciones de este período.",
            }}
          />
        )}

        {triada.costoEmpresa != null ? (
          <KpiCard
            label="Costo empresa total"
            value={formatClp(triada.costoEmpresa)}
            detail={
              <>
                {triada.costoEmpresaPctIngresos != null ? (
                  <>{formatPct(triada.costoEmpresaPctIngresos)} de tus ingresos</>
                ) : (
                  "% de ingresos no disponible este mes"
                )}{" "}
                <InfoPopover />
              </>
            }
          />
        ) : (
          <KpiCard
            label="Costo empresa total"
            sinDato={{
              reason: detalleForbidden
                ? "El costo por persona es visible solo para el dueño de la cuenta."
                : "El conector no trae el detalle por persona este período: sin eso no se puede sumar el costo empresa.",
            }}
          />
        )}
      </section>

      {/* (2) Tabla por persona: estado + link a la liquidación. */}
      <section aria-labelledby="v16-personas" className="space-y-2">
        <h2
          id="v16-personas"
          className="font-rediseno-mono text-[11px] font-semibold uppercase tracking-[.12em] text-rediseno-tinta-3"
        >
          Personas
        </h2>

        {personas.length === 0 ? (
          <DataState
            status="empty"
            what="el detalle por persona"
            hint={
              detalleForbidden
                ? "El detalle por persona (líquido individual) es visible solo para el dueño de la cuenta."
                : "El conector todavía no trae el líquido por persona de este período."
            }
          />
        ) : (
          <TablaPersonas personas={personas} periodoLabel={periodoLabel} />
        )}

        {/* Footer §5.5 (resumen) + Ley 9 (texto fijo, literal). */}
        <p className="text-[12.5px] leading-relaxed text-rediseno-tinta-3">
          {footerConciliacionTexto(resumen) && <>{footerConciliacionTexto(resumen)}. </>}
          <b className="font-semibold text-rediseno-tinta-2">{LEY_9_TEXTO}</b> No existe un botón
          para postergar ni para &quot;pagar todo&quot; en esta pantalla.
        </p>
      </section>
    </div>
  );
}

/* ── Detalle "Líquido": conteo de conciliación en lenguaje de progreso (Ley 2, nunca alarma) ──
 * Construidos como STRING (no JSX intercalado) a propósito: la concordancia singular/plural es
 * plata legible, y un espacio perdido/duplicado por colapso de JSX ya mordió a este repo cuatro
 * veces ("Los 1 proveedores", issue #94). Un string se testea con `toContain` sin ambigüedad. */
function resumenPagoLabel(r: ReturnType<typeof resumenPersonas>): string {
  if (r.sinVerificar === r.total) return "estado del banco no verificado";
  if (r.pagados === r.total) return "pagado ✓";
  return `${r.pagados} de ${r.total} pagados`;
}

function liquidoDetalleTexto(
  resumen: ReturnType<typeof resumenPersonas>,
  protegidos: number,
): string {
  const partes = [`${resumen.total} ${concordar(resumen.total, "persona", "personas")}`];
  if (resumen.total > 0) partes.push(resumenPagoLabel(resumen));
  if (protegidos > 0) {
    partes.push(
      `${protegidos} ${concordar(protegidos, "protegido", "protegidos")} más (no visibles en el detalle)`,
    );
  }
  return partes.join(" · ");
}

/** `null` cuando no hay a quién conciliar (footer sin esa cláusula). */
function footerConciliacionTexto(resumen: ReturnType<typeof resumenPersonas>): string | null {
  if (resumen.total === 0) return null;
  const base = `${resumen.pagados} de ${resumen.total} ${concordar(
    resumen.total,
    "persona conciliada",
    "personas conciliadas",
  )} con el cargo de nómina del banco`;
  return resumen.sinVerificar > 0
    ? `${base} · ${resumen.sinVerificar} sin verificar (no se pudo leer la cartola del período)`
    : base;
}

/* ── ⓘ "% de ingresos" (§1.4: definición + fuente) ────────────────────────────────────────── */
function InfoPopover() {
  return (
    <details className="group relative inline-block align-middle">
      <summary
        className="inline-flex cursor-pointer list-none items-center text-rediseno-tinta-3-light hover:text-rediseno-tinta-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul [&::-webkit-details-marker]:hidden"
        aria-label="Qué es % de ingresos"
      >
        <Info className="size-3.5" aria-hidden />
      </summary>
      <div className="absolute top-full left-0 z-40 mt-1.5 w-[min(20rem,80vw)] rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-3 text-left text-[12.5px] leading-relaxed font-normal text-rediseno-tinta-2 normal-case tracking-normal shadow-lg">
        <p className="font-semibold text-rediseno-tinta">
          Costo empresa del mes dividido por tus ingresos del mismo mes.
        </p>
        <p className="mt-2">
          Costo empresa es líquido + leyes sociales de cada persona (lo suma BUK); no incluye las
          cotizaciones de Previred otra vez · ya están dentro del costo de cada persona.
        </p>
        <p className="mt-2">
          <span className="font-rediseno-mono text-[10px] uppercase tracking-[.1em] text-rediseno-tinta-3">
            Fuente
          </span>{" "}
          <span className="font-rediseno-mono text-[11px]">
            GET /api/buk/payroll/detail (costo por persona) · GET /api/management/operational-result
            (ingresos)
          </span>
        </p>
      </div>
    </details>
  );
}

/* ── (2) La tabla (§1.3 `.tw > table.t`, §5.5) ───────────────────────────────────────────────── */

const ESTADO_VARIANT: Record<EstadoPersonaV16, "ok" | "warn" | "mut"> = {
  pagado: "ok",
  pendiente: "warn",
  sin_verificar: "mut",
};

function TablaPersonas({
  personas,
  periodoLabel,
}: {
  personas: PersonaV16[];
  periodoLabel: string;
}) {
  const columns = React.useMemo<ColumnDef<PersonaV16, unknown>[]>(
    () => [
      {
        id: "persona",
        accessorFn: (p) => p.nombre,
        header: "Persona",
        meta: { principal: true },
        cell: ({ row }) => (
          <TablePrimaryCell
            value={row.original.nombre}
            sub={row.original.rut ? formatRut(row.original.rut) : undefined}
          />
        ),
      },
      {
        id: "estado",
        accessorFn: (p) => ESTADO_LABEL[p.estado],
        header: "Estado",
        /* Ley 7 / §5.2 (hallazgo del pase §6, PR #97): la tabla desbordaba 122 px un contenedor de
           360 — "Estado" y "liquidación" son metadato (accesorio), nunca la persona ni su líquido
           (el dato primario, columna `principal` + el monto, jamás colapsan). `hideBelowTable` y
           no `hideBelow`: se mide contra el ancho de la TABLA, igual que `cobrar-v04` — la vista
           puede vivir embebida en un contenedor angosto aunque la ventana sea ancha. */
        meta: { hideBelowTable: "sm" },
        cell: ({ row }) => (
          <Pill variant={ESTADO_VARIANT[row.original.estado]}>
            {ESTADO_LABEL[row.original.estado]}
          </Pill>
        ),
      },
      {
        id: "liquido",
        accessorFn: (p) => p.liquido ?? -1,
        header: `Líquido ${periodoLabel}`,
        meta: { align: "right" },
        cell: ({ row }) => (row.original.liquido != null ? formatClp(row.original.liquido) : "s/d"),
      },
      {
        id: "liquidacion",
        header: "",
        enableSorting: false,
        meta: { align: "right", hideBelowTable: "sm" },
        cell: ({ row }) => (
          <Link
            href={row.original.href}
            className="font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded"
          >
            liquidación
          </Link>
        ),
      },
    ],
    [periodoLabel],
  );

  return (
    <RedisenoTable
      columns={columns}
      data={personas}
      totalCount={personas.length}
      pageSize={25}
      countNoun={concordar(personas.length, "persona", "personas")}
      emptyMessage="Sin personas en este período."
    />
  );
}
