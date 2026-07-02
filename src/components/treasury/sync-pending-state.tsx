import { Info, RefreshCw } from "lucide-react";
import { QavanteCard } from "@/components/qavante";

/* Vacío HONESTO de tesorería. Cuando el devengado está vacío porque falta
 * sincronizar el SII, el backend devuelve `data_state:"partial"` +
 * `missing_sources` (ADR-0055 F1). En vez de decir "no tienes deuda" (falso),
 * mostramos que falta sincronizar, con el CTA para hacerlo. */

export function SyncPendingState({
  missingSources,
  what,
}: {
  /** Motivos que devuelve el backend (ej. "Sincronización SII pendiente"). */
  missingSources?: string[];
  /** Qué se vería una vez sincronizado (ej. "tus cuentas por cobrar"). */
  what: string;
}) {
  return (
    <QavanteCard variant="bordered" className="border-info-500/30 bg-info-500/5">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 flex-shrink-0 text-info-500" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-neutral-dark">
            Sincroniza tus datos del SII para ver {what}.
          </p>
          <p className="text-sm text-neutral-mid">
            {missingSources && missingSources.length > 0
              ? missingSources.join(" · ")
              : "Todavía no sincronizamos tus documentos del SII."}{" "}
            Ve a Credenciales y presiona «Sincronizar SII».
          </p>
          <a
            href="/administracion/credenciales"
            className="inline-block pt-1 text-sm font-medium text-brand-primary hover:underline"
          >
            Ir a Credenciales →
          </a>
        </div>
      </div>
    </QavanteCard>
  );
}

/* Banner de DATOS PARCIALES: hay montos, pero el dato no está completo (ej. el
 * RCV no trae fecha de vencimiento → el aging/vencidos no es confiable todavía).
 * Se muestra ARRIBA de los datos para no engañar con un aging incompleto. */
export function PartialDataBanner({ missingSources }: { missingSources?: string[] }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-warning-500/30 bg-warning-500/5 p-3 text-sm text-neutral-dark"
    >
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-700" aria-hidden="true" />
      <p>
        <span className="font-medium">Datos parciales.</span> Los montos son correctos, pero los
        vencimientos (antigüedad de saldos) todavía no están disponibles
        {missingSources && missingSources.length > 0 ? ` — ${missingSources.join(" · ")}` : ""}. Se
        completan cuando el SII entregue las fechas de vencimiento.
      </p>
    </div>
  );
}

/** ¿El dato viene incompleto (falta sincronizar)? — para decidir entre el vacío
 *  honesto y el "no tienes deuda" real. */
export function isSyncPending(d: {
  data_state?: string;
  missing_sources?: string[] | null;
}): boolean {
  return (d.data_state != null && d.data_state !== "available") || (d.missing_sources?.length ?? 0) > 0;
}

/** ¿Hay datos pero incompletos (montos ok, vencimientos no)? */
export function isPartial(d: { data_state?: string }): boolean {
  return d.data_state != null && d.data_state !== "available";
}
