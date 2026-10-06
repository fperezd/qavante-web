import { concordar, formatCount } from "@/lib/formatters/count";
import { formatDateLong } from "@/lib/formatters/date";
import { formatPct } from "@/lib/formatters/pct";
import type {
  SaludInstrument,
  SaludQualityItem,
  SaludResponse,
  SaludScoreSnapshot,
} from "@/lib/api/salud";

/* Modelo de la pantalla Salud sobre el CONTRATO canónico (`GET /api/management/salud`).

   Qué hace este módulo y qué NO hace, porque la diferencia es la razón de que exista:

   - Presenta exactamente lo que el contrato publica: score, banda, fecha de corte, versión del
     modelo, variación, serie, subíndices con su peso, motivos y el respaldo del dato. Nada más.
   - NO reconstruye el score, NO promedia, NO rellena un subíndice que no vino y NO convierte
     una ausencia en una clasificación. Cuando falta un instrumento, lo que se dice es CUÁNTO
     cubre la lectura, con número. Esa es la única protección que esta pantalla necesita.
   - NO existe clasificación por defecto. Si la banda llega con un identificador que este
     módulo no nombra, el score se muestra igual y el identificador queda como identificador —
     nunca como una frase sobre la empresa.

   El prototipo de UX (`salud-view.tsx` + `salud-model.ts` + `salud-fixtures.ts`) sigue vivo
   para diseño, con su vocabulario propio y sus tipos locales. Este modelo no lo usa ni lo
   adapta: mapear cuadrantes, curvas de caja o decisiones sobre datos que el contrato no
   publica sería fabricarlos. */

/** Cuántos subíndices compone cada instrumento según la política activa que publica el
 *  contrato (PULSO: COB/RUN/DPC/CAL; Health Score: TRAY/GEN/RES/DEBT/EXP). Es el denominador
 *  de la frase de cobertura: sin él, "trae 3 subíndices" no dice si falta algo. */
export const SALUD_COMPOSICION: Record<SaludInstrument, number> = { pulso: 4, qhs: 5 };

export const SALUD_TITULO: Record<SaludInstrument, string> = {
  pulso: "Pulso",
  qhs: "Health Score",
};

export type SaludTono = "ok" | "warn" | "bad";

const BANDAS: Record<SaludInstrument, Record<string, { etiqueta: string; tono: SaludTono }>> = {
  pulso: {
    strong: { etiqueta: "Fuerte", tono: "ok" },
    stable: { etiqueta: "Estable", tono: "ok" },
    weak: { etiqueta: "Débil", tono: "warn" },
    critical: { etiqueta: "Crítico", tono: "bad" },
  },
  qhs: {
    muy_sana: { etiqueta: "Muy sana", tono: "ok" },
    sana_alertas: { etiqueta: "Sana con alertas", tono: "ok" },
    observacion: { etiqueta: "En observación", tono: "warn" },
    vulnerable: { etiqueta: "Vulnerable", tono: "warn" },
    riesgo_alto: { etiqueta: "Riesgo alto", tono: "bad" },
  },
};

const SUBINDICES: Record<string, string> = {
  /* PULSO (ADR-0064 §3). */
  COB: "Cobertura de tus compromisos",
  RUN: "Semanas que aguanta tu caja",
  DPC: "Días hasta el punto crítico",
  CAL: "Calidad de lo que entra",
  /* Health Score. */
  TRAY: "Trayectoria: creces, te estancas o caes",
  GEN: "Generación de caja de la operación",
  RES: "Resiliencia ante un golpe",
  DEBT: "Deuda y presión financiera",
  EXP: "Disciplina de gastos",
};

const RESPALDOS: Record<string, string> = {
  freshness: "Frescura de las fuentes",
  completeness: "Completitud de la información",
  lineage: "Procedencia acreditada",
  temporal_coverage: "Cobertura del período",
  entity_coverage: "Cobertura de tu empresa",
};

