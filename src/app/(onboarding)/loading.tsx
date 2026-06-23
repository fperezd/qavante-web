import { QavanteSkeleton } from "@/components/qavante";

/* Fallback de navegación del wizard de onboarding (Tooxs Frontend Standard
   §3.1) — esqueleto centrado con forma de paso (título + contenido + acción). */
export default function OnboardingLoading() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 p-6" aria-busy="true">
      <QavanteSkeleton className="h-7 w-64" />
      <QavanteSkeleton className="h-4 w-full" />
      <QavanteSkeleton className="h-40 w-full rounded-xl" />
      <QavanteSkeleton className="h-11 w-40" />
    </div>
  );
}
