/* El núcleo del gate de aceptación: una cifra que puede NO EXISTIR, y un veredicto que distingue
   "coinciden" de "divergen" de "no pude medir". NO es un spec (no matchea *.spec.ts).

   POR QUÉ EXISTE. En la noche del 05-10-2026 se encontraron ocho instrumentos en verde que medían
   otra cosa, y uno de ellos era un barrido que concluía "todas verdes" recorriendo una lista vacía.
   La lección quedó escrita acá como código y no como advertencia:

     1. Una cifra que no se encontró NO es un cero ni una coincidencia: es `Medicion.medido === false`
        con el motivo nombrado.
     2. Un invariante al que le falta una de las cifras que compara devuelve `no-medible`, y
        `afirmar` lo hace FALLAR, con un mensaje distinto del de la divergencia. Nunca `test.skip`:
        un salto se ve verde en el reporte y eso es exactamente la falla que se quiere evitar.
     3. Comparar menos de dos puntos no es comparar. `mismaCifra` con un solo punto devuelve
        `no-medible`, así que un invariante al que se le cayeron todas las superficies menos una
        no puede declararse satisfecho.
     4. Sumar monedas distintas no es sumar. Si dos mediciones del mismo concepto vienen en moneda
        distinta, el veredicto es `divergen` — no se convierte nada para "poder comparar".

   Todo lo de este archivo es PURO: sin red, sin DOM, sin Playwright. Eso es lo que permite que los
   gemelos de `gemelos.spec.ts` siembren una cifra distinta y comprueben que el veredicto se pone
   rojo, sin depender de un backend ni de un navegador. */

/** Una cifra observada en una superficie concreta, o la razón nombrada por la que no se pudo leer. */
export type Medicion =
  | {
      readonly medido: true;
      /** Dónde se leyó, en lenguaje de quien revisa: "Inicio · KPI Hoy", "API · cash_today". */
      readonly fuente: string;
      readonly valor: number;
      /** ISO 4217 en mayúsculas. Una cifra sin moneda declarada es `"CLP"` sólo si la fuente lo dice. */
      readonly moneda: string;
      /** El texto crudo del que salió el número, para que la falla muestre lo que vio el test. */
      readonly crudo: string;
    }
  | {
      readonly medido: false;
      readonly fuente: string;
      readonly motivo: string;
    };

export function medido(
  fuente: string,
  valor: number,
  moneda = "CLP",
  crudo = String(valor),
): Medicion {
  if (!Number.isFinite(valor)) {
    return { medido: false, fuente, motivo: `el valor leído no es un número (${crudo})` };
  }
  return { medido: true, fuente, valor, moneda: moneda.toUpperCase(), crudo };
}

export function noMedible(fuente: string, motivo: string): Medicion {
  return { medido: false, fuente, motivo };
}

/** Envuelve un valor que puede faltar. `null`/`undefined`/NaN NO se aplastan a cero. */
export function desdeValorOpcional(
  fuente: string,
  valor: number | null | undefined,
  moneda = "CLP",
  motivoSiFalta = "la respuesta no trae esta cifra",
): Medicion {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return noMedible(fuente, motivoSiFalta);
  }
  return medido(fuente, valor, moneda);
}

export type Estado = "coinciden" | "divergen" | "no-medible";

export interface Veredicto {
  readonly estado: Estado;
  /** Qué se comparó, en una línea. */
  readonly concepto: string;
  /** El detalle completo que va al mensaje de falla: cada fuente con su cifra o su motivo. */
  readonly detalle: string;
  /** Fuentes que no se pudieron leer (vacío salvo en `no-medible`). */
  readonly faltan: readonly string[];
}

function formato(valor: number, moneda: string): string {
  const cur = (moneda || "CLP").toUpperCase();
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: cur === "CLP" ? 0 : 2,
      maximumFractionDigits: cur === "CLP" ? 0 : 2,
    }).format(valor);
  } catch {
    return `${cur} ${valor}`;
  }
}

function lineas(mediciones: readonly Medicion[]): string {
  return mediciones
    .map((m) =>
      m.medido
        ? `  · ${m.fuente}: ${formato(m.valor, m.moneda)}${m.crudo && m.crudo !== String(m.valor) ? ` (leído "${m.crudo}")` : ""}`
        : `  · ${m.fuente}: NO PUDE MEDIR — ${m.motivo}`,
    )
    .join("\n");
}

export interface OpcionesComparacion {
  /** Diferencia absoluta tolerada entre dos cifras. Por omisión 1 (un peso). */
  readonly tolerancia?: number;
  /**
   * Mínimo de fuentes exigidas. Por omisión 2: comparar un solo punto no es comparar.
   * Un invariante que nombra cuatro superficies pasa 4 acá, y si una no se pudo leer el
   * veredicto es `no-medible` aunque las otras tres coincidan.
   */
  readonly fuentesEsperadas?: number;
}