/** Qué se verificó para sostener la lectura. Son evidencias binarias: entraron o no. */
const EVIDENCIAS: Record<string, string> = {
  QHS_GUARDRAIL_PULSE_30D_EVIDENCE: "Cómo te fue en los últimos 30 días",
  QHS_GUARDRAIL_GEN_PERSISTENCE_EVIDENCE: "La generación de caja de dos trimestres seguidos",
  QHS_SUBINDEX_METHODOLOGY_EVIDENCE: "El método ratificado de las cinco partes",
  QHS_DATA_CONFIDENCE_POLICY_EVIDENCE: "La política de respaldo del dato",
  QHS_DATA_CONFIDENCE_SCOPE_EVIDENCE: "Que todo lo medido sea de tu empresa y tu moneda",
};

export type SaludMotivoTipo = "hallazgo" | "limite";

/* Vocabulario de motivos que publica el contrato, en castellano de Chile.

   `description` del servidor SIEMPRE gana: este catálogo es el respaldo para cuando llega
   nula, y existe porque un identificador en mayúsculas no es una frase para una persona.
   Un motivo que no esté acá NO se inventa ni se asimila a otro: se cuenta y su identificador
   se muestra como identificador (ver `motivosPorNombrar`).

   `hallazgo` le pasa al NEGOCIO; `limite` le pasa a la MEDICIÓN. Mezclarlos haría que a una
   empresa a la que sólo le falta acreditar una moneda se le hable como si se estuviera
   deteriorando. */
