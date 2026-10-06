import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SaludContratoLive } from "@/components/gestion/salud/salud-contrato-live";

/* Salud (PULSO + Qavante Health Score, ADR-0064). **Server Component**.

   La pantalla consume el contrato canónico `GET /api/management/salud`: snapshots persistidos
   de los dos instrumentos bajo el mismo scope financiero (sociedad, moneda y fecha de corte,
   los tres explícitos y resueltos en el servidor).

   Regla de honestidad de datos (HYGIENE_SWEEP V7): dato faltante ≠ dato demo. Acá no hubo
   números mientras no existió el motor; ahora existe, y la pantalla muestra lo que el contrato
   publica, nada más. Cuando no trae uno de los dos instrumentos, se dice con NÚMERO cuánto
   cubre la lectura: no se fabrica un puntaje, no se muestra un cero y no se pinta una
   clasificación por defecto.

   Sin flag, a propósito: en este producto un flag con default apagado que exige variable de
   entorno y redespliegue ya dejó una funcionalidad inerte. La protección que el flag prometía
   la da la propia frase de cobertura. El `saludScreen` del catálogo se retiró el 2026-10-05
   —estaba declarado y ninguna ruta lo leía— y no se reintroduce.

   El prototipo visual sigue vivo para diseño en el catálogo de componentes (`SaludView` +
   `salud-model` + `salud-fixtures`), fuera de la ruta productiva: habla de cuadrantes y curvas
   de caja que el contrato no publica, así que no se monta acá. */
export default function SaludPage() {
  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/inicio"
          className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al inicio
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-dark">Salud de tu empresa</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Te alcanza la plata este mes y hacia dónde va tu empresa?
        </p>
      </header>
      <SaludContratoLive />
    </div>
  );
}
