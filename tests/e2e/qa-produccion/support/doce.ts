/* LAS DOCE INVARIANTES del gate de aceptación, como funciones PURAS. NO es un spec.

   Un invariante acá no sabe de Playwright, ni de red, ni de DOM: recibe las cifras ya leídas
   (`Medicion`) y devuelve un `Veredicto` de tres estados. Eso es a propósito y es lo que hace que
   el gate sea auditable:

     · `invariantes.spec.ts` arma las lecturas desde las superficies reales y pasa el veredicto a
       `afirmar`, que falla tanto con `divergen` como con `no-medible`.
     · `gemelos.spec.ts` arma las MISMAS lecturas a mano, con UNA cifra sembrada distinta, y
       comprueba que el veredicto se pone rojo. Si el gemelo no puede poner rojo el invariante, el
       invariante no mide nada, y el gemelo falla.

   Cada invariante se niega a concluir cuando le falta alguna de las cifras que compara, y cuando
   el universo que debía examinar está vacío. Esa segunda parte es la que faltó la noche del
   05-10-2026, cuando un barrido concluyó "todas verdes" recorriendo una lista vacía. */

import { mismaCifra, sinCasos, todos, type Medicion, type Veredicto } from "./medicion";

/** Metadatos de un invariante, para el inventario que `INV-00` audita. */
export interface FichaInvariante {
  readonly id: string;
  /** El enunciado del dueño del producto, textual. */
  readonly enunciado: string;
  /** Superficies que se comparan en producción. */
  readonly superficies: readonly string[];
  /**
   * Superficies que NO se comparan contra MSW, con el motivo nombrado. Vacío = se comparan todas.
   * `INV-00` exige que cada exclusión traiga motivo: una reducción silenciosa del instrumento es
   * exactamente cómo un gate se vuelve verde sin medir.
   */
  readonly reducidoEnMsw: readonly { readonly superficie: string; readonly motivo: string }[];
}

/* ── 1. Caja hoy: Inicio == Caja == Banco == API ───────────────────────────────────────────────── */

export interface LecturasCajaHoy {
  readonly inicio: Medicion;
  readonly caja: Medicion;
  readonly banco: Medicion;
  readonly api: Medicion;
}

export function inv01CajaHoy(l: LecturasCajaHoy): Veredicto {
  return mismaCifra(
    "Caja hoy: Inicio == Caja == Banco == API",
    [l.inicio, l.caja, l.banco, l.api],
    { fuentesEsperadas: 4 },
  );
}

/* ── 2. Por cobrar: Caja == Cobrar == API ─────────────────────────────────────────────────────── */

export interface LecturasTresPuntos {
  readonly caja: Medicion;
  readonly pantallaPropia: Medicion;
  readonly api: Medicion;
}

export function inv02PorCobrar(l: LecturasTresPuntos): Veredicto {
  return mismaCifra("Por cobrar: Caja == Cobrar == API", [l.caja, l.pantallaPropia, l.api], {
    fuentesEsperadas: 3,
  });
}

/* ── 3. Por pagar: Caja == Pagar == API ───────────────────────────────────────────────────────── */

export function inv03PorPagar(l: LecturasTresPuntos): Veredicto {
  return mismaCifra("Por pagar: Caja == Pagar == API", [l.caja, l.pantallaPropia, l.api], {
    fuentesEsperadas: 3,
  });
}

/* ── 4. Pendientes: Caja == Bandeja == work-inbox ─────────────────────────────────────────────── */

export function inv04Pendientes(l: LecturasTresPuntos): Veredicto {
  // Pendientes se cuentan en unidades, no en pesos: la tolerancia es cero movimientos.
  return mismaCifra(
    "Pendientes: Caja == Bandeja == work-inbox",
    [l.caja, l.pantallaPropia, l.api],
    { fuentesEsperadas: 3, tolerancia: 0 },
  );
}

/* ── 5. Moneda: nunca sumar CLP + USD en un mismo KPI ─────────────────────────────────────────── */