/**
 * ¿Todas estas fuentes publican la MISMA cifra?
 *
 * Se niega a concluir (devuelve `no-medible`) cuando:
 *   - llegaron menos fuentes que las esperadas (una superficie que no se midió no se descuenta);
 *   - alguna fuente no se pudo leer (y dice cuál y por qué).
 * Devuelve `divergen` cuando las cifras existen y no coinciden, o cuando vienen en monedas
 * distintas (invariante 5: no se convierte nada para forzar una comparación).
 */
export function mismaCifra(
  concepto: string,
  mediciones: readonly Medicion[],
  opts: OpcionesComparacion = {},
): Veredicto {
  const tolerancia = opts.tolerancia ?? 1;
  const esperadas = opts.fuentesEsperadas ?? 2;
  const detalle = lineas(mediciones);

  if (mediciones.length < Math.max(2, esperadas)) {
    return {
      estado: "no-medible",
      concepto,
      detalle: `se esperaban ${Math.max(2, esperadas)} fuentes y llegaron ${mediciones.length}; comparar ${mediciones.length === 1 ? "un solo punto" : "ningún punto"} no es comparar.\n${detalle}`,
      faltan: mediciones.filter((m) => !m.medido).map((m) => m.fuente),
    };
  }

  const faltan = mediciones.filter((m) => !m.medido);
  if (faltan.length > 0) {
    return {
      estado: "no-medible",
      concepto,
      detalle: `faltan ${faltan.length} de ${mediciones.length} cifras, así que NO se puede afirmar que coincidan.\n${detalle}`,
      faltan: faltan.map((m) => m.fuente),
    };
  }

  const leidas = mediciones.filter((m): m is Extract<Medicion, { medido: true }> => m.medido);
  const monedas = new Set(leidas.map((m) => m.moneda));
  if (monedas.size > 1) {
    return {
      estado: "divergen",
      concepto,
      detalle: `las cifras vienen en ${monedas.size} monedas distintas (${[...monedas].join(", ")}); no se convierte ninguna para poder compararlas.\n${detalle}`,
      faltan: [],
    };
  }

  const base = leidas[0]!;
  const peor = leidas.reduce(
    (acc, m) =>
      Math.abs(m.valor - base.valor) > acc.brecha
        ? { brecha: Math.abs(m.valor - base.valor), fuente: m.fuente }
        : acc,
    { brecha: 0, fuente: base.fuente },
  );
  if (peor.brecha > tolerancia) {
    return {
      estado: "divergen",
      concepto,
      detalle: `${peor.fuente} se separa de ${base.fuente} en ${formato(peor.brecha, base.moneda)} (tolerancia ${formato(tolerancia, base.moneda)}).\n${detalle}`,
      faltan: [],
    };
  }

  return {
    estado: "coinciden",
    concepto,
    detalle: `${leidas.length} fuentes publican ${formato(base.valor, base.moneda)}.\n${detalle}`,
    faltan: [],
  };
}

/**
 * Un invariante que no compara cifras sino que afirma la AUSENCIA de un patrón (un RUT
 * contradictorio, un movimiento en dos colas, una fecha futura). También se niega a concluir:
 * si no hubo nada que examinar, no se puede decir que no hay casos malos.
 *
 * @param universo cuántos elementos se examinaron de verdad.
 * @param casos los elementos que incumplen.
 */
export function sinCasos(
  concepto: string,
  universo: number,
  casos: readonly string[],
  queEsElUniverso: string,
): Veredicto {
  if (universo <= 0) {
    return {
      estado: "no-medible",
      concepto,
      detalle: `no hubo ${queEsElUniverso} que examinar (universo = 0): afirmar que no hay casos malos sobre una lista vacía es el barrido que concluye "todas verdes" sin mirar nada.`,
      faltan: [queEsElUniverso],
    };
  }
  if (casos.length > 0) {
    return {
      estado: "divergen",
      concepto,
      detalle: `${casos.length} de ${universo} ${queEsElUniverso} incumplen:\n${casos.map((c) => `  · ${c}`).join("\n")}`,
      faltan: [],
    };
  }
  return {
    estado: "coinciden",
    concepto,
    detalle: `se examinaron ${universo} ${queEsElUniverso} y ninguno incumple.`,
    faltan: [],
  };
}

/** Une varios veredictos: `no-medible` manda sobre `divergen`, y `divergen` sobre `coinciden`. */
export function todos(concepto: string, veredictos: readonly Veredicto[]): Veredicto {
  if (veredictos.length === 0) {
    return {
      estado: "no-medible",
      concepto,
      detalle: "no se evaluó ningún brazo de este invariante.",
      faltan: [concepto],
    };
  }
  const detalle = veredictos
    .map((v) => `[${v.estado.toUpperCase()}] ${v.concepto}\n${v.detalle}`)
    .join("\n\n");
  const noMedibles = veredictos.filter((v) => v.estado === "no-medible");
  if (noMedibles.length > 0) {
    return {
      estado: "no-medible",
      concepto,
      detalle,
      faltan: noMedibles.flatMap((v) => [...v.faltan]),
    };
  }
  if (veredictos.some((v) => v.estado === "divergen")) {
    return { estado: "divergen", concepto, detalle, faltan: [] };
  }
  return { estado: "coinciden", concepto, detalle, faltan: [] };
}
