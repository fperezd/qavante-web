import { PayrollSystemSettingsView } from "@/components/remuneraciones/payroll-system-settings-view";

/* `/administracion/remuneraciones` — con qué sistema paga sueldos cada empresa
   (CC-API ADR-0122). Sin flag: la decisión del dueño (2026-10-01) es que la empresa
   SIEMPRE pueda declararlo y cambiarlo cuando cambia de sistema, y mientras nadie lo
   declara Qavante sigue suponiendo BUK — esconder la pantalla detrás de un flag
   dejaría ese supuesto sin forma de corregirlo. Server Component, sin
   `export const runtime` (regla 4). */
export default function RemuneracionesSistemaPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Sistema de remuneraciones</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Declara con qué sistema pagas tus sueldos y Qavante actúa según eso. Es por empresa: una
          puede usar BUK y otra subir su nómina a mano.
        </p>
      </header>

      <PayrollSystemSettingsView />
    </div>
  );
}