export interface KpiConMonedas {
  /** Cómo se llama el KPI en la pantalla. */
  readonly kpi: string;
  /** Monedas de los registros que ALIMENTAN ese KPI, tal como las declara la fuente. */
  readonly monedasDeOrigen: readonly string[];
  /** Monedas que el KPI PUBLICA por separado (un subtotal por moneda). */
  readonly monedasPublicadas: readonly string[];
}

/**
 * Un KPI que recibe registros en dos monedas tiene que publicar dos cifras, no una.
 * Se niega a concluir si no se identificó ningún KPI con registros de más de una moneda: sin un
 * caso de moneda mezclada en los datos, decir "no suma monedas" es no haber mirado.
 */
export function inv05Moneda(kpis: readonly KpiConMonedas[]): Veredicto {
  const expuestos = kpis.filter(
    (k) => new Set(k.monedasDeOrigen.map((m) => m.toUpperCase())).size > 1,
  );
  const casos = expuestos
    .filter((k) => new Set(k.monedasPublicadas.map((m) => m.toUpperCase())).size <= 1)
    .map(
      (k) =>
        `"${k.kpi}" recibe registros en ${[...new Set(k.monedasDeOrigen)].join(" + ")} y publica una sola cifra (${k.monedasPublicadas.join(", ") || "ninguna moneda declarada"}): está sumando monedas distintas`,
    );
  return sinCasos(
    "Moneda: ningún KPI suma CLP + USD",
    expuestos.length,
    casos,
    "KPI alimentados por más de una moneda",
  );
}

/* ── 6. Sociedad: una sociedad vacía muestra $0 propio, nunca datos de otra ───────────────────── */

export interface LecturasSociedadVacia {
  /** Id de la sociedad sin datos que se usó para medir. */
  readonly sociedad: string;
  /** La cifra que la pantalla muestra con esa sociedad activa. */
  readonly propia: Medicion;
  /** Cifras de OTRAS sociedades, para comprobar que ninguna se filtró. */
  readonly deOtras: readonly { readonly sociedad: string; readonly valor: number }[];
}

export function inv06Sociedad(l: LecturasSociedadVacia | null): Veredicto {
  if (!l) {
    return {
      estado: "no-medible",
      concepto: "Sociedad: una sociedad vacía muestra $0 propio",
      detalle:
        "no se identificó ninguna sociedad sin cuentas ni documentos con la que medir el aislamiento; sin ese caso el invariante no tiene nada que observar.",
      faltan: ["sociedad vacía"],
    };
  }
  const propia = l.propia;
  if (!propia.medido) {
    return {
      estado: "no-medible",
      concepto: "Sociedad: una sociedad vacía muestra $0 propio",
      detalle: `con la sociedad ${l.sociedad} activa no se pudo leer la cifra: ${propia.motivo}. Una pantalla que no publica cifra no prueba aislamiento.`,
      faltan: [propia.fuente],
    };
  }
  const filtradas = l.deOtras
    .filter((o) => Math.abs(o.valor - propia.valor) < 1 && Math.abs(o.valor) >= 1)
    .map(
      (o) =>
        `la sociedad vacía ${l.sociedad} muestra ${propia.crudo}, que es exactamente la cifra de ${o.sociedad}: se está filtrando el dato de otra sociedad`,
    );
  if (filtradas.length > 0) {
    return {
      estado: "divergen",
      concepto: "Sociedad: una sociedad vacía muestra $0 propio",
      detalle: filtradas.join("\n"),
      faltan: [],
    };
  }
  if (Math.abs(propia.valor) >= 1) {
    return {
      estado: "divergen",
      concepto: "Sociedad: una sociedad vacía muestra $0 propio",
      detalle: `la sociedad ${l.sociedad} no tiene cuentas ni documentos propios y la pantalla publica ${propia.crudo} en vez de $0.`,
      faltan: [],
    };
  }
  return {
    estado: "coinciden",
    concepto: "Sociedad: una sociedad vacía muestra $0 propio",
    detalle: `la sociedad ${l.sociedad} publica ${propia.crudo}, y ninguna de las ${l.deOtras.length} cifras de otras sociedades coincide con ella.`,
    faltan: [],
  };
}

