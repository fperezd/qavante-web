/* El puente entre lo que el F29 publica y lo que el SII cobra (D13, issue #202).

   Lo que arregla: el bloque "Desglose" del detalle F29 pinta seis filas al lado del total y NUNCA
   las reconcilia. Si los componentes observados suman distinto del total oficial (código 91), la
   diferencia existe igual y nadie la ve. El contrato ya la publica con nombre propio
   (`unexplained_delta`); acá se rotula "Diferencia no explicada" y se muestra con las dos cifras que
   la producen, para que el dueño pueda ir a buscarla.

   Reglas de copy que gobiernan este archivo: siempre un número con la descripción de qué cubre, y
   nunca una clasificación por defecto. Cuando falta algo, lo que se muestra es el residual COMPLETO
   —lo que queda por cubrir del total oficial— más qué falta para cerrarlo. Un hueco no es una cifra. */

import * as React from "react";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import type { F29BridgeResponse, F29PaymentApplication } from "@/lib/api/sii";
import {
  f29DiferenciaNoExplicada,
  f29EstadoDePago,
  f29LecturaEvidencia,
  f29ResidualDeclarado,
  f29TotalCompuesto,
  type F29EstadoPagoDeclarado,
} from "./f29-bridge-lectura";

/** Qué cubre cada estado DECLARADO por el contrato. La rama por defecto no está acá a propósito: un
 *  valor que no sabemos leer no recibe etiqueta, recibe el residual completo. */
const ESTADO_PAGO_TITULO: Record<F29EstadoPagoDeclarado, string> = {
  paid: "Pagado",
  partial: "Pagado en parte",
  pending: "Por pagar",
  deferred: "Con el IVA postergado",
  unknown: "Cuánto se pagó no está declarado",
};

/** Los tokens cerrados de `missing_requirements` traducidos a lo que una persona tiene que hacer.
 *  El contrato dice explícitamente que son tokens para armar copy, no texto de interfaz. */
const FALTANTE_TEXTO: Record<string, string> = {
  bank_movement_declared: "declarar el movimiento bancario que pagó este F29",
  declaration_total_observation: "que el total oficial del F29 (código 91) quede observado",
  cuota_sin_monto_legible: "revisar el monto de una de las cuotas declaradas",
};

function faltanteTexto(tokens: string[]): string {
  const textos = tokens.map((t) => FALTANTE_TEXTO[t] ?? t);
  const ultimo = textos.at(-1);
  if (ultimo === undefined) return "declarar el movimiento bancario que pagó este F29";
  if (textos.length === 1) return ultimo;
  return `${textos.slice(0, -1).join(", ")} y ${ultimo}`;
}

/** Qué publica el F29 hoy, para decir con qué se intentó cuadrar. */
const DATA_STATE_TEXTO: Record<string, string> = {
  complete: "con todos los códigos que el F29 publica",
  partial: "con parte de los códigos del F29",
  observations_only: "con las observaciones del F29, que todavía no incluyen su total oficial",
  no_observations: "sin códigos observados todavía en el F29",
};

