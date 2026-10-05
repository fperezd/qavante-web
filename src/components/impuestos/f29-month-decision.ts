/* Qué le ofrece el detalle F29 de un mes: ¿una decisión de pago hacia adelante, o la historia de una
   decisión ya tomada?

   El defecto que cierra esto (D13, issue #202): el detalle calculaba que el período estaba pagado —
   `estado === "sin_giro"` con el período declarado, que el contrato define literalmente como pagado
   (`F29GirosResponse.estado`: "sin_giro (nada pendiente; con período declarado = pagado)") — y usaba
   ese hecho SÓLO para pintar un badge verde. Debajo del badge seguía ofreciendo "Pagar todo" y
   "Postergar el IVA" sobre un F29 que ya no debe nada. Un dueño que entra a un mes cerrado leía una
   orden de pago.

   La separación vive acá, pura y sin React, para que un test la fije sin montar la tarjeta.

   ORDEN DE PRECEDENCIA, y por qué:

     1. `postergado` gana sobre todo. Un período que postergó el IVA tomó su decisión y además DEBE
        algo todavía (el IVA diferido, aparte). Mostrarlo como pagado esconde una deuda viva.
     2. `pagado` gana sobre las opciones. No hay nada que decidir hacia adelante.
     3. `opciones` es el único estado que ofrece pagar, y exige haber podido VERIFICAR que hay algo
        pendiente.

   Sobre la verificación: `estado` sale de la Consulta de Giros, en vivo contra el SII. Si esa consulta
   no responde, no sabemos si el período está pagado. Antes eso caía en `opciones` por omisión — o sea,
   la ausencia de respuesta del SII se convertía en "te falta pagar". Acá no: sin respuesta el período
   declarado va a `historia`, que muestra lo que el F29 declaró sin ordenar ningún pago. Un período SIN
   declarar sí cae en `opciones` aunque los giros no respondan, porque ahí la decisión de pago está
   abierta por definición: no hay F29 presentado que pueda estar pagado. */

export type F29MesPresentacion = "postergado" | "pagado" | "historia" | "opciones";

export interface F29MesDecisionInput {
  /** Código 755 del F29 declarado: el IVA que la declaración ya postergó. */
  ivaPostergado: number | null | undefined;
  /** `estado` de la Consulta de Giros, o `undefined` si la consulta no respondió. */
  girosEstado: string | undefined;
  /** `postergado_iva` de la Consulta de Giros: `null`/`undefined` = no se sabe. */
  girosPostergadoIva: boolean | null | undefined;
  /** El período tiene un F29 presentado. */
  declarado: boolean;
}

export function f29MesPresentacion(input: F29MesDecisionInput): F29MesPresentacion {
  const postergoElIva = (input.ivaPostergado ?? 0) > 0 || input.girosPostergadoIva === true;
  if (postergoElIva) return "postergado";

  /* El contrato define `sin_giro` + declarado como pagado. Las otras formas de `estado`
     (`giro_no_determinado`, `multiples_no_determinado`) significan que SÍ hay giros: eso es una
     deuda viva y corresponde ofrecer las opciones. */
  if (input.girosEstado === "sin_giro" && input.declarado) return "pagado";

  /* Sin respuesta de la Consulta de Giros no se puede afirmar que falte pagar. Un período declarado
     muestra su historia; uno sin declarar sigue siendo una decisión abierta. */
  if (input.girosEstado === undefined) return input.declarado ? "historia" : "opciones";

  return "opciones";
}