/* ── 7. Identidad: un RUT contradictorio nunca produce una sugerencia de conciliación ─────────── */

export interface LecturasIdentidad {
  /** Propuestas de conciliación cuya glosa trae al menos un RUT válido: el universo real. */
  readonly propuestasConRutEnGlosa: number;
  /** Las que proponen un documento de OTRO RUT. */
  readonly contradictorias: readonly string[];
}

export function inv07Identidad(l: LecturasIdentidad): Veredicto {
  return sinCasos(
    "Identidad: un RUT contradictorio no produce sugerencia",
    l.propuestasConRutEnGlosa,
    l.contradictorias,
    "propuestas de conciliación con RUT en la glosa",
  );
}

/* ── 8. Fechas: el día de negocio es America/Santiago, no UTC ─────────────────────────────────── */

export interface LecturasFechas {
  /** `YYYY-MM-DD` del día civil en Chile al momento de correr. */
  readonly diaDeNegocio: string;
  /** Cuántos registros fechados se examinaron. */
  readonly registrosExaminados: number;
  /** Los que están fechados después del día de negocio chileno. */
  readonly posteriores: readonly string[];
  /** Fecha que la pantalla declara como "hoy", si la publica. */
  readonly hoyEnPantalla: string | null;
}

export function inv08Fechas(l: LecturasFechas): Veredicto {
  const brazos: Veredicto[] = [
    sinCasos(
      "Fechas: ningún registro después del día de negocio chileno",
      l.registrosExaminados,
      l.posteriores,
      "registros fechados",
    ),
  ];
  brazos.push(
    l.hoyEnPantalla === null
      ? {
          estado: "no-medible",
          concepto: 'Fechas: el "hoy" de la pantalla es el día chileno',
          detalle:
            'la pantalla no publica la fecha que considera "hoy", así que no se puede comprobar que use America/Santiago y no UTC.',
          faltan: ['fecha "hoy" en pantalla'],
        }
      : l.hoyEnPantalla === l.diaDeNegocio
        ? {
            estado: "coinciden",
            concepto: 'Fechas: el "hoy" de la pantalla es el día chileno',
            detalle: `la pantalla dice ${l.hoyEnPantalla} y el día civil en Chile es ${l.diaDeNegocio}.`,
            faltan: [],
          }
        : {
            estado: "divergen",
            concepto: 'Fechas: el "hoy" de la pantalla es el día chileno',
            detalle: `la pantalla dice ${l.hoyEnPantalla} y el día civil en Chile es ${l.diaDeNegocio}: el día de negocio se está resolviendo en otro huso.`,
            faltan: [],
          },
  );
  return todos("Fechas: el día de negocio es America/Santiago", brazos);
}

/* ── 9. Payroll: obligación / pago / asignación consistentes ──────────────────────────────────── */

export interface LecturasPayroll {
  readonly periodo: string;
  readonly obligacion: Medicion;
  readonly pago: Medicion;
  /** Monto efectivamente ASIGNADO de ese pago a esa obligación. */
  readonly asignacion: Medicion;
}

export function inv09Payroll(l: LecturasPayroll): Veredicto {
  return mismaCifra(
    `Payroll ${l.periodo}: obligación == pago == asignación`,
    [l.obligacion, l.pago, l.asignacion],
    { fuentesEsperadas: 3 },
  );
}

/* ── 10. F29: declarado / pago / residual consistentes ────────────────────────────────────────── */

export interface LecturasF29 {
  readonly periodo: string;
  readonly declarado: Medicion;
  readonly pagado: Medicion;
  readonly residual: Medicion;
}

