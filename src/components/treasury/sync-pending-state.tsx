import { Info, RefreshCw } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
// Predicados puros (unit-testeables) extraídos a un .ts hermano; se re-exportan acá para
// no romper los imports existentes (`import { isSyncPending } from ".../sync-pending-state"`).
export { isSyncPending, isPartial } from "./sync-pending-state.logic";

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
  // "partial" con una fuente concreta NO es "sin credenciales" (#854): si el backend dice QUÉ falta,
  // lo decimos tal cual y no culpamos al SII ni mandamos a "conectar" algo que quizá ya está conectado.
  // Solo cuando no sabemos qué falta caemos al genérico "sincroniza el SII".
  const falta = missingSources && missingSources.length > 0 ? missingSources.join(" · ") : null;
  return (
    <QavanteCard variant="bordered" className="border-info-500/30 bg-info-500/5">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 flex-shrink-0 text-info-500" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-neutral-dark">
            {falta
              ? `Falta una fuente para ver ${what}.`
              : `Sincroniza tus datos del SII para ver ${what}.`}
          </p>
          <p className="text-sm text-neutral-mid">
            {falta ? (
              <>
                Pendiente: <span className="font-medium text-neutral-dark">{falta}</span>. En cuanto
                llegue, esto se completa solo.
              </>
            ) : (
              "Todavía no sincronizamos tus documentos del SII. Ve a Credenciales y presiona «Sincronizar SII»."
            )}
          </p>
          <a
            href="/administracion/credenciales"
            className="inline-block pt-1 text-sm font-medium text-brand-primary hover:underline"
          >
            {falta ? "Revisar en Credenciales →" : "Ir a Credenciales →"}
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
        {missingSources && missingSources.length > 0 ? `: ${missingSources.join(" · ")}` : ""}. Se
        completan cuando el SII entregue las fechas de vencimiento.
      </p>
    </div>
  );
}