const MOTIVOS: Record<string, { tipo: SaludMotivoTipo; texto: string }> = {
  QHS_GROWTH_WITHOUT_CASH_CONVERSION: {
    tipo: "hallazgo",
    texto: "Estás vendiendo más, pero te queda menos plata por cada peso que cobras.",
  },
  QHS_CAP_LOW_PULSE_30D: {
    tipo: "hallazgo",
    texto:
      "En los últimos 30 días no te alcanzó para cubrir tus compromisos, así que el puntaje queda topado por arriba.",
  },
  QHS_CAP_PERSISTENT_LOW_GEN: {
    tipo: "hallazgo",
    texto:
      "Llevas dos trimestres seguidos generando poca caja con la operación, así que el puntaje queda topado por arriba.",
  },
  DPC_LE_10: {
    tipo: "hallazgo",
    texto: "Te quedan 10 días o menos hasta el punto en que la caja no alcanza.",
  },
  PAYROLL_7D_UNCOVERED: {
    tipo: "hallazgo",
    texto: "La nómina de los próximos 7 días no queda cubierta con la caja de hoy.",
  },
  QHS_INSUFFICIENT_DATA: {
    tipo: "limite",
    texto:
      "Esta parte quedó fuera de la medición por falta de respaldo. No es un mal resultado: todavía no se puede afirmar nada.",
  },
  QHS_SCOPE_MISMATCH: {
    tipo: "limite",
    texto:
      "Parte de la información encontrada pertenece a otra sociedad, otra moneda u otro cierre, así que quedó fuera.",
  },
  QHS_UNKNOWN_CURRENCY: {
    tipo: "limite",
    texto:
      "Hay movimientos cuya moneda ninguna fuente acredita. No se suman como pesos: quedan fuera, y por eso la lectura cubre menos.",
  },
  QHS_COUNTERPARTY_UNRESOLVED: {
    tipo: "limite",
    texto:
      "Hay pagos cuya glosa no permite reconocer a quién se le pagó, así que quedaron fuera de las mediciones que agrupan por contraparte.",
  },
  QHS_SOURCE_LINEAGE_UNKNOWN: {
    tipo: "limite",
    texto: "De una de las fuentes usadas no se pudo establecer el origen.",
  },
  QHS_SOURCE_STALE: {
    tipo: "limite",
    texto: "Una de las fuentes viene con más antigüedad de la que este cálculo admite.",
  },
  QHS_DATE_UNVERIFIED: {
    tipo: "limite",
    texto: "Hay fechas que ningún documento respalda, así que no se usaron como si lo estuvieran.",
  },
  QHS_INCOMPLETE_TEMPORAL_COVERAGE: {
    tipo: "limite",
    texto: "La historia acumulada todavía es más corta que la ventana que este cálculo necesita.",
  },
  QHS_DATASET_TRUNCATED: {
    tipo: "limite",
    texto:
      "La consulta a la fuente volvió incompleta. Que algo falte en esa respuesta no significa que no exista.",
  },
  QHS_SUBINDEX_UNAVAILABLE: {
    tipo: "limite",
    texto: "Una de las partes del puntaje quedó fuera del cálculo.",
  },
  QHS_METHOD_UNCERTIFIED: {
    tipo: "limite",
    texto: "El método de cálculo todavía espera ratificación, así que este puntaje queda topado.",
  },
  QHS_DATA_CONFIDENCE_INSUFFICIENT: {
    tipo: "limite",
    texto:
      "El respaldo del dato quedó bajo el mínimo de la política. El puntaje se muestra, y no se usa para recomendarte una acción.",
  },
  QHS_NOT_ATTRIBUTABLE_TO_LEGAL_ENTITY: {
    tipo: "limite",
    texto:
      "Una parte del cálculo depende de información que hoy no se puede separar por sociedad, así que quedó fuera.",
  },
  QHS_ELASTICITY_NOT_APPLICABLE: {
    tipo: "limite",
    texto:
      "Tus cobros no crecieron en el período, y la medida de disciplina de gastos sólo tiene sentido comparada contra ingresos que suben.",
  },
  QHS_USER_CONFIRMATION_MISSING: {
    tipo: "limite",
    texto:
      "Falta que confirmes qué gastos fueron inversiones o extraordinarios. Sin eso esa parte no se calcula, para no darte una alerta falsa.",
  },
  QHS_NOT_COMPOSABLE: {
    tipo: "limite",
    texto: "Falta al menos una de las cinco partes, así que el puntaje total queda topado.",
  },
  QHS_PRELIMINARY_SUBINDEX: {
    tipo: "limite",
    texto: "Al menos una de las cinco partes todavía se está completando, y eso topa el total.",
  },
  QHS_PRELIMINARY_LOW_CONFIDENCE: {
    tipo: "limite",
    texto: "El respaldo del dato quedó bajo el mínimo de la política, y eso topa el puntaje.",
  },
  QHS_PRELIMINARY_INCOMPLETE_GUARDRAILS: {
    tipo: "limite",
    texto: "No se pudieron verificar todos los topes de seguridad, y eso topa el puntaje.",
  },
  "unknown_guardrail:pulse_30d_average": {
    tipo: "limite",
    texto:
      "Cómo te fue en los últimos 30 días quedó fuera del cálculo, así que uno de los topes de seguridad quedó sin verificar.",
  },
  "unknown_guardrail:gen_quarters": {
    tipo: "limite",
    texto: "La generación de caja de los trimestres anteriores quedó fuera de esta revisión.",
  },
  "unknown_guardrail:gen_insufficient_history": {
    tipo: "limite",
    texto: "Todavía faltan trimestres completos para revisar la generación de caja.",
  },
  unknown_data_confidence: {
    tipo: "limite",
    texto: "El respaldo del dato quedó fuera del cálculo, y eso topa el puntaje.",
  },
  QHS_EFFECTIVE_CEILING_APPLIED: {
    tipo: "limite",
    texto:
      "El puntaje llegó al techo del instrumento. Ninguna empresa saca 100: es una decisión de diseño.",
  },
  QHS_EFFECTIVE_FLOOR_APPLIED: {
    tipo: "limite",
    texto: "El puntaje llegó al piso del instrumento.",
  },
};

export interface SaludSubindiceVista {
  clave: string;
  etiqueta: string;
  /** Rótulo cuando el identificador del subíndice no está nombrado en esta pantalla. */
  identificador: string | null;
  valor: string;
  peso: string;
  banda: string | null;
}

export interface SaludMotivoVista {
  clave: string;
  texto: string;
  tipo: SaludMotivoTipo;
  impacto: string | null;
  parte: string | null;
}