/** `declarado == pagado + residual`: lo declarado se paga o queda debiendo, no se evapora. */
export function inv10F29(l: LecturasF29): Veredicto {
  if (!l.declarado.medido || !l.pagado.medido || !l.residual.medido) {
    const faltan = [l.declarado, l.pagado, l.residual].filter((m) => !m.medido);
    return {
      estado: "no-medible",
      concepto: `F29 ${l.periodo}: declarado == pagado + residual`,
      detalle: `faltan ${faltan.length} de 3 cifras:\n${faltan
        .map((m) => `  · ${m.fuente}: NO PUDE MEDIR — ${(m as { motivo: string }).motivo}`)
        .join("\n")}`,
      faltan: faltan.map((m) => m.fuente),
    };
  }
  const suma = l.pagado.valor + l.residual.valor;
  const brecha = Math.abs(l.declarado.valor - suma);
  const detalle = `declarado ${l.declarado.crudo} · pagado ${l.pagado.crudo} · residual ${l.residual.crudo}`;
  return brecha > 1
    ? {
        estado: "divergen",
        concepto: `F29 ${l.periodo}: declarado == pagado + residual`,
        detalle: `${detalle} → pagado + residual = ${suma} y declarado = ${l.declarado.valor}; sobran o faltan ${brecha}.`,
        faltan: [],
      }
    : {
        estado: "coinciden",
        concepto: `F29 ${l.periodo}: declarado == pagado + residual`,
        detalle,
        faltan: [],
      };
}

/* ── 11. D08: el mismo UUID de contraparte en todas las superficies ───────────────────────────── */

export interface LecturasD08 {
  /** Cómo se identificó a la contraparte (nombre o RUT), para el mensaje. */
  readonly contraparte: string;
  readonly porSuperficie: readonly {
    readonly superficie: string;
    readonly uuid: string | null;
    readonly motivoSiFalta?: string;
  }[];
}

export function inv11D08(l: LecturasD08): Veredicto {
  const concepto = `D08: mismo UUID de contraparte (${l.contraparte})`;
  if (l.porSuperficie.length < 2) {
    return {
      estado: "no-medible",
      concepto,
      detalle: `se inspeccionaron ${l.porSuperficie.length} superficies: con menos de dos no hay identidad que comparar.`,
      faltan: ["superficies"],
    };
  }
  const faltan = l.porSuperficie.filter((s) => !s.uuid);
  if (faltan.length > 0) {
    return {
      estado: "no-medible",
      concepto,
      detalle: `${faltan.length} de ${l.porSuperficie.length} superficies no publican el UUID de la contraparte:\n${faltan
        .map(
          (s) =>
            `  · ${s.superficie}: ${s.motivoSiFalta ?? "no viene en la respuesta ni en el DOM"}`,
        )
        .join("\n")}`,
      faltan: faltan.map((s) => s.superficie),
    };
  }
  const distintos = new Set(l.porSuperficie.map((s) => s.uuid!.toLowerCase()));
  const detalle = l.porSuperficie.map((s) => `  · ${s.superficie}: ${s.uuid}`).join("\n");
  return distintos.size > 1
    ? {
        estado: "divergen",
        concepto,
        detalle: `la misma contraparte tiene ${distintos.size} identidades distintas:\n${detalle}`,
        faltan: [],
      }
    : { estado: "coinciden", concepto, detalle, faltan: [] };
}

/* ── 12. PULSO y QHS no contradicen a Caja ────────────────────────────────────────────────────── */

export interface LecturasPulso {
  /** `true` = Caja declara que no alcanza para los pagos del período. `null` = no se sabe. */
  readonly brechaDeCaja: boolean | null;
  /** Qué dice el veredicto de PULSO y de QHS, textual. */
  readonly veredictos: readonly { readonly nombre: string; readonly texto: string | null }[];
}

/** Frases tranquilizadoras que NO pueden convivir con una brecha de caja declarada. */
const TRANQUILIZADORAS =
  /(cubre|cubiertos?|alcanza|holgura|sin riesgo|todo en orden|saludable|sólida|solida)/i;

