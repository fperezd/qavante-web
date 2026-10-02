import { PencilRuler } from "lucide-react";

/* Aviso de maqueta. Va en TODA pantalla de `/maquetas`, arriba y antes de la primera cifra.
 *
 * Es la pieza que hace honesto tener maquetas dentro del producto: estas pantallas muestran
 * montos, RUTs y vencimientos con el mismo formato que las reales, y sin este aviso una
 * captura de pantalla es indistinguible de la caja de la empresa. Por eso el aviso no es
 * descartable ni se esconde al hacer scroll de la sección: declara de qué están hechas las
 * cifras y a dónde ir por las de verdad. */
export function MaquetaAviso({
  pantallaReal,
}: {
  /** Ruta de la pantalla con datos reales equivalente, cuando existe. */
  pantallaReal?: { href: string; label: string };
}) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-start gap-3 rounded-xl border border-warning-700/40 bg-warning-700/5 p-4 text-sm text-warning-700"
    >
      <PencilRuler className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">
          Maqueta de diseño: todas las cifras de esta pantalla son de ejemplo.
        </p>
        <p>
          Sirve para decidir cómo debería verse la pantalla, no para tomar una decisión de plata.
          Los montos, RUTs y vencimientos están inventados y no corresponden a tu empresa.
          {pantallaReal ? (
            <>
              {" "}
              Para tus números, anda a{" "}
              <a href={pantallaReal.href} className="font-semibold underline">
                {pantallaReal.label}
              </a>
              .
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
