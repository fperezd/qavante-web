"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import { movimientos, type CartolaMovimiento } from "./cartola-v2-fixtures";

/* Movimientos "card-row" (como la grilla de la banca) CON fila expandible: al
 * hacer clic, la fila se abre y muestra el detalle + el seguimiento (timeline) del
 * ciclo de vida del movimiento — detectado → categorizado → conciliado. Para listas
 * cortas/medias (movimientos, transferencias); el Libro sigue con tabla densa. */

const COLS = "grid-cols-[92px_84px_1fr_140px_120px_28px]";

/** Categoría de gestión de ejemplo, derivada de la descripción. */
function categoriaDe(m: CartolaMovimiento): string {
  const d = m.descripcion.toLowerCase();
  if (d.includes("f29") || d.includes("iva") || d.includes("impuesto")) return "Impuestos";
  if (d.includes("previred") || d.includes("cotizac")) return "Remuneraciones";
  if (d.includes("tarjeta")) return "Tarjeta de crédito";
  if (d.includes("sobregiro") || d.includes("interes")) return "Gastos financieros";
  if (m.tipo === "Abono") return "Cobranza";
  return "Proveedores";
}

/** Seguimiento (ciclo de vida) de ejemplo para un movimiento. */
function seguimiento(m: CartolaMovimiento): TimelineStep[] {
  const conciliado = m.tipo === "Abono";
  return [
    {
      status: "done",
      title: "Detectado en tu banco",
      children: (
        <>
          {m.fecha} · saldo contable{" "}
          <span className="tabular-nums text-neutral-dark">{formatClp(m.saldo)}</span>
        </>
      ),
    },
    {
      status: "done",
      title: "Categoría sugerida",
      children: (
        <>
          Qavante sugirió <b className="font-semibold text-neutral-dark">{categoriaDe(m)}</b> ·
          confianza alta
        </>
      ),
    },
    conciliado
      ? {
          status: "done",
          title: "Conciliado",
          children: "Cruzado con tu contabilidad — nada por revisar.",
        }
      : {
          status: "current",
          title: "Pendiente de conciliar",
          children: "Falta cruzarlo con una factura o clasificarlo.",
        },
  ];
}

function MontoCell({ m }: { m: CartolaMovimiento }) {
  const out = m.monto < 0;
  const Icon = out ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 tabular-nums font-semibold",
        out ? "text-danger-500" : "text-success-700",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {formatClp(m.monto)}
    </span>
  );
}

function DatoLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="text-xs text-neutral-mid">{label}</span>
      <span className="text-right text-sm text-neutral-dark">{children}</span>
    </div>
  );
}

export function MovimientosGrid() {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div
        className={cn(
          "grid items-center gap-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid",
          COLS,
        )}
      >
        <span>Fecha</span>
        <span>Tipo</span>
        <span>Descripción</span>
        <span className="text-right">Monto</span>
        <span className="text-right">Saldo</span>
        <span className="sr-only">Detalle</span>
      </div>

      <ul className="space-y-2">
        {movimientos.map((m, i) => {
          const isOpen = open === i;
          return (
            <li
              key={i}
              className={cn(
                "overflow-hidden rounded-xl border bg-surface shadow-sm transition-colors",
                isOpen ? "border-brand-primary/40" : "border-border hover:border-brand-primary/40",
              )}
            >
              {/* Fila (clickable, abre/cierra) */}
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className={cn(
                  "grid w-full items-center gap-3 px-4 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                  COLS,
                )}
              >
                <span className="text-neutral-mid">{m.fecha}</span>
                <span>
                  <QavanteBadge variant={m.tipo === "Cargo" ? "warning" : "success"}>
                    {m.tipo}
                  </QavanteBadge>
                </span>
                <span className="min-w-0 truncate text-neutral-dark" title={m.descripcion}>
                  {m.descripcion}
                </span>
                <span className="text-right">
                  <MontoCell m={m} />
                </span>
                <span className="text-right tabular-nums text-neutral-mid">
                  {formatClp(m.saldo)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 justify-self-end text-neutral-mid transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>

              {/* Detalle expandible: datos + seguimiento */}
              {isOpen && (
                <div className="grid gap-6 border-t border-border bg-surface-muted/40 px-5 py-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-neutral-dark">
                      Datos del movimiento
                    </p>
                    <DatoLine label="Descripción">{m.descripcion}</DatoLine>
                    <DatoLine label="Tipo">{m.tipo}</DatoLine>
                    <DatoLine label="Categoría de gestión">{categoriaDe(m)}</DatoLine>
                    <DatoLine label="Monto">
                      <MontoCell m={m} />
                    </DatoLine>
                    <DatoLine label="Saldo resultante">
                      <span className="tabular-nums">{formatClp(m.saldo)}</span>
                    </DatoLine>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold text-neutral-dark">Seguimiento</p>
                    <Timeline steps={seguimiento(m)} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
