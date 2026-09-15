import Link from "next/link";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { ImpuestosV06Live } from "@/components/impuestos/v06/impuestos-v06-live";

/* V06 · Impuestos — `/impuestos` (ESPECIFICACION §V06, issue #73, R2). RUTA NUEVA: no existía, así
 * que "cero regresión" con el flag apagado significa lo mismo que en `/bandeja` (V07) y
 * `/bienvenida` (V15): la ruta no puede mentir.
 *
 * QUÉ PASA CON `impuestosV06` APAGADO, y por qué esto y no otra cosa:
 *
 *   · NO redirige. `/pagar/impuestos` (F-29/TGR) y `/pagar/previred` siguen siendo la forma de
 *     hoy de ver esto — un redirect elegiría por el usuario a cuál de los dos mandarlo.
 *   · NO devuelve 404. La ruta existe.
 *   · Renderiza el estado "todavía no disponible" CON SALIDA a los flujos que hacen este trabajo
 *     hoy. Es el contrato que el propio repo fija (ADR-0008, citado en `src/lib/feature-flags.ts`).
 *
 * Sin `export const runtime` (regla 4). */
export default function ImpuestosPage() {
  const { impuestosV06 } = resolveFeatureFlags();

  if (impuestosV06) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-rediseno-sans text-[28px] font-medium text-rediseno-tinta">
            Impuestos
          </h1>
        </header>
        <ImpuestosV06Live />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Impuestos</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Qué le debes al SII, a Previred y a la Tesorería, y cuándo.
        </p>
      </header>
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-neutral-dark">
          Esta pantalla todavía no está disponible
        </h2>
        <p className="mt-2 max-w-prose text-sm text-neutral-mid">
          Mientras la terminamos, el mismo trabajo se hace hoy en{" "}
          <Link href="/pagar/impuestos" className="font-semibold text-brand-primary underline">
            Impuestos (F-29 y TGR)
          </Link>{" "}
          y en{" "}
          <Link href="/pagar/previred" className="font-semibold text-brand-primary underline">
            Previred
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** Hueco restante de V06: la conciliación bancaria de un F-29 declarado no tiene todavía vínculo
 *  contractual con un movimiento específico. */