export function inv12PulsoQhs(l: LecturasPulso): Veredicto {
  const concepto = "PULSO y QHS no contradicen a Caja";
  if (l.brechaDeCaja === null) {
    return {
      estado: "no-medible",
      concepto,
      detalle:
        "Caja no publica si hay o no brecha, así que no hay con qué contrastar lo que dicen PULSO y QHS.",
      faltan: ["brecha de caja"],
    };
  }
  const mudos = l.veredictos.filter((v) => !v.texto);
  if (mudos.length > 0) {
    return {
      estado: "no-medible",
      concepto,
      detalle: `${mudos.map((v) => v.nombre).join(" y ")} no publica${mudos.length === 1 ? "" : "n"} veredicto: no se puede afirmar que no contradi${mudos.length === 1 ? "ga" : "gan"} a Caja.`,
      faltan: mudos.map((v) => v.nombre),
    };
  }
  const detalle = `Caja declara brecha: ${l.brechaDeCaja ? "sí" : "no"}\n${l.veredictos
    .map((v) => `  · ${v.nombre}: "${v.texto}"`)
    .join("\n")}`;
  if (!l.brechaDeCaja) {
    return { estado: "coinciden", concepto, detalle, faltan: [] };
  }
  const contradicen = l.veredictos.filter((v) => TRANQUILIZADORAS.test(v.texto!));
  return contradicen.length > 0
    ? {
        estado: "divergen",
        concepto,
        detalle: `${contradicen.map((v) => v.nombre).join(" y ")} tranquiliza mientras Caja declara brecha.\n${detalle}`,
        faltan: [],
      }
    : { estado: "coinciden", concepto, detalle, faltan: [] };
}

/* ── El inventario ────────────────────────────────────────────────────────────────────────────── */

/** Las doce, textuales del dueño del producto. `INV-00` audita que estén las doce y sólo las doce. */
export const DOCE: readonly FichaInvariante[] = [
  {
    id: "INV-01",
    enunciado: "Caja hoy: Inicio == Caja == Banco == API",
    superficies: ["Inicio", "Caja", "Banco", "API"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-02",
    enunciado: "Por cobrar: Caja == Cobrar == API",
    superficies: ["Caja", "Cobrar", "API"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-03",
    enunciado: "Por pagar: Caja == Pagar == API",
    superficies: ["Caja", "Pagar", "API"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-04",
    enunciado: "Pendientes: Caja == Bandeja == work-inbox",
    superficies: ["Caja", "Bandeja", "work-inbox"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-05",
    enunciado: "Moneda: nunca sumar CLP + USD en un mismo KPI",
    superficies: ["Caja", "Banco", "API"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-06",
    enunciado: "Sociedad: una sociedad vacía muestra $0 propio, nunca datos de otra",
    superficies: ["Caja", "API legal-entities"],
    reducidoEnMsw: [
      {
        superficie: "sociedad vacía real",
        motivo:
          "MSW publica un solo tenant con datos; la sociedad sin cuentas que hace observable el aislamiento existe en producción (77c2808e-5fbc-4abd-9b5b-3a6d60e2838f). En MSW se prueba el comparador con cifras sembradas.",
      },
    ],
  },
  {
    id: "INV-07",
    enunciado: "Identidad: un RUT contradictorio nunca produce una sugerencia de conciliación",
    /* Las dos superficies del invariante son las dos IDENTIDADES que la propuesta hace coincidir:
       el RUT que viene en la glosa del movimiento bancario y el RUT del documento que se propone
       calzar. Son dos lecturas distintas de la misma respuesta y la contradicción vive entre ellas. */
    superficies: ["RUT de la glosa del movimiento", "RUT del documento propuesto"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-08",
    enunciado: "Fechas: el día de negocio es America/Santiago, no UTC",
    superficies: ["Banco", "API bank-movements"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-09",
    enunciado: "Payroll: obligación / pago / asignación consistentes",
    superficies: ["Remuneraciones", "API payroll-settlements"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-10",
    enunciado: "F29: declarado / pago / residual consistentes",
    superficies: ["Impuestos F29", "API sii/f29"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-11",
    enunciado: "D08: el mismo UUID de contraparte en todas las superficies",
    superficies: ["Cobrar", "Pagar", "API receivables", "API payables"],
    reducidoEnMsw: [],
  },
  {
    id: "INV-12",
    enunciado: "PULSO y QHS no contradicen a Caja",
    superficies: ["Caja", "PULSO", "QHS"],
    reducidoEnMsw: [],
  },
] as const;
