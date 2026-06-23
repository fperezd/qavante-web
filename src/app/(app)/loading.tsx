import { QavanteSkeleton } from "@/components/qavante";

/* Fallback de navegación del área autenticada (Tooxs Frontend Standard §3.1):
   streaming con Suspense — el shell persiste y el contenido muestra un esqueleto
   que anticipa la forma típica de una pantalla (título + grilla de cards). */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <QavanteSkeleton className="h-7 w-56" />
        <QavanteSkeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <QavanteSkeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