export function F29BridgePanel({ bridge }: { bridge: F29BridgeResponse }) {
  const diferencia = f29DiferenciaNoExplicada(bridge.unexplained_delta);
  const totalOficial = bridge.declaration_total;
  const compuesto = f29TotalCompuesto(totalOficial, bridge.unexplained_delta);
  const residual = f29ResidualDeclarado(bridge.payment);
  const estado = f29EstadoDePago(bridge.payment_state);
  const evidencia = f29LecturaEvidencia(bridge.payment);

  return (
    <div className="space-y-3" data-testid="f29-bridge">
      {/* ── Cómo cuadra el F29 con lo que cobra el SII ── */}
      <div
        className={cn(
          "rounded-xl border p-3",
          diferencia.rotular
            ? "border-warning-500/40 bg-warning-500/10"
            : "border-border bg-surface-muted",
        )}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          Cómo cuadra con lo que cobra el SII
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <Cifra
            label="Suman los códigos del F29"
            value={compuesto}
            ausente="El F29 todavía no publica los códigos que suman este total"
          />
          <Cifra
            label="Cobra el SII (código 91)"
            value={totalOficial}
            ausente="El total oficial del F29 todavía no está observado"
          />
        </dl>

        {diferencia.rotular ? (
          <div className="mt-3 border-t border-warning-500/30 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-warning-700">
              Diferencia no explicada
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-warning-700">
              {formatClp(diferencia.magnitud)}
            </p>
            <p className="mt-1 text-xs text-warning-700">
              {diferencia.direccion === "componentes_bajo_total"
                ? `Los códigos del F29 suman ${formatClp(diferencia.magnitud)} MENOS que el total que cobra el SII. Esa parte del cobro no la explica ningún código del F29.`
                : `Los códigos del F29 suman ${formatClp(diferencia.magnitud)} MÁS que el total que cobra el SII. El cobro no recoge toda esa suma.`}{" "}
              Se compuso {DATA_STATE_TEXTO[bridge.data_state] ?? `con lo que publica el F29`}.
            </p>
          </div>
        ) : diferencia.motivo === "reconciliado" ? (
          <p className="mt-2 text-xs text-neutral-mid">
            Los códigos del F29 explican el total completo que cobra el SII
            {totalOficial != null ? `: ${formatClp(totalOficial)}` : ""}. No queda ninguna
            diferencia por explicar.
          </p>
        ) : (
          <p className="mt-2 text-xs text-neutral-mid">
            {residual.computable
              ? `Quedan ${formatClp(residual.residual)} por cubrir de los ${formatClp(residual.totalOficial)} que cobra el SII. `
              : ""}
            La resta entre los códigos del F29 y ese total todavía no se puede hacer: el período
            está{" "}
            {DATA_STATE_TEXTO[bridge.data_state] ?? "sin los códigos del F29 observados todavía"}.
          </p>
        )}
      </div>

      {/* ── Cuánto se pagó, y con qué evidencia ── */}
      <div className="rounded-xl border border-border bg-surface-muted p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
          {estado.clase === "declarado"
            ? ESTADO_PAGO_TITULO[estado.estado]
            : "Cuánto queda por pagar"}
        </p>

        {/* El residual SIEMPRE es un número, venga de donde venga el estado: es la resta entre el
            total oficial y las cuotas declaradas, no una lectura de la etiqueta. */}
        {residual.computable ? (
          <>
            <p className="text-xl font-bold tabular-nums text-brand-deep">
              {formatClp(residual.residual)}
            </p>
            <p className="mt-1 text-xs text-neutral-mid">
              Es lo que falta para cubrir los {formatClp(residual.totalOficial)} que cobra el SII
              por este F29.{" "}
              {residual.cuotas === 0
                ? "Todavía no hay ninguna cuota declarada contra este período."
                : `${residual.cuotas === 1 ? "Una cuota declarada cubre" : `${residual.cuotas} cuotas declaradas cubren`} ${formatClp(residual.aplicado)}.`}
            </p>
          </>
        ) : (
          <p className="text-xs text-neutral-mid">
            Para saber cuánto falta pagar hay que {faltanteTexto(residual.faltante)}. Mientras eso
            no esté, la resta no se puede hacer: no hay un monto cubierto que restar al cobro.
          </p>
        )}

        {/* Las TRES lecturas de la evidencia bancaria. Colapsar las dos últimas en "sin movimiento"
            haría que un F29 pagado en cuotas se leyera igual que uno que nadie pagó. */}
        <div className="mt-3 border-t border-border pt-2">
          {evidencia.lectura === "movimiento_declarado" ? (
            <p className="text-xs text-neutral-dark">
              Un movimiento bancario declarado respalda este pago
              {bridge.payment.bank_evidence?.linked_at
                ? `, vinculado el ${formatDateLike(bridge.payment.bank_evidence.linked_at)}`
                : ""}
              {bridge.payment.bank_evidence?.applied_amount
                ? `, por ${formatClp(Number(bridge.payment.bank_evidence.applied_amount))}`
                : ""}
              .
            </p>
          ) : evidencia.lectura === "ausencia_explicita" ? (
            <p className="text-xs text-neutral-dark">
              Nadie declaró todavía un movimiento ni un comprobante para este período
              {residual.computable
                ? `: los ${formatClp(residual.residual)} de arriba siguen sin respaldo`
                : ""}
              . Para cerrarlo falta {faltanteTexto(evidencia.faltante)}.
            </p>
          ) : (
            <>
              <p className="text-xs text-neutral-dark">
                Este F29 se pagó en {evidencia.cuotas.length}{" "}
                {evidencia.cuotas.length === 1 ? "aplicación" : "cuotas"}, y ningún movimiento único
                representa el pago completo. Cada una con lo que cubrió:
              </p>
              <ul className="mt-1.5 space-y-1">
                {evidencia.cuotas.map((c, i) => (
                  <li
                    key={`${c.applied_at}-${c.receipt_reference ?? i}`}
                    className="flex flex-wrap items-baseline gap-x-2 text-xs text-neutral-dark"
                  >
                    <span className="font-medium tabular-nums">
                      {formatClp(Number(c.applied_amount))}
                    </span>
                    <span className="text-neutral-mid">{formatDateLike(c.applied_at)}</span>
                    <span className="text-neutral-mid">{cuotaOrigen(c)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Qué hecho declara cada cuota. `bank_movement` es plata que salió del banco; `declaration_receipt`
 *  es el SII acusando el pago sin que el movimiento esté identificado. Son dos hechos distintos y
 *  ninguno implica el otro, así que la fila los nombra distinto. */
function cuotaOrigen(c: F29PaymentApplication): string {
  if (c.application_kind === "bank_movement") return "movimiento bancario declarado";
  if (c.application_kind === "declaration_receipt") {
    return c.receipt_reference
      ? `comprobante del SII ${c.receipt_reference}`
      : "comprobante del SII, con el movimiento todavía sin identificar";
  }
  /* Un `application_kind` que no está en el contrato no se clasifica: se nombra tal cual vino, para
     que la cuota siga sumando sin que la fila afirme de dónde salió la plata. */
  return c.application_kind;
}

function Cifra({
  label,
  value,
  ausente,
}: {
  label: string;
  value: number | null | undefined;
  ausente: string;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-neutral-mid">{label}</dt>
      <dd className="font-medium tabular-nums text-neutral-dark">
        {value == null ? (
          <span className="text-xs text-neutral-mid">{ausente}</span>
        ) : (
          formatClp(value)
        )}
      </dd>
    </div>
  );
}
