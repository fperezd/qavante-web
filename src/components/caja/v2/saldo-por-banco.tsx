import * as React from "react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* SaldoPorBanco — el saldo de hoy resumido POR BANCO (no por cuenta), para que escale a
   muchas cuentas: una empresa puede tener 4 bancos y 10 cuentas. Presentacional; cada
   banco es clickeable → su cartola/cuentas (regla: todo dato lleva a su detalle). El
   detalle por cuenta (con CLP/USD) vive en la pestaña "Cuentas". */

export interface BancoSaldo {
  banco: string;
  saldo: number;
  /** Sub-línea (ej. "3 cuentas · CLP + USD"). */
  detalle?: string;
  onClick?: () => void;
}

export interface SaldoPorBancoProps {
  titulo?: string;
  bancos: BancoSaldo[];
  /** Total consolidado (en CLP). */
  total: number;
  /** Etiqueta del total (ej. "Total · 4 bancos"). */
  totalLabel?: string;
  /** Aviso al pie (ej. "Conectá tu banco para ver el saldo por cuenta") cuando degrada. */
  nota?: React.ReactNode;
  className?: string;
}

export function SaldoPorBanco({
  titulo = "Saldo por banco",
  bancos,
  total,
  totalLabel = "Total",
  nota,
  className,
}: SaldoPorBancoProps) {
  return (
    <div className={cn("p-5", className)}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">{titulo}</p>
      <ul className="mt-1.5">
        {bancos.map((b, i) => (
          <li key={`${b.banco}-${i}`}>
            <button
              type="button"
              onClick={b.onClick}
              className={cn(
                "group flex w-full items-baseline justify-between gap-3 rounded-lg py-1.5 pl-1 pr-1.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                i > 0 && "border-t border-dashed border-border",
              )}
            >
              <span className="min-w-0">
                <span className="text-[12.5px] font-semibold text-neutral-dark">{b.banco}</span>
                {b.detalle && <span className="block text-[11px] text-neutral-light">{b.detalle}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-[14px] font-bold tabular-nums text-neutral-dark">{formatClp(b.saldo)}</span>
                <ChevronRight className="size-4 text-neutral-light group-hover:text-brand-primary" aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-dashed border-border py-1.5 pl-1">
        <span className="text-[12.5px] text-neutral-mid">{totalLabel}</span>
        <span className="text-[14px] font-bold tabular-nums text-neutral-dark">{formatClp(total)}</span>
      </div>
      {nota && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-primary">
          <Plus className="size-3.5" aria-hidden="true" />
          {nota}
        </p>
      )}
    </div>
  );
}
