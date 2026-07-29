"use client";

import { Landmark, Download, TriangleAlert } from "lucide-react";
import { QavanteBadge, QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { stickyScroll, stickyHead } from "@/components/table/sticky-table";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import {
  useTgrHealth,
  useTgrMovimientosDeudas,
  tgrCertificadoDeudasUrl,
  type TgrMovimiento,
} from "@/lib/api/tgr";
import { formularioLabelTgr } from "./tgr-format";

/* Deudas TGR (Fase 3, pedido de Fernando). Consume `/api/tgr/health` +
   `/movimientos-deudas`. Mientras el backend alimente TGR desde un helper LOCAL
   (no server-side, escalado api#758), `authenticated` es false para todo tenant
   → mostramos un estado HONESTO "en preparación" (NADA de pedirle al usuario que
   corra algo local). Cuando TGR sea server-side y haya sesión, muestra la deuda
   total + los movimientos + el certificado PDF. */

function EstadoBadge({ estado }: { estado?: string | null }) {
  if (estado === "credito") return <QavanteBadge variant="success">Crédito a favor</QavanteBadge>;
  if (estado === "pagada") return <QavanteBadge variant="default">Pagada</QavanteBadge>;
  return <QavanteBadge variant="danger">Deuda</QavanteBadge>;
}

export function DeudasTgrView() {
  const health = useTgrHealth();
  const authenticated = health.data?.authenticated === true;
  const deudas = useTgrMovimientosDeudas(authenticated);
  const certUrl = tgrCertificadoDeudasUrl();

  if (health.isError) {
    return <QavanteInlineError error={health.error} what="el estado de TGR" />;
  }
  if (health.isLoading) {
    return (
      <div
        className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Consultando TGR"
      />
    );
  }

  // Sin sesión TGR → estado honesto "en preparación". NO le pedimos al usuario que
  // corra nada local: el sync server-side es del backend (api#758).
  if (!authenticated) {
    return (
      <QavanteEmpty
        icon={Landmark}
        title="TGR — en preparación"
        description="Cuando conectemos la Tesorería (TGR) vas a ver acá tus deudas fiscales: giros, multas, PPM e IVA impago, con su saldo y vencimiento, y el certificado de deudas en PDF. Estamos habilitando la conexión."
      />
    );
  }

  if (deudas.isError) {
    return <QavanteInlineError error={deudas.error} what="tus deudas fiscales (TGR)" />;
  }
  if (deudas.isLoading || !deudas.data) {
    return (
      <div
        className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando deudas TGR"
      />
    );
  }

  const movimientos: TgrMovimiento[] = deudas.data.movimientos ?? [];
  const deudaTotal = deudas.data.deuda_total ?? 0;
  const conDeuda = movimientos.filter((m) => (m.saldo ?? 0) > 0);

  if (conDeuda.length === 0) {
    return (
      <QavanteEmpty
        icon={Landmark}
        title="Sin deudas con la Tesorería"
        description="No registras deudas fiscales vigentes en la TGR. Si aparece un giro o multa nueva, lo vas a ver acá."
      />
    );
  }

  return (
    <div className="space-y-3">
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-medium">
              <TriangleAlert className="h-4 w-4 text-danger-500" aria-hidden="true" />
              Deuda con la Tesorería
            </span>
            {certUrl && (
              <a
                href={certUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-neutral-dark transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Certificado de deudas (PDF)
              </a>
            )}
          </div>
        }
      >
        <p className="text-3xl font-bold tabular-nums text-danger-500">{formatClp(deudaTotal)}</p>
        <p className="mt-1 text-sm text-neutral-mid">
          {conDeuda.length} {conDeuda.length === 1 ? "giro/deuda" : "giros/deudas"} vigente
          {conDeuda.length === 1 ? "" : "s"}.
        </p>

        <div className={"mt-3 " + stickyScroll}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className={stickyHead}>
              <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Concepto
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Folio
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Vence
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Saldo
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {conDeuda.map((m, i) => (
                <tr
                  key={`${m.folio ?? "x"}-${i}`}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="py-2 pr-3 text-neutral-dark">
                    {formularioLabelTgr(m.formulario)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-mid">{m.folio ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-mid">
                    {formatDateLike(m.fecha_vencimiento)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium text-neutral-dark">
                    {formatClp(m.saldo ?? 0)}
                  </td>
                  <td className="py-2">
                    <EstadoBadge estado={m.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QavanteCard>

      <p className="text-xs text-neutral-mid">
        Fuente: Tesorería General de la República (TGR). El pago se realiza en tgr.cl.
      </p>
    </div>
  );
}
