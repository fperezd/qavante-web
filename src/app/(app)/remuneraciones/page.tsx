import { Users } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { RemuneracionesView } from "@/components/remuneraciones/remuneraciones-view";
import { RemuneracionesV16Live } from "@/components/remuneraciones/v16/remuneraciones-v16-live";

/* `/remuneraciones` — sección de Remuneraciones (RRHH / planilla) sobre el
   conector BUK. Dotación de empleados + totales de planilla del período.

   **Server Component** (como inicio/caja/mi-cuenta): resuelve los flags en runtime del Worker.
   NO lleva "use client": el lookup de flag usa una key computada (`NEXT_PUBLIC_FF_*`) que
   Next.js NO inlinea en el cliente → daría OFF siempre. Los Live/View son Client Components que
   consumen los datos.

   DECISIÓN DE RUTA (issue #77): la ESPECIFICACION ubica V16 en `/pagar/remuneraciones`; esta
   página se queda en `/remuneraciones` (primer nivel) — la spec manda en LÓGICA, la ruta es
   detalle, y acá conservar gana: (1) Remuneraciones YA está anidada bajo "Pagar" en la
   navegación real (`src/components/shell/sidebar.tsx`, sub-ítem de Pagar) — mover sería un
   cambio de URL cosmético, no de jerarquía; (2) al menos dos vistas YA mergeadas hard-codean
   `/remuneraciones` como destino (`hrefDe` de `pagar-v05-model.ts` para la fila "Remuneraciones"
   de Pagar, y el widget "Remuneraciones" de Inicio en `inicio/v2/remuneraciones-live.tsx`):
   moverla exigiría tocar esas dos vistas sin ganancia funcional y con riesgo real de romper un
   link en producción; (3) la regla dura de esta tarea es "no rompas la ruta vieja" — quedarse
   cumple eso por construcción, mover con redirect lo cumpliría también pero a cambio de una
   migración de rutas que ningún issue pidió. Divergencia declarada, no un olvido.

   V16 (flag `remuneracionesV16`, OFF por defecto) reemplaza la landing entera con la vista de
   la spec: tríada Líquido/Cotizaciones/Costo empresa + tabla por persona. Con el flag OFF, las
   4 pestañas clásicas (Dotación/Planilla/Clasificación/Conciliación) quedan intactas → cero
   regresión — el patrón exacto de `pagarV05`/`gestionV08`. */
export default async function RemuneracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { remuneraciones, remuneracionesV16, payrollReconcileBoard } = resolveFeatureFlags();
  // Deep-link desde Pagar (ítem de nómina → su período). Solo YYYY-MM válido.
  const { period } = await searchParams;
  const initialPeriod = period && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : undefined;

  if (remuneracionesV16) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-rediseno-serif text-[28px] font-medium text-rediseno-tinta">
            Tu nómina
          </h1>
        </header>
        <RemuneracionesV16Live />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Remuneraciones</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Tu dotación de empleados y los totales de la planilla del mes.
        </p>
      </header>

      {remuneraciones ? (
        <RemuneracionesView
          initialPeriod={initialPeriod}
          reconcileBoardEnabled={payrollReconcileBoard}
        />
      ) : (
        <QavanteEmpty
          icon={Users}
          title="Remuneraciones: disponible pronto"
          description="Aquí vas a ver la dotación de empleados y los totales de la planilla del conector de Remuneraciones. Se habilita cuando se active la sección."
        />
      )}
    </div>
  );
}
