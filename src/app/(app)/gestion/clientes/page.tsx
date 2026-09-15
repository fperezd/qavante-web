import { Users } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { redirect } from "next/navigation";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { destinoRutaVieja } from "@/components/gestion/v08/gestion-v08-model";
import { Contraparte360View, type Config360 } from "@/components/gestion/v2/contraparte-360-view";

/* Gestión → Clientes 360 (pedido de Fernando 2026-07-30): comportamiento comercial de un cliente en
   el tiempo. Gated `operationalResult` (ON en prod, coherente con Gestión); los datos salen del RCV
   ventas y la vista degrada sola. Sin `export const runtime` (regla 4). */
const CONFIG: Config360 = {
  kind: "ventas",
  contraparte: "cliente",
  contrapartes: "clientes",
  flujo: "Ventas",
  verbo: "le vendes a",
  delTotal: "de tus ventas",
};

export default function Page() {
  const { operationalResult, gestionV08 } = resolveFeatureFlags();

  /* V08 · Gestión (#72): con `gestionV08` ENCENDIDO esta página deja de existir por su cuenta —
     su contenido vive como la tab Clientes 360 de `/gestion`. Se redirige en vez de dejar dos
     copias vivas del mismo número (Ley 1: un concepto, un lugar). Con el flag APAGADO, la página
     de siempre queda intacta → cero regresión. */
  if (gestionV08) redirect(destinoRutaVieja("/gestion/clientes")!);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Clientes 360</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Revisa las ventas observadas, la concentración y la actividad reciente de cada cliente.
        </p>
      </header>

      {operationalResult ? (
        <Contraparte360View config={CONFIG} />
      ) : (
        <QavanteEmpty icon={Users} title="Clientes 360" description="Muy pronto disponible." />
      )}
    </div>
  );
}