/** Un identificador que llegó del contrato y que esta pantalla todavía no nombra. Se cuenta y
 *  se muestra COMO identificador: jamás como una frase dirigida al usuario. */
export interface SaludIdentificadorVista {
  identificador: string;
  detalle: string | null;
}

export interface SaludRespaldoVista {
  valor: string;
  /** Cuánto de los respaldos ponderados quedó acreditado, con número. */
  resumen: string;
  componentes: { etiqueta: string; valor: string }[];
  verificaciones: { etiqueta: string; acreditada: boolean }[];
  porNombrar: SaludIdentificadorVista[];
}

export interface SaludTendenciaPuntoVista {
  clave: string;
  fecha: string;
  valor: string;
  /** Altura relativa en la barra, 0 a 100. No es una cifra para leer. */
  alturaRelativa: number;
}

export interface SaludInstrumentoVista {
  instrumento: SaludInstrument;
  titulo: string;
  score: string;
  banda: string | null;
  bandaTono: SaludTono;
  bandaIdentificador: string | null;
  corte: string;
  version: string;
  variacion: string | null;
  cobertura: string;
  subindices: SaludSubindiceVista[];
  tendencia: SaludTendenciaPuntoVista[];
  motivos: SaludMotivoVista[];
  motivosPorNombrar: SaludIdentificadorVista[];
  respaldo: SaludRespaldoVista | null;
  tope: SaludMotivoVista | null;
}

export interface SaludAusenciaVista {
  instrumento: SaludInstrument;
  titulo: string;
  cobertura: string;
}

export interface SaludVista {
  corte: string;
  moneda: string;
  sello: string;
  instrumentos: SaludInstrumentoVista[];
  ausencias: SaludAusenciaVista[];
}

function puntos(value: number): string {
  return `${formatCount(value)} ${concordar(Math.round(value), "punto", "puntos")}`;
}

function variacionTexto(delta: number | null | undefined): string | null {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return null;
  const redondeado = Math.round(delta);
  if (redondeado === 0) return "Igual que el corte anterior.";
  /* Menos tipográfico U+2212, el mismo que usan los montos y los porcentajes de la casa: un
     hyphen-minus al lado de "−$300.000" son dos signos distintos para la misma idea. */
  const signo = redondeado < 0 ? "−" : "+";
  return `${signo}${puntos(Math.abs(redondeado))} respecto del corte anterior.`;
}

/** Los pesos del contrato son fracciones de 1 (0,25 = 25%). Si un productor los manda ya en
 *  puntos, multiplicar por 100 mostraría "2.500%": se detecta por el propio conjunto en vez
 *  de confiar en una escala supuesta. */
function factorDePeso(pesos: number[]): number {
  return pesos.some((peso) => peso > 1) ? 1 : 100;
}

function subindices(snapshot: SaludScoreSnapshot): SaludSubindiceVista[] {
  const filas = snapshot.subindices ?? [];
  const factor = factorDePeso(filas.map((fila) => fila.weight));
  return filas.map((fila) => ({
    clave: fila.code,
    etiqueta: SUBINDICES[fila.code] ?? "",
    identificador: SUBINDICES[fila.code] ? null : fila.code,
    valor: puntos(fila.value),
    peso: formatPct(fila.weight * factor),
    banda: fila.band ? (BANDAS[snapshot.instrument][fila.band]?.etiqueta ?? null) : null,
  }));
}

function impactoTexto(impacto: number | null | undefined): string | null {
  if (typeof impacto !== "number" || !Number.isFinite(impacto)) return null;
  const redondeado = Math.round(impacto);
  if (redondeado === 0) return null;
  const verbo = redondeado < 0 ? "Resta" : "Suma";
  return `${verbo} ${puntos(Math.abs(redondeado))}.`;
}

