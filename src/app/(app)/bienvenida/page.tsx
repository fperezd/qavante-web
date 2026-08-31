import Link from "next/link";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { BienvenidaV15Live } from "@/components/bienvenida/v15/bienvenida-v15-live";

/* V15 · Bienvenida — `/bienvenida` (ESPECIFICACION §V15, issue #76, R1). RUTA NUEVA: no existía,
 * así que "cero regresión" con el flag apagado significa lo mismo que en `/bandeja` (V07): la ruta
 * no puede mentir.
 *
 * QUÉ PASA CON `onboardingV15` APAGADO:
 *
 *   · NO redirige. El wizard sigue terminando en `/inicio` exactamente igual que hoy (esta
 *     entrega NO toca `ONBOARDING_DONE_ROUTE` ni el paso "Traer datos" — cero regresión sobre el
 *     flujo que ya funciona).
 *   · NO devuelve 404. La ruta existe.
 *   · Renderiza el estado "todavía no disponible" CON SALIDA a lo que hoy hace este trabajo:
 *     `/conexiones` (el hub de conexiones — el mismo dato del paso 1) y `/inicio` (el panel). Es
 *     el contrato que el propio repo fija (ADR-0008, citado en `src/lib/feature-flags.ts`).
 *
 * Sin `export const runtime` (regla 4). */
export default function BienvenidaPage() {
  const { onboardingV15 } = resolveFeatureFlags();

  if (onboardingV15) {
    return (
      <div className="space-y-6">
        <BienvenidaV15Live />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Bienvenida</h1>
        <p className="mt-1 text-sm text-neutral-mid">Cómo va la construcción de tu primer parte.</p>
      </header>
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-neutral-dark">
          Esta pantalla todavía no está disponible
        </h2>
        <p className="mt-2 max-w-prose text-sm text-neutral-mid">
          Mientras la terminamos, revisa el estado de tus fuentes en{" "}
          <Link href="/conexiones" className="font-semibold text-brand-primary underline">
            Tus conexiones
          </Link>{" "}
          o entra directo a{" "}
          <Link href="/inicio" className="font-semibold text-brand-primary underline">
            tu panel
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
