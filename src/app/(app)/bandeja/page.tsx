import Link from "next/link";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { BandejaV07Live } from "@/components/bandeja/v07/bandeja-v07-live";

/* V07 · Bandeja de excepciones — `/bandeja` (ESPECIFICACION §V07, issue #71). RUTA NUEVA: no
 * existía, así que no hay nada que preservar detrás del flag y "cero regresión" acá significa
 * otra cosa que en las vistas anteriores — significa que la ruta no puede mentir con el flag
 * apagado.
 *
 * QUÉ PASA CON `bandejaV07` APAGADO, y por qué esto y no otra cosa:
 *
 *   · NO redirige a otra pantalla. Un redirect deja el botón "atrás" del navegador en un rebote
 *     (vuelves a /bandeja, te vuelve a sacar) y además elegiría por el usuario a cuál de los DOS
 *     flujos actuales mandarlo — conciliar y clasificar viven en pantallas distintas hoy.
 *   · NO devuelve 404. La ruta existe; decir que no existe es falso, y un 404 no le dice a nadie
 *     qué hacer (Ley 8).
 *   · Renderiza el estado "todavía no disponible" CON SALIDA a los dos flujos que hacen este
 *     trabajo hoy. Es, además, el contrato que el propio repo ya fijó para los flags: ADR-0008,
 *     citado literal en `src/lib/feature-flags.ts` — "Flag false ⇒ la ruta existe pero renderiza
 *     un estado 'todavía no disponible' — nunca UI mock, nunca ruta rota".
 *
 * El shell y los CTA de Caja/Banco muestran esta entrada sólo cuando el flag está encendido. Con
 * el flag apagado la URL directa conserva este estado explícito en lugar de redirigir.
 *
 * Sin `export const runtime` (regla 4). */
export default function BandejaPage() {
  const { bandejaV07 } = resolveFeatureFlags();

  if (bandejaV07) {
    return (
      <div className="space-y-6">
        <BandejaV07Live />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Bandeja de excepciones</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Sólo lo que requiere tu revisión: conciliar y clasificar, de a uno.
        </p>
      </header>
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-neutral-dark">
          Esta bandeja todavía no está disponible
        </h2>
        <p className="mt-2 max-w-prose text-sm text-neutral-mid">
          Mientras la terminamos, el mismo trabajo se hace hoy en dos pantallas: los abonos y cargos
          que esperan su documento están en{" "}
          <Link href="/caja/conciliacion" className="font-semibold text-brand-primary underline">
            Conciliación
          </Link>{" "}
          y los movimientos sin categoría en{" "}
          <Link href="/caja/por-clasificar" className="font-semibold text-brand-primary underline">
            Movimientos por clasificar
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