function motivos(snapshot: SaludScoreSnapshot): {
  lista: SaludMotivoVista[];
  porNombrar: SaludIdentificadorVista[];
} {
  const lista: SaludMotivoVista[] = [];
  const porNombrar: SaludIdentificadorVista[] = [];

  for (const [indice, driver] of (snapshot.drivers ?? []).entries()) {
    const catalogo = MOTIVOS[driver.reason_code];
    const descripcion = driver.description?.trim();
    const texto = descripcion || catalogo?.texto;
    const clave = `${driver.reason_code}-${indice}`;
    if (!texto) {
      /* Ni el servidor redactó el motivo ni esta pantalla lo nombra. Mostrar el identificador
         como si fuera una frase sería escribirle al usuario en un idioma que no es el suyo, y
         asimilarlo a una categoría sería inventarle una causa. Se cuenta y se identifica. */
      porNombrar.push({ identificador: driver.reason_code, detalle: driver.subindex_code ?? null });
      continue;
    }
    lista.push({
      clave,
      texto,
      tipo: catalogo?.tipo ?? "limite",
      impacto: impactoTexto(driver.impact_points),
      parte: driver.subindex_code ? (SUBINDICES[driver.subindex_code] ?? null) : null,
    });
  }

  return { lista, porNombrar };
}

function esRespaldoDeComponente(item: SaludQualityItem): boolean {
  return item.code.startsWith("DATA_CONFIDENCE:");
}

function respaldo(snapshot: SaludScoreSnapshot): SaludRespaldoVista | null {
  const confianza = snapshot.data_confidence;
  if (typeof confianza !== "number" || !Number.isFinite(confianza)) return null;

  const filas = snapshot.quality ?? [];
  const componentes: { etiqueta: string; valor: string }[] = [];
  const porNombrar: SaludIdentificadorVista[] = [];
  let ponderado = 0;
  let acreditado = 0;

  for (const item of filas.filter(esRespaldoDeComponente)) {
    const codigo = item.code.slice("DATA_CONFIDENCE:".length);
    const peso = typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : 0;
    const entra = item.value >= 1;
    ponderado += peso;
    if (entra) acreditado += peso;
    const etiqueta = RESPALDOS[codigo];
    if (!etiqueta) {
      porNombrar.push({ identificador: codigo, detalle: puntos(peso) });
      continue;
    }
    componentes.push({ etiqueta, valor: `${puntos(entra ? peso : 0)} de ${formatCount(peso)}` });
  }

  const verificaciones = filas.flatMap((item) => {
    const etiqueta = EVIDENCIAS[item.code];
    return etiqueta ? [{ etiqueta, acreditada: item.value >= 1 }] : [];
  });

  const resumen =
    ponderado > 0
      ? `${puntos(acreditado)} acreditados de ${formatCount(ponderado)} que ponderan esta lectura.`
      : `${puntos(confianza)} de 100 en la escala de la política vigente.`;

  return {
    valor: `${formatCount(confianza)} de 100`,
    resumen,
    componentes,
    verificaciones,
    porNombrar,
  };
}

function cobertura(snapshot: SaludScoreSnapshot): string {
  const titulo = SALUD_TITULO[snapshot.instrument];
  const total = SALUD_COMPOSICION[snapshot.instrument];
  const partes = (snapshot.subindices ?? []).length;
  const evidencias = (snapshot.quality ?? []).filter((item) => EVIDENCIAS[item.code]);
  const acreditadas = evidencias.filter((item) => item.value >= 1).length;
  const motivosCount = (snapshot.drivers ?? []).length;

  const frases = [
    `Esta lectura cubre ${formatCount(partes)} de ${concordar(total, "la", "las")} ${formatCount(total)} ${concordar(total, "parte", "partes")} que componen el ${titulo}`,
  ];
  if (evidencias.length > 0) {
    frases.push(
      `con ${formatCount(acreditadas)} de ${formatCount(evidencias.length)} ${concordar(evidencias.length, "verificación acreditada", "verificaciones acreditadas")}`,
    );
  }
  if (motivosCount > 0) {
    frases.push(
      `y ${formatCount(motivosCount)} ${concordar(motivosCount, "motivo que la explica", "motivos que la explican")}`,
    );
  }
  return `${frases.join(", ").replace(", y ", " y ")}.`;
}

