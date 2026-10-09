"use client";

import Link from "next/link";
import { ArrowRight, Banknote, BarChart3, FileText, Landmark, WalletCards } from "lucide-react";
import type { DashboardSummaryV2 } from "@/lib/api/dashboard";
import type { CashProjectionViewModel } from "@/components/cash-projection-runs/cash-projection-run-model";
import { cn } from "@/lib/utils";
import { InicioApiPendienteButton } from "./inicio-api-pendiente-button";
import {
  accionesDiaInicio,
  componentesProyeccionInicio,
  pulsoInicio,
  resultadoMesInicio,
} from "./inicio-maqueta-extension-model";
import { InicioSeccionSeparador } from "./inicio-seccion-separador";

const ORIGENES_PROYECCION = [
  "Banco y caja",
  "Facturas por cobrar",
  "Pagar, TGR y sueldos",
  "Saldo + cobros − compromisos",
] as const;

const TONOS_PROYECCION = [
  "text-neutral-dark",
  "text-emerald-700",
  "text-red-700",
  "text-red-700",
] as const;

const LABELS_PROYECCION = [
  "Saldo actual",
  "Cobros esperados",
  "Pagos y compromisos",
  "Faltante a 14 días",
] as const;

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

function ValorConApi({ campo }: { campo: { conectado: boolean; api: string; valor: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {campo.valor}
      {!campo.conectado && (
        <InicioApiPendienteButton
          mensaje={`Para reemplazar este valor de maqueta hace falta ${campo.api}.`}
        />
      )}
    </span>
  );
}

export function InicioMaquetaSecciones({
  data,
  projection,
  mostrarAcciones = true,
}: {
  data: DashboardSummaryV2 | null;
  projection?: CashProjectionViewModel | null;
  /** Apagar 04 cuando el Decision Brief ya ocupa las recomendaciones. */
  mostrarAcciones?: boolean;
}) {
  const pulso = pulsoInicio(data);
  const resultado = resultadoMesInicio(data);
  const acciones = accionesDiaInicio(data);
  const proyeccion = componentesProyeccionInicio(data, projection);

  return (
    <div>
      <section>
        <SectionTitle
          eyebrow="Lectura del negocio"
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
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  pulso.badgeClass,
                )}
              >
                {pulso.badge}
                {!pulso.conectado && (
                  <InicioApiPendienteButton
                    mensaje={`Para mostrar el pulso real hace falta ${pulso.api}.`}
                  />
                )}
              </span>
            </div>
            <p className="mt-5 text-lg font-semibold text-neutral-dark">{pulso.titular}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-mid">{pulso.cuerpo}</p>
            <Link
              href="/gestion/pulso"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"
            >
              Entender el pulso <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
          <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm font-semibold text-neutral-mid">
              Resultado del último mes cerrado
            </p>
            <div className="mt-3 text-2xl font-bold tabular-nums text-neutral-dark">
              <ValorConApi campo={resultado} />
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-mid">
              Consulta la composición de ventas, costos y gastos para entender el resultado.
            </p>
            <Link
              href="/gestion"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"
            >
              Ver resultado <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <InicioSeccionSeparador />

      {mostrarAcciones && (
        <section>
          <SectionTitle
            eyebrow="Decisión del día"
            title="Qué hacer primero"
            description="Acciones ordenadas por impacto. Revisar una opción no ejecuta ningún pago ni cobro."
          />
          <div className="grid gap-3 lg:grid-cols-3">
            {acciones.map((action) => (
              <Link
                key={action.numero}
                href={action.href}
                className={cn(
                  "group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm",
                  action.tono,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-xs font-bold tracking-[0.16em] text-neutral-mid">
                    {action.numero}
                    {!action.conectado && (
                      <InicioApiPendienteButton
                        mensaje={`Esta tarjeta usa copy de maqueta hasta que ${action.api} devuelva acciones priorizadas.`}
                      />
                    )}
                  </span>
                  <ArrowRight
                    className="h-5 w-5 text-neutral-mid transition group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-7 font-bold text-neutral-dark">{action.titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-mid">{action.descripcion}</p>
                <span className="mt-5 inline-flex text-sm font-semibold text-brand-primary">
                  Revisar opción
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {mostrarAcciones ? <InicioSeccionSeparador /> : null}

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <SectionTitle
          eyebrow="Explicación"
          title="Cómo se forma la proyección"
          description="La cifra se entiende siguiendo el origen de cada componente."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {proyeccion.tiles.map((tile, index) => (
            <div key={LABELS_PROYECCION[index]} className="rounded-xl bg-surface-muted p-4">
              <p className="text-sm text-neutral-mid">{LABELS_PROYECCION[index]}</p>
              <div className={cn("mt-2 text-xl font-bold tabular-nums", TONOS_PROYECCION[index])}>
                <ValorConApi campo={tile} />
              </div>
              <p className="mt-2 text-xs text-neutral-mid">Origen: {ORIGENES_PROYECCION[index]}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="inline-flex items-start gap-2">
            Cada componente lleva su origen y su fecha de corte: así se ve qué documentos entraron
            en la cifra y cuáles quedaron por confirmar.
            {!proyeccion.notaConectada && (
              <InicioApiPendienteButton
                mensaje={`Algunos montos siguen sin fuente: conecta ${proyeccion.tiles.find((t) => !t.conectado)?.api ?? "las APIs de resumen y proyección"}.`}
              />
            )}
          </span>
        </div>
      </section>

      <InicioSeccionSeparador />

      <section>
        <SectionTitle eyebrow="Detalle" title="Explora la información que explica el resumen" />
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
      </section>
    </div>
  );
}
