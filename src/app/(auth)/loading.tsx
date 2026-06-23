import { QavanteSkeleton } from "@/components/qavante";

/* Fallback de navegación de auth (Tooxs Frontend Standard §3.1) — esqueleto con
   forma de formulario, dentro del panel claro del layout. */
export default function AuthLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <QavanteSkeleton className="mx-auto h-6 w-40" />
      <QavanteSkeleton className="h-11 w-full" />
      <QavanteSkeleton className="h-11 w-full" />
      <QavanteSkeleton className="h-11 w-full" />
    </div>
  );
}