function instrumento(snapshot: SaludScoreSnapshot): SaludInstrumentoVista {
  const banda = BANDAS[snapshot.instrument][snapshot.band];
  const { lista, porNombrar } = motivos(snapshot);
  const serie = snapshot.trend ?? [];
  const maximo = serie.reduce((alto, punto) => Math.max(alto, punto.score), 0);
  const tope = snapshot.knockout_code
    ? (lista.find((motivo) => motivo.clave.startsWith(`${snapshot.knockout_code}-`)) ?? null)
    : null;

  return {
    instrumento: snapshot.instrument,
    titulo: SALUD_TITULO[snapshot.instrument],
    score: `${formatCount(snapshot.score)} de 100`,
    banda: banda?.etiqueta ?? null,
    /* Sin banda nombrada no se pinta: un color es una clasificación, y la clasificación por
       defecto es justo lo que esta pantalla no hace. */
    bandaTono: banda?.tono ?? "warn",
    bandaIdentificador: banda ? null : snapshot.band,
    corte: formatDateLong(snapshot.score_date),
    version: snapshot.model_version,
    variacion: variacionTexto(snapshot.trend_delta),
    cobertura: cobertura(snapshot),
    subindices: subindices(snapshot),
    tendencia: serie.map((punto) => ({
      clave: punto.score_date,
      fecha: formatDateLong(punto.score_date),
      valor: `${formatCount(punto.score)} de 100`,
      alturaRelativa: maximo > 0 ? Math.round((punto.score / maximo) * 100) : 0,
    })),
    motivos: lista,
    motivosPorNombrar: porNombrar,
    respaldo: respaldo(snapshot),
    tope,
  };
}

/** Qué se dice de un instrumento que el contrato no trae: cuánto cubre la lectura, con
 *  número, y qué sí entró. Nunca un cero, nunca un color, nunca un puntaje fabricado. */
function ausencia(
  faltante: SaludInstrument,
  presente: SaludScoreSnapshot | null,
  corte: string,
): SaludAusenciaVista {
  const titulo = SALUD_TITULO[faltante];
  const total = SALUD_COMPOSICION[faltante];
  const base = `El ${titulo} se compone con ${formatCount(total)} partes y esta lectura, al corte del ${corte}, trae ${formatCount(0)} de ellas.`;
  const apoyo = presente
    ? ` El ${SALUD_TITULO[presente.instrument]} del ${formatDateLong(presente.score_date)} sí entra, con ${formatCount(presente.score)} de 100 sobre ${formatCount((presente.subindices ?? []).length)} de sus ${formatCount(SALUD_COMPOSICION[presente.instrument])} partes.`
    : ` El ${SALUD_TITULO[faltante === "qhs" ? "pulso" : "qhs"]} tampoco entra en este corte: la lectura cubre ${formatCount(0)} de los ${formatCount(SALUD_COMPOSICION.pulso + SALUD_COMPOSICION.qhs)} componentes de los dos instrumentos.`;
  return { instrumento: faltante, titulo, cobertura: `${base}${apoyo}` };
}

export function saludContratoModel(respuesta: SaludResponse): SaludVista {
  const orden: SaludInstrument[] = ["pulso", "qhs"];
  const snapshots: Record<SaludInstrument, SaludScoreSnapshot | null> = {
    pulso: respuesta.pulso,
    qhs: respuesta.qhs,
  };
  const corte = formatDateLong(respuesta.scope.as_of);

  return {
    corte,
    moneda: respuesta.scope.currency,
    sello: formatDateLong(respuesta.generated_at),
    instrumentos: orden
      .map((clave) => snapshots[clave])
      .filter((snapshot): snapshot is SaludScoreSnapshot => snapshot !== null)
      .map(instrumento),
    ausencias: orden
      .filter((clave) => snapshots[clave] === null)
      .map((clave) => ausencia(clave, snapshots[clave === "qhs" ? "pulso" : "qhs"] ?? null, corte)),
  };
}
