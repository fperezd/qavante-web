/* Cómo se LEE el bridge F29 (D13, issue #202). Puro, sin React, para que los tests fijen cada
   lectura sin montar la tarjeta.

   Tres cosas viven acá, y las tres existen porque el contrato publica distinciones que una pantalla
   descuidada colapsa en un cero mudo:

   1. `payment_state` NO ES UN ENUM EN EL CONTRATO. Los valores admisibles —`paid | partial | pending
      | deferred | unknown`— viven sólo en la descripción del campo; el schema lo declara como string
      suelto y `types.ts` lo genera como `payment_state: string`. O sea: la unión discriminada NO SE
      PUEDE DERIVAR de los tipos, hay que escribirla a mano. Y entonces aparece la pregunta que
      importa: ¿qué hace la rama por defecto? No puede mapear un valor desconocido a `unknown`,
      porque eso es exactamente una clasificación por defecto: convertiría un valor que no sabemos
      leer en una afirmación del contrato ("el productor declaró que no se sabe"). Acá la rama por
      defecto devuelve `fuera_del_contrato` CON el valor crudo, que no afirma nada y obliga a quien
      renderiza a mostrar el residual completo en vez de una etiqueta.

   2. `bank_movement_id` TIENE TRES LECTURAS, NO DOS. Cita textual del contrato
      (`F29BankPaymentEvidenceSchema.bank_movement_id`): «El movimiento bancario declarado cuando hay
      EXACTAMENTE UNO. `null` tiene dos lecturas y `applications` las distingue: con `applications`
      vacía es la AUSENCIA EXPLÍCITA —nadie declaró nada, no hay vínculo afirmable—; con dos o más
      entradas, o con una aplicación por comprobante, es que no existe UN movimiento que represente
      el pago, y el detalle por cuota está en `applications`. Nunca se elige el movimiento más
      parecido.» Colapsar las dos últimas en "sin movimiento" vuelve a mentir: un F29 pagado en dos
      cuotas se leería igual que uno que nadie pagó.

      (Ojo aguas arriba: el docstring de clase de ese mismo schema dice «Si `bank_movement_id` es
      null, nadie declaró el movimiento todavía» — justo la lectura única que la descripción del campo
      prohíbe. Esta implementación sigue el campo, no el docstring.)

   3. EL RESIDUAL ES UNA RESTA ENTRE HECHOS DECLARADOS, nunca una estimación:
      `declaration_receipt.declaration_total` menos la suma de `applications[].applied_amount`. Si el
      código 91 no está observado todavía, el residual NO es cero: no es computable, y lo que se
      muestra es qué falta para computarlo. */

import type { F29BridgeResponse, F29PaymentApplication, F29PaymentLink } from "@/lib/api/sii";

/* ─────────────────────────── 1. Estado de pago ─────────────────────────── */

/** Los cinco valores que la descripción del contrato admite para `payment_state`. Escritos a mano:
 *  el schema los deja fuera del tipo. `partial` es expresable desde la migración 0248 del productor. */
export const F29_ESTADOS_PAGO_DECLARADOS = [
  "paid",
  "partial",
  "pending",
  "deferred",
  "unknown",
] as const;

export type F29EstadoPagoDeclarado = (typeof F29_ESTADOS_PAGO_DECLARADOS)[number];

export type F29EstadoPago =
  /** El productor declaró uno de los cinco valores del contrato. `unknown` también es declarado:
   *  significa que el productor afirma no saberlo, y eso es un hecho distinto de no poder leerlo. */
  | { clase: "declarado"; estado: F29EstadoPagoDeclarado }
  /** Rama por defecto. No afirma nada y NO es una clasificación: guarda el valor crudo para que
   *  quien renderiza muestre el residual completo en vez de inventar una etiqueta. */
  | { clase: "fuera_del_contrato"; valor: string };

export function f29EstadoDePago(valor: string | null | undefined): F29EstadoPago {
  const crudo = (valor ?? "").trim();
  for (const estado of F29_ESTADOS_PAGO_DECLARADOS) {
    if (crudo === estado) return { clase: "declarado", estado };
  }
  return { clase: "fuera_del_contrato", valor: crudo };
}

/* ─────────────────────── 2. Las tres lecturas de la evidencia ─────────────────────── */

export type F29LecturaEvidencia =
  /** Hay EXACTAMENTE UN movimiento bancario declarado y el contrato lo nombra. */
  | {
      lectura: "movimiento_declarado";
      bankMovementId: string;
      cuotas: F29PaymentApplication[];
    }
  /** `bank_movement_id` null y `applications` vacía: nadie declaró nada. Ausencia explícita, no
   *  "pagado en cuotas". `faltante` son los tokens del contrato que dicen qué falta. */
  | { lectura: "ausencia_explicita"; faltante: string[] }
  /** `bank_movement_id` null CON aplicaciones: se pagó, y ningún movimiento único representa el
   *  pago. El detalle por cuota está en `cuotas`. Esta es la lectura que un "sin movimiento" borra. */
  | { lectura: "pago_sin_movimiento_unico"; cuotas: F29PaymentApplication[] };

export function f29LecturaEvidencia(payment: F29PaymentLink): F29LecturaEvidencia {
  const cuotas = payment.applications ?? [];
  const movimiento = (payment.bank_evidence?.bank_movement_id ?? "").trim();
  if (movimiento !== "")
    return { lectura: "movimiento_declarado", bankMovementId: movimiento, cuotas };
  if (cuotas.length === 0) {
    return { lectura: "ausencia_explicita", faltante: payment.missing_requirements ?? [] };
  }
  return { lectura: "pago_sin_movimiento_unico", cuotas };
}

