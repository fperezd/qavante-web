import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Landmark,
  RefreshCw,
  WalletCards,
} from "lucide-react";

const actions = [
  {
    number: "01",
    title: "Revisar pagos próximos",
    description: "Hay compromisos que podrían generar una falta de caja en los próximos 14 días.",
    href: "/pagar",
    tone: "border-red-200 bg-red-50/70",
  },
  {
    number: "02",
    title: "Gestionar cobros vencidos",
    description: "Revisa qué clientes pueden aportar liquidez y registra el próximo seguimiento.",
    href: "/cobrar",
    tone: "border-amber-200 bg-amber-50/70",
  },
  {
    number: "03",
    title: "Actualizar conexión bancaria",
    description: "Algunos saldos no están actualizados con información de hoy.",
    href: "/banco",
    tone: "border-blue-200 bg-blue-50/70",
  },
];

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold text-neutral-dark">{title}</h2>
      {description && <p className="mt-1 text-sm text-neutral-mid">{description}</p>}
    </div>
  );
}

function DetailLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Landmark;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-blue-300 hover:shadow-sm"
    >
      <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-neutral-dark">{title}</span>
        <span className="mt-0.5 block text-sm text-neutral-mid">{description}</span>
      </span>
      <ArrowRight
        className="h-4 w-4 text-neutral-mid transition group-hover:translate-x-0.5 group-hover:text-blue-700"
        aria-hidden="true"
      />
    </Link>
  );
}

export function InicioMaqueta() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
            Maqueta de experiencia
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-dark">Inicio</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            Una lectura rápida de cómo está tu empresa y qué necesita atención.
          </p>
        </div>
        <div className="text-left text-sm text-neutral-mid sm:text-right">
          <p className="font-medium text-neutral-dark">Tooxs Digital SpA</p>
          <p>14 de septiembre de 2026 · Chile</p>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-mid">
                01 · Situación actual
              </p>
              <h2 className="mt-2 text-2xl font-bold text-neutral-dark">Dinero disponible hoy</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Confirmado
            </span>
          </div>
          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-sm text-neutral-mid">Saldo bancario CLP</p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-neutral-dark">$6.692.682</p>
            </div>
            <div>
              <p className="text-sm text-neutral-mid">Saldo bancario USD</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-dark">US$ 0,70</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-mid">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" aria-hidden="true" /> Actualizado hoy, 10:42
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Landmark className="h-4 w-4" aria-hidden="true" /> 1 banco · 2 cuentas
            </span>
          </div>
          <Link
            href="/banco"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Ver cuentas y composición <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
            02 · Cobertura
          </p>
          <div className="mt-2 flex items-start gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-bold text-neutral-dark">Requiere atención</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-mid">
                La caja actual no alcanza para cubrir todos los compromisos identificados.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-neutral-mid">Faltante · próximos 14 días · CLP</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-red-700">$52.532.648</p>
          <p className="mt-2 text-sm text-amber-800">
            Se arma con tus facturas por cobrar y los compromisos de pago cargados a 14 días.
          </p>
          <Link
            href="/caja"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Ver proyección de caja <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section>
        <SectionTitle
          eyebrow="03 · Lectura del negocio"
          title="Tu pulso y lo que está pasando"
          description="Una síntesis antes de entrar a los detalles financieros."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="font-bold text-neutral-dark">Pulso de la empresa</h3>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                49 · Crítica
              </span>
            </div>
            <p className="mt-5 text-lg font-semibold text-neutral-dark">
              La prioridad es proteger la caja de las próximas dos semanas.
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-mid">
              El riesgo principal viene de la diferencia entre los pagos previstos y el dinero
              disponible. Revisa primero los compromisos que explican el faltante.
            </p>
            <Link
              href="/gestion/pulso"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
            >
              Entender el pulso <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
          <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm font-semibold text-neutral-mid">
              Resultado del último mes cerrado
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-neutral-dark">$79.206</p>
            <p className="mt-2 text-sm leading-6 text-neutral-mid">
              Consulta la composición de ventas, costos y gastos para entender el resultado.
            </p>
            <Link
              href="/gestion"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
            >
              Ver resultado <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section>
        <SectionTitle
          eyebrow="04 · Decisión del día"
          title="Qué hacer primero"
          description="Acciones ordenadas por impacto. Revisar una opción no ejecuta ningún pago ni cobro."
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.number}
              href={action.href}
              className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${action.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold tracking-[0.16em] text-neutral-mid">
                  {action.number}
                </span>
                <ArrowRight
                  className="h-5 w-5 text-neutral-mid transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-7 font-bold text-neutral-dark">{action.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-mid">{action.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-blue-700">
                Revisar opción
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <SectionTitle
          eyebrow="05 · Explicación"
          title="Cómo se forma la proyección"
          description="La cifra se entiende siguiendo el origen de cada componente."
        />
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Saldo actual", "$6.692.682", "Banco y caja", "text-neutral-dark"],
            ["Cobros esperados", "+$12.000.000", "Facturas por cobrar", "text-emerald-700"],
            ["Pagos y compromisos", "−$71.225.330", "Pagar, TGR y sueldos", "text-red-700"],
            ["Faltante a 14 días", "−$52.532.648", "Saldo + cobros − compromisos", "text-red-700"],
          ].map(([label, value, source, tone]) => (
            <div key={label} className="rounded-xl bg-surface-muted p-4">
              <p className="text-sm text-neutral-mid">{label}</p>
              <p className={`mt-2 text-xl font-bold tabular-nums ${tone}`}>{value}</p>
              <p className="mt-2 text-xs text-neutral-mid">Origen: {source}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Cada componente lleva su origen y su fecha de corte: así se ve qué documentos entraron en
          la cifra y cuáles quedaron por confirmar.
        </div>
      </section>

      <section>
        <SectionTitle
          eyebrow="06 · Detalle"
          title="Explora la información que explica el resumen"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <DetailLink
            href="/banco"
            icon={Landmark}
            title="Banco y cuentas"
            description="Saldos, fechas, conexión y movimientos de cada cuenta."
          />
          <DetailLink
            href="/caja"
            icon={WalletCards}
            title="Caja y proyección"
            description="Entradas, salidas, cobertura y semanas de déficit."
          />
          <DetailLink
            href="/cobrar"
            icon={Banknote}
            title="Cobros pendientes"
            description="Clientes, documentos vencidos y próximas gestiones."
          />
          <DetailLink
            href="/pagar"
            icon={FileText}
            title="Pagos y compromisos"
            description="Proveedores, impuestos, sueldos y vencimientos."
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-neutral-mid">
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Cada cifra trae su fecha de corte
          </span>
          <span className="inline-flex items-center gap-2">
            <ChevronDown className="h-4 w-4" aria-hidden="true" /> Cada tarjeta lleva a su detalle
          </span>
        </div>
      </section>
    </div>
  );
}
