import { Truck } from "lucide-react";
import { QavanteEmpty } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { Contraparte360View, type Config360 } from "@/components/gestion/v2/contraparte-360-view";

/* Gestión → Proveedores 360 (pedido de Fernando 2026-07-30, simétrico al de clientes): comportamiento
   de compra con un proveedor en el tiempo. Reusa el modelo/vista config-driven del 360. Gated
   `operationalResult` (ON en prod); datos del RCV compras. Sin `export const runtime` (regla 4). */
const CONFIG: Config360 = {
  kind: "compras",
  contraparte: "proveedor",
  contrapartes: "proveedores",
  flujo: "Compras",
  verbo: "le compras a",
  delTotal: "de tus compras",
};

export default function Page() {
  const { operationalResult } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Proveedores 360</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Cómo se comporta cada proveedor en el tiempo: compra, tendencia, estacionalidad y riesgo.
        </p>
      </header>

      {operationalResult ? (
        <Contraparte360View config={CONFIG} />
      ) : (
        <QavanteEmpty icon={Truck} title="Proveedores 360" description="Muy pronto disponible." />
      )}
    </div>
  );
}
