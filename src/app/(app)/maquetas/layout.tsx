import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveFeatureFlags } from "@/lib/feature-flags";

/* Recorrido de maquetas (`/maquetas/*`).
 *
 * Existe para que una propuesta de pantalla se pueda RECORRER — con sus pestañas, filtros y
 * tablas vivas — sin que entre a convivir con cifras reales. La versión original de estas
 * maquetas se montaba encima de `/banco`, `/cobrar` y `/pagar`: Banco quedaba servido por la
 * maqueta en cualquier ambiente, y Cobrar y Pagar la servían cada vez que el ambiente era de
 * desarrollo. Eso es exactamente lo que esta carpeta evita: acá las maquetas tienen su propia
 * dirección y las pantallas reales no se tocan.
 *
 * Gated por `maquetasUx`, HOY APAGADO (no está en `wrangler.toml` → default `false` en
 * producción). Con el flag apagado la ruta responde 404: una maqueta no merece una pantalla
 * de "todavía no habilitado" en el producto. */
export default function MaquetasLayout({ children }: { children: React.ReactNode }) {
  const { maquetasUx } = resolveFeatureFlags();
  if (!maquetasUx) notFound();

  return (
    <div className="space-y-6">
      <nav aria-label="Maquetas" className="flex flex-wrap gap-2">
        {[
          { href: "/maquetas", label: "Las maquetas" },
          { href: "/maquetas/inicio", label: "Inicio" },
          { href: "/maquetas/cobros", label: "Cobros" },
          { href: "/maquetas/pagos", label: "Pagos" },
          { href: "/maquetas/banco", label: "Banco" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-neutral-dark transition-colors hover:border-brand-primary/50 hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
