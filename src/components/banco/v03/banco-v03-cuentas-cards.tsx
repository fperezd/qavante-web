"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { bankBrandColor } from "@/lib/banco/bank-assets";
import { BankLogo } from "@/components/banco/bank-logo";
import { SinDato } from "@/components/rediseno/sin-dato";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import {
  etiquetaProductoCuenta,
  gruposCuentasPorBanco,
  saldoDisponibleClpGrupo,
  type ConexionBanco,
  type CuentaV03,
} from "./banco-v03-model";

const LINK =
  "text-sm font-semibold text-rediseno-azul hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul rounded";

function etiquetaEstado(conexion: ConexionBanco): string {
  if (conexion.estado === "conectada") return "Conectado";
  return conexion.pill.replace(/\s*✓\s*$/, "").trim();
}

function badgeConexion(conexion: ConexionBanco): string {
  if (conexion.tono === "ok") {
    return "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800";
  }
  if (conexion.tono === "warn") {
    return "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900";
  }
  return "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-rediseno-tinta-3";
}

function puntoEstado(conexion: ConexionBanco): string {
  if (conexion.tono === "ok") return "bg-emerald-500";
  if (conexion.tono === "warn") return "bg-amber-500";
  return "bg-neutral-mid/70";
}

function conteoProductos(filas: readonly CuentaV03[]): string {
  const cuentas = filas.filter((f) => f.tipo === "cuenta").length;
  const tarjetas = filas.filter((f) => f.tipo === "tarjeta").length;
  const partes: string[] = [];
  if (cuentas > 0) partes.push(`${cuentas} ${cuentas === 1 ? "cuenta" : "cuentas"}`);
  if (tarjetas > 0) partes.push(`${tarjetas} ${tarjetas === 1 ? "tarjeta" : "tarjetas"}`);
  return partes.join(" · ") || "Sin productos";
}

function BankAccountsCard({
  grupo,
  conexion,
}: {
  grupo: ReturnType<typeof gruposCuentasPorBanco>[number];
  conexion: ConexionBanco;
}) {
  const saldoClp = saldoDisponibleClpGrupo(grupo.filas);
  const accent = bankBrandColor(grupo.bankId, grupo.bankName);
  const frescura = grupo.filas.find((f) => f.sub.trim())?.sub;

  return (
    <article className="overflow-hidden rounded-2xl border border-rediseno-hairline bg-rediseno-superficie shadow-sm transition-shadow hover:shadow-md">
      <div className="relative px-5 pb-4 pt-5">
        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BankLogo
              institutionId={grupo.bankId}
              name={grupo.bankName}
              size="md"
              className="rounded-none object-contain ring-1 ring-rediseno-hairline"
            />
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-rediseno-tinta">{grupo.bankName}</h3>
              <p className="text-xs text-rediseno-tinta-3">{conteoProductos(grupo.filas)}</p>
              {frescura ? (
                <p className="mt-0.5 text-xs text-rediseno-tinta-3-light">{frescura}</p>
              ) : null}
            </div>
          </div>
          <span className={badgeConexion(conexion)}>
            <span className={cn("size-1.5 rounded-full", puntoEstado(conexion))} />
            {etiquetaEstado(conexion)}
          </span>
        </div>
        <p className="mt-5 text-xs text-rediseno-tinta-3">Saldo disponible CLP</p>
        {saldoClp != null ? (
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-rediseno-tinta">
            {formatClp(saldoClp)}
          </p>
        ) : (
          <div className="mt-1">
            <SinDato
              variant="compact"
              label="el saldo CLP de este banco"
              reason={
                grupo.filas.find((f) => f.saldoMotivo)?.saldoMotivo ??
                "El banco no informó saldos en pesos para estas cuentas."
              }
            />
          </div>
        )}
      </div>
      <div className="space-y-3 border-t border-rediseno-hairline/80 p-4">
        {grupo.filas.map((fila) => (
          <FilaProducto key={fila.key} fila={fila} />
        ))}
      </div>
    </article>
  );
}

function FilaProducto({ fila }: { fila: CuentaV03 }) {
  const etiqueta = etiquetaProductoCuenta(fila);
  const esUsdCuenta = fila.tipo === "cuenta" && fila.moneda === "USD";

  if (esUsdCuenta) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
        <div className="min-w-0">
          <span className="text-xs font-medium text-emerald-900">
            Saldo en USD <span className="font-normal text-emerald-800">{etiqueta}</span>
          </span>
          {fila.accountNumberDisplay && (
            <span className="mt-0.5 block font-mono text-[10px] tracking-wide text-emerald-800/80">
              {fila.accountNumberDisplay}
            </span>
          )}
        </div>
        {fila.saldo == null ? (
          <SinDato
            variant="compact"
            label="el saldo en USD"
            reason={fila.saldoMotivo ?? "El banco no informó el saldo."}
          />
        ) : (
          <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-800">
            {formatMoney(fila.saldo, "USD")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="block truncate text-xs text-rediseno-tinta-3">{etiqueta}</span>
        {fila.accountNumberDisplay && (
          <span className="mt-0.5 block font-mono text-[10px] tracking-wide text-rediseno-tinta-3-light">
            {fila.accountNumberDisplay}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {fila.saldo == null ? (
          <SinDato
            variant="compact"
            label="el saldo de esta cuenta"
            reason={fila.saldoMotivo ?? "El banco no informó el saldo."}
          />
        ) : (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums text-rediseno-tinta",
              fila.saldo < 0 && "text-rediseno-tinta-2",
              fila.tipo === "tarjeta" && "text-rediseno-tinta-2",
            )}
          >
            {fila.moneda ? formatMoney(fila.saldo, fila.moneda) : "Sin información"}
          </span>
        )}
        {fila.href ? (
          <Link href={fila.href} className={LINK}>
            {fila.accion}
          </Link>
        ) : (
          <span className="text-xs text-rediseno-tinta-3-light">sin cartola</span>
        )}
      </div>
    </div>
  );
}

export function BancoV03CuentasCards({
  filas,
  conexion,
}: {
  filas: CuentaV03[];
  conexion: ConexionBanco;
}) {
  const grupos = gruposCuentasPorBanco(filas);
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {grupos.map((grupo) => (
        <BankAccountsCard key={grupo.bankId + grupo.bankName} grupo={grupo} conexion={conexion} />
      ))}
    </div>
  );
}
