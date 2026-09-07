import type { ReactNode } from "react";
import { Wallet, TrendingUp, Activity } from "lucide-react";
import { QavanteLogo } from "@/components/qavante";

/* Layout de auth (login / recuperar-clave / aceptar-invitación). Refresh v1.2:
   split con panel hero en gradiente de marca (desktop, propuesta de valor) +
   panel claro con el LOGO de marca arriba del formulario. En mobile el hero se
   oculta (`hidden lg:flex`) → la experiencia y el peso de /login en mobile no
   cambian (Lighthouse mobile ≥85 + smoke e2e). `<h1 sr-only>` conservado. */

const HIGHLIGHTS = [
  {
    Icon: Wallet,
    title: "Tu operación financiera, bajo control",
    description: "Caja, cobranza, pagos y compromisos siempre al día.",
  },
  {
    Icon: TrendingUp,
    title: "Anticipa riesgos y oportunidades",
    description:
      "Identifica lo que viene y qué requiere tu atención antes de que impacte tu negocio.",
  },
  {
    Icon: Activity,
    title: "Convierte información en acción",
    description: "Evalúa alternativas, toma mejores decisiones y mide su impacto.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Panel hero — solo desktop. Sin logo (vive en el panel claro, a la
          derecha): acá va la propuesta de valor sobre el gradiente. */}
      <aside className="bg-gradient-brand relative hidden w-1/2 flex-col justify-center overflow-hidden p-12 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="bg-brand-light/20 absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl" />
          <div className="bg-brand-primary/30 absolute -bottom-32 -left-16 h-96 w-96 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-xl space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold leading-tight text-white">
              Anticipa. Decide. Avanza.
            </h2>
            <p className="text-brand-light-100 text-base leading-relaxed">
              Gestiona tu operación financiera, entiende qué está pasando y anticipa lo que viene.
              Qavante te ayuda a decidir qué hacer, actuar y medir el resultado.
            </p>
          </div>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block font-semibold text-white">{title}</strong>
                  <span className="mt-0.5 block leading-relaxed text-white/80">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Panel formulario (claro) — el logo de marca vive acá, arriba del form.
          Se muestra en desktop y mobile (el logo navy lee bien sobre el claro). */}
      <main className="flex w-full flex-col items-center justify-center bg-white p-4 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* h1 sr-only para heading hierarchy a11y + e2e smoke en mobile. */}
          <h1 className="sr-only">Qavante</h1>
          <header className="mb-8 flex flex-col items-center">
            <QavanteLogo variant="hero" alt="Qavante" />
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
