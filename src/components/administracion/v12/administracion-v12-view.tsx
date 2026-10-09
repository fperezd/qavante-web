"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Building2,
  Coins,
  KeyRound,
  Layers,
  ListFilter,
  PlugZap,
  Telescope,
  Users,
  Wallet,
} from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { Pill } from "@/components/rediseno/pill";
import { TablePrimaryCell } from "@/components/rediseno/table";
import type { PillProps } from "@/components/rediseno/pill";
import type { FilaHubV12, TonoEstadoV12 } from "./administracion-v12-model";

/* V12 · Administración — hub híbrido: Empresas y Usuarios en tabla; el resto en tarjetas con icono. */

const TONO_A_VARIANTE: Record<TonoEstadoV12, PillProps["variant"]> = {
  ok: "ok",
  warn: "warn",
  neutral: "mut",
  bad: "bad",
};

const FILAS_TABLA = new Set(["empresas", "usuarios"]);

const ICONO_MODULO: Record<string, LucideIcon> = {
  empresas: Building2,
  usuarios: Users,
  credenciales: KeyRound,
  conexiones: PlugZap,
  "estructura-gestion": Layers,
  "vistas-gestion": Telescope,
  monedas: Coins,
  remuneraciones: Wallet,
  "reglas-clasificacion": ListFilter,
  plantillas: Briefcase,
  mcp: Bot,
};

export interface AdministracionV12ViewProps {
  filas: FilaHubV12[];
}

function CuentaModulosLista({ filas }: { filas: FilaHubV12[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-rediseno-hairline bg-rediseno-superficie">
      <ul className="divide-y divide-rediseno-hairline-row-2">
        {filas.map((fila) => (
          <li
            key={fila.id}
            className="flex flex-wrap items-start justify-between gap-3 px-[18px] py-3 sm:items-center"
          >
            <TablePrimaryCell value={fila.titulo} sub={fila.descripcion} />
            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
              {fila.estado ? (
                <Pill variant={TONO_A_VARIANTE[fila.estado.tono]}>{fila.estado.texto}</Pill>
              ) : null}
              <Link
                href={fila.href}
                className="text-[12.5px] font-bold text-rediseno-azul hover:underline"
              >
                Ver
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HubModuloCard({ fila }: { fila: FilaHubV12 }) {
  const Icon = ICONO_MODULO[fila.id] ?? Layers;
  return (
    <Link
      href={fila.href}
      className="block h-full transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <QavanteCard variant="bordered" className="flex h-full flex-col">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-brand-primary-50 p-2 text-brand-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1 text-sm font-semibold text-neutral-dark">
              {fila.titulo}
              <ArrowRight className="h-3 w-3 shrink-0 text-neutral-mid" aria-hidden="true" />
            </h3>
            <p className="mt-1 text-sm text-neutral-mid">{fila.descripcion}</p>
          </div>
        </div>
        {fila.estado ? (
          <div className="mt-3 border-t border-rediseno-hairline/80 pt-3">
            <Pill variant={TONO_A_VARIANTE[fila.estado.tono]}>{fila.estado.texto}</Pill>
          </div>
        ) : null}
      </QavanteCard>
    </Link>
  );
}

export function AdministracionV12View({ filas }: AdministracionV12ViewProps) {
  const filasTabla = filas.filter((f) => FILAS_TABLA.has(f.id));
  const filasTarjetas = filas.filter((f) => !FILAS_TABLA.has(f.id));

  if (filas.length === 0) {
    return (
      <p className="text-sm text-rediseno-tinta-3" role="status">
        No hay módulos que mostrar.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {filasTabla.length > 0 ? (
        <section aria-label="Empresas y usuarios de la cuenta">
          <CuentaModulosLista filas={filasTabla} />
        </section>
      ) : null}
      {filasTarjetas.length > 0 ? (
        <section aria-label="Configuración por empresa" className="space-y-3">
          <h2 className="font-rediseno-mono text-[12px] font-semibold tracking-[.12em] text-rediseno-tinta-3 uppercase">
            Por empresa
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filasTarjetas.map((fila) => (
              <HubModuloCard key={fila.id} fila={fila} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
