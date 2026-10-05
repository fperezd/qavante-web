/* `ApplicationBlocker` del contrato → la forma que consumen las pantallas.
 *
 * Vive acá, y no dentro de una pantalla, porque **dos superficies ofrecen el mismo botón de
 * conciliar** y las dos tienen que leer la misma decisión del servidor: la Bandeja de
 * excepciones (`/bandeja`) y la cola de conciliación (`/caja/conciliacion`). Tener dos
 * definiciones de "por qué no se puede conciliar" es cómo se vuelven a separar.
 *
 * El contrato (api#1084, issue #1075) lo explica así:
 *
 *   "La cola proponía candidatos con una banda de dos lados (|saldo - monto| <= ε) y el
 *    aplicador los rechazaba con un guard de uno solo (saldo - monto < 0): la pantalla ofrecía
 *    'Sí, conciliar' contra documentos que el backend rechaza SIEMPRE con 409. Ahora la
 *    propuesta llega igual —saber que hay una factura que casi calza es información útil— pero
 *    declarada como no confirmable y con la causa escrita."
 *
 * Y sobre `retryable`:
 *
 *   "`retryable` es del backend, no de la pantalla: con `false`, repetir la misma acción da el
 *    mismo resultado y la copia no debe decir 'vuelve a intentar'."
 */

/**
 * Por qué una propuesta NO se puede conciliar, en palabras del servidor.
 *
 * `codigo` NO es un enum en el contrato: los valores viven en la descripción del campo
 * (`no_document_suggested`, `movement_exceeds_document`, `subset_sum_mismatch`,
 * `stale_suggestion`, `document_settled`, `currency_mismatch`, `infeasible_date`) y el schema
 * lo declara string suelto. Así que viaja como string y nadie hace exhaustividad sobre él.
 */
export interface BloqueoAplicacion {
  codigo: string;
  /** Frase lista para mostrar, con el monto del problema cuando hay uno. */
  mensaje: string;
  /** Si repetir la acción (o refrescar) puede cambiar el resultado. */
  reintentable: boolean;
}

/** `ApplicationBlocker` del contrato → `BloqueoAplicacion`. `null` si no vino o no trae frase. */
export function bloqueoDe(
  raw: { code?: string | null; message?: string | null; retryable?: boolean | null } | null,
): BloqueoAplicacion | null {
  if (!raw || !raw.message) return null;
  return {
    codigo: raw.code ?? "",
    mensaje: raw.message,
    /* Sin `retryable` explícito NO se promete un reintento: prometerlo es el error que este
       mapeo existe para evitar. */
    reintentable: raw.retryable === true,
  };
}
