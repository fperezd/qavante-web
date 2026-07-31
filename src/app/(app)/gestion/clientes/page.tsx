import { Users } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
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
  const { operationalResult } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Clientes 360</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Cómo se comporta cada cliente en el tiempo: venta, tendencia, estacionalidad y riesgo.
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