/* ───────────────────────────── 3. El residual ───────────────────────────── */

export type F29Residual =
  | {
      computable: true;
      /** Código 91: el total oficial que el SII cobra por la declaración. */
      totalOficial: number;
      /** Suma de `applications[].applied_amount`: lo que las cuotas declaradas cubrieron. */
      aplicado: number;
      /** `totalOficial − aplicado`. Cero sólo cuando las cuotas cubren el total. */
      residual: number;
      /** Cuántas cuotas entraron en la suma. Cero significa que nadie declaró ninguna. */
      cuotas: number;
    }
  | {
      computable: false;
      /** Qué impide la resta. `declaration_total_observation` es el token del contrato cuando el
       *  código 91 no está observado; `cuota_sin_monto_legible` es nuestro, para una
       *  `applied_amount` que no se puede sumar (sumarla como 0 inflaría el pago declarado). */
      faltante: string[];
    };

function montoAplicado(cuota: F29PaymentApplication): number | null {
  const n = Number(cuota.applied_amount);
  return Number.isFinite(n) ? n : null;
}

export function f29ResidualDeclarado(payment: F29PaymentLink): F29Residual {
  const cuotas = payment.applications ?? [];
  const totalOficial = payment.declaration_receipt?.declaration_total;

  let aplicado = 0;
  for (const cuota of cuotas) {
    const monto = montoAplicado(cuota);
    /* Una cuota cuyo monto no se puede leer NO cuenta como 0: eso haría parecer que se pagó menos y
       el residual saldría más grande, con la misma cara de certeza. Se declara no computable. */
    if (monto === null) return { computable: false, faltante: ["cuota_sin_monto_legible"] };
    aplicado += monto;
  }

  if (totalOficial == null) {
    const faltante = payment.missing_requirements ?? [];
    return {
      computable: false,
      faltante: faltante.length > 0 ? faltante : ["declaration_total_observation"],
    };
  }

  return {
    computable: true,
    totalOficial,
    aplicado,
    residual: totalOficial - aplicado,
    cuotas: cuotas.length,
  };
}

/* ──────────────────── 4. La diferencia no explicada ──────────────────── */

export type F29DiferenciaNoExplicada =
  | {
      rotular: true;
      /** El valor tal como lo publica el contrato: `composed_total − declaration_total`. */
      delta: number;
      /** Su valor absoluto, que es lo que se muestra junto a la dirección. */
      magnitud: number;
      /** Hacia dónde apunta: los componentes observados suman menos, o más, que el total oficial. */
      direccion: "componentes_bajo_total" | "componentes_sobre_total";
    }
  | {
      rotular: false;
      /** `reconciliado` = el contrato publicó 0: los componentes explican el total completo.
       *  `no_computable` = publicó null, o sea faltan componentes para poder restar. */
      motivo: "reconciliado" | "no_computable";
    };

/** Rotula `unexplained_delta` cuando NO es cero ni null. Cero es un hecho (reconciliado) y null es
 *  otro (no computable): ninguno de los dos se rotula como diferencia, y ninguno se confunde con el
 *  otro. */
export function f29DiferenciaNoExplicada(
  delta: number | null | undefined,
): F29DiferenciaNoExplicada {
  if (delta == null || !Number.isFinite(delta)) return { rotular: false, motivo: "no_computable" };
  if (delta === 0) return { rotular: false, motivo: "reconciliado" };
  return {
    rotular: true,
    delta,
    magnitud: Math.abs(delta),
    direccion: delta < 0 ? "componentes_bajo_total" : "componentes_sobre_total",
  };
}

/** El total compuesto desde los componentes observados, derivado de la propia definición del
 *  contrato (`unexplained_delta = composed_total − declaration_total`) en vez de re-sumar los
 *  códigos acá: la fórmula de composición es del productor y copiarla la duplicaría mal. `null`
 *  cuando falta cualquiera de los dos términos. */
export function f29TotalCompuesto(
  declarationTotal: number | null | undefined,
  unexplainedDelta: number | null | undefined,
): number | null {
  if (declarationTotal == null || unexplainedDelta == null) return null;
  if (!Number.isFinite(declarationTotal) || !Number.isFinite(unexplainedDelta)) return null;
  return declarationTotal + unexplainedDelta;
}

/* ──────────────── 5. Cuál de los bridges del período ──────────────── */

/** `bridges[]` trae UNA entrada por declaración del período: una rectificatoria agrega otra, con su
 *  propio folio. Elegir "la primera" haría que una rectificatoria quedara invisible detrás de la
 *  declaración original. Reglas, en orden:
 *
 *    1. Si la pantalla ya está mostrando un folio, el bridge de ESE folio. Es el mismo F29 que el
 *       dueño tiene al frente; cualquier otro sería una cifra de otra declaración.
 *    2. Si no, el observado más recientemente (`observed_at`). Una rectificatoria se observa después
 *       de la declaración que rectifica.
 *
 *  `null` cuando no hay ninguno, que es el caso de un período sin F29 presentado: no hay nada que
 *  reconciliar, y eso no es lo mismo que una diferencia de cero. */
export function f29BridgeDelFolio(
  bridges: F29BridgeResponse[] | null | undefined,
  folio: number | null | undefined,
): F29BridgeResponse | null {
  const lista = bridges ?? [];
  if (lista.length === 0) return null;
  if (folio != null) {
    const delFolio = lista.find((b) => b.folio === folio);
    if (delFolio) return delFolio;
  }
  return lista.reduce((masReciente, actual) =>
    actual.observed_at > masReciente.observed_at ? actual : masReciente,
  );
}
