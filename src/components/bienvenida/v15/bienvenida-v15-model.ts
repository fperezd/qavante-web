/* V15 · Bienvenida — modelo PURO de `/bienvenida` (ESPECIFICACION §V15, issue #76).
 *
 * Contesta UNA pregunta (Ley 10): "¿cómo va la construcción de mi primer parte, y cuándo llega?"
 * — en tres pasos, en una sola vista:
 *
 *   1. Fuentes con estado y tiempo estimado por conexión. Orquesta datos que YA existen
 *      (`useOnboardingSources`, el mismo adaptador que el hub `/conexiones` y el guard del
 *      onboarding — Ley 1, una sola fuente de verdad para "¿está conectada?").
 *   2. Progreso de construcción del modelo — EL HUECO DECLARADO de este PR. No existe ningún
 *      evento de progreso consultable (el issue lo marca 🔧: "exponer lo que el sync ya sabe").
 *      Sin eventos, nada de números inventados: se listan los VERBOS de lo que el motor hace (qué
 *      falta) y cuánto SUELE tardar (declarado, no medido) — nunca un contador ni una barra que
 *      simule avance real. Ver `ETAPAS_MODELO_V15` / `DURACION_TIPICA_MODELO`.
 *   3. Promesa final CON HORA: mañana a las 7:00, hora de Santiago.
 *
 * Sin React, como el resto de `*-model.ts` del rediseño (`gestion-v08-model.ts`,
 * `remuneraciones-v16-model.ts`): cada afirmación de esta pantalla se fija en un test sin montar
 * DOM.
 *
 * MULTIEMPRESA: este modelo no asume una sola empresa por usuario — no recibe ni deriva ningún
 * "la única empresa del usuario"; todo lo que consume (`OnboardingSourceStates`) ya viene
 * scopeado a la empresa ACTIVA de la sesión (la resuelve el backend por la cookie), igual que el
 * resto de las pantallas de `(app)`. Un email con N empresas ve esta pantalla una vez por cada
 * empresa a la que entra, con SU propio estado — nada acá lo colapsa a una. */

import { ONBOARDING_SOURCE_IDS } from "@/lib/api/onboarding-sources";
import type {
  OnboardingSourceId,
  OnboardingSourceState,
  OnboardingSourceStates,
} from "@/lib/api/onboarding-sources";
import {
  ONBOARDING_SOURCE_META,
  sourceActionLabel,
  sourceStateDescription,
} from "@/components/onboarding/onboarding-source-meta";
import { routeForSource } from "@/components/onboarding/onboarding-steps";

/** Concordancia número (singular/plural) del español, en un solo lugar — mismo criterio que
 *  `gestion-v08-view.tsx` / `administracion-v12-model.ts`: sólo `n === 1` toma la forma singular
 *  ("0 fuentes" es correcto, no "0 fuente"). */
export function concordar<T>(n: number, singular: T, plural: T): T {
  return n === 1 ? singular : plural;
}

/* ── Paso 1 — fuentes con estado y tiempo estimado por conexión ─────────────────────────────── */

/** Tiempo TÍPICO de conectar cada fuente — declarado, no medido por tenant. Mismo patrón que
 *  `ETA_ACTUALIZANDO` de `banco-v03-model.ts`: no existe ningún endpoint que mida cuánto tarda UN
 *  usuario en concreto en pasar por el login del SII o autorizar el banco (eso depende de si tiene
 *  la clave a mano, si usa doble factor, etc.), así que el número es fijo y honesto sobre lo que
 *  es — un típico declarado, no una medición de esta sesión. */
export const TIEMPO_CONEXION: Record<OnboardingSourceId, string> = {
  sii: "~2 minutos",
  bank: "~3 minutos",
};

export interface FuenteV15 {
  id: OnboardingSourceId;
  label: string;
  estado: OnboardingSourceState;
  /** Reusa `sourceStateDescription` (Ley 1): la MISMA frase que ya usa el hub `/conexiones` para
   *  esta fuente, no una redacción nueva que pueda divergir. */
  descripcion: string;
  /** Sólo tiene sentido mientras la fuente NO está conectada — una vez conectada, cuánto tardó en
   *  conectarse ya no importa. */
  tiempoConexion: string | null;
  /** Reusa `sourceActionLabel` (Ley 1): "Conectar ahora" / "Revisar conexión". */
  accion: string;
  href: string;
}

/** Las fuentes del wizard, en los términos de esta vista. Puro sobre `OnboardingSourceStates`
 *  (el mismo shape que ya usa `/conexiones`): ni pide datos ni decide qué está conectado, sólo
 *  traduce el estado ya resuelto a lo que esta pantalla necesita mostrar. */
export function fuentesV15(states: OnboardingSourceStates): FuenteV15[] {
  return ONBOARDING_SOURCE_IDS.map((id) => {
    const estado = states[id];
    return {
      id,
      label: ONBOARDING_SOURCE_META[id].label,
      estado,
      descripcion: sourceStateDescription(id, estado),
      tiempoConexion: estado === "connected" ? null : TIEMPO_CONEXION[id],
      accion: sourceActionLabel(estado),
      href: routeForSource(id),
    };
  });
}

export function fuentesConectadas(fuentes: ReadonlyArray<FuenteV15>): FuenteV15[] {
  return fuentes.filter((f) => f.estado === "connected");
}

export function fuentesPendientes(fuentes: ReadonlyArray<FuenteV15>): FuenteV15[] {
  return fuentes.filter((f) => f.estado !== "connected");
}

/* ── Paso 2 — progreso de construcción del modelo (EL HUECO) ────────────────────────────────── */

export interface EtapaModeloV15 {
  id: string;
  /** Verbo CONCRETO de lo que el motor hace, en el orden en que ocurre (spec: "leímos 412
   *  facturas" es el EJEMPLO de la spec de un verbo concreto con conteo real; sin eventos que lo
   *  respalden, esta vista se queda en el verbo y declara que el conteo no está disponible). */
  verbo: string;
}

/** Lo que compone "tu primer parte", en el orden en que el motor lo hace. Descriptivo (QUÉ va a
 *  pasar), no un contador en vivo: no existe ningún evento de progreso consultable — inventar
 *  "38 de 412 leídas" sería exactamente el número plausible que la spec prohíbe (§V15: "sin
 *  eventos, nada de números inventados"). */
export const ETAPAS_MODELO_V15: readonly EtapaModeloV15[] = [
  { id: "leer", verbo: "Leemos tus facturas, boletas y movimientos bancarios" },
  { id: "clasificar", verbo: "Los clasificamos por cuenta" },
  { id: "conciliar", verbo: "Cruzamos el banco con tus documentos" },
  { id: "armar", verbo: "Armamos tu primer parte" },
];

/** Cuánto SUELE tardar el proceso completo, de punta a punta — declarado, no medido (mismo
 *  criterio que `TIEMPO_CONEXION`). No hay eventos que digan "vamos en la etapa 2 de 4": en vez de
 *  simular un contador, se dice el rango típico y se cierra con la hora concreta del paso 3. */
export const DURACION_TIPICA_MODELO = "normalmente toma unas horas; listo de un día para otro";

/** El issue que va a exponer los eventos de progreso reales — para que el hueco declarado en
 *  pantalla no sea un "algún día" sin dueño. Se pasa desde afuera (la vista/el PR lo fija) para no
 *  hardcodear un número de issue dentro del modelo antes de que exista. */
export interface ProgresoModeloV15 {
  /** Cuántas fuentes ya están conectadas — con 0, no hay nada que el motor pueda leer todavía. */
  fuentesActivas: number;
  hayAlgoQueConstruir: boolean;
  etapas: readonly EtapaModeloV15[];
  duracionTipica: string;
}

export function progresoModeloV15(fuentes: ReadonlyArray<FuenteV15>): ProgresoModeloV15 {
  const activas = fuentesConectadas(fuentes).length;
  return {
    fuentesActivas: activas,
    hayAlgoQueConstruir: activas > 0,
    etapas: ETAPAS_MODELO_V15,
    duracionTipica: DURACION_TIPICA_MODELO,
  };
}

/* ── Paso 3 — promesa final CON HORA ─────────────────────────────────────────────────────────── */

/** Hora fija de la promesa (spec §V15, literal: "mañana a las 7:00"). */
export const HORA_PRIMER_PARTE = "7:00";

/** Fecha civil (Y/M/D) de `hoy` en America/Santiago — el Worker corre en UTC; mismo patrón que
 *  `diaDelMesSantiago` de `gestion-v08-model.ts`: sin esto, "mañana" se calcularía contra el día
 *  civil del SERVIDOR, que cerca de medianoche puede ser un día distinto al de Santiago. */
function civilSantiago(hoy: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(hoy);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { y: get("year"), m: get("month"), d: get("day") };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export interface PromesaV15 {
  /** "YYYY-MM-DD" del día siguiente en Santiago. STRING, no `Date`: los formatters de fecha del
   *  repo (`formatDateLong`/`formatDateShort`) leen la parte de fecha de un string ISO SIN cruzar
   *  por huso horario; pasarles un `Date` reintroduciría el bug de "un día menos" que esos mismos
   *  formatters documentan (`new Date("2026-08-23")` es medianoche UTC = 22 ago en Chile). */
  fecha: string;
  hora: string;
  /** "mañana a las 7:00" — el literal de la spec. */
  frase: string;
}

/** La promesa del paso 3: el día siguiente (calendario de Santiago) a las 7:00. Aritmética de
 *  CALENDARIO pura: se extrae Y/M/D de Santiago con `civilSantiago`, se suma un día con
 *  `Date.UTC` y se vuelve a leer con los getters UTC — nunca los locales, que es exactamente donde
 *  el huso del runtime se cuela (mismo cuidado que `civil()` de `formatters/date.ts`). */
export function promesaPrimerParte(hoy: Date): PromesaV15 {
  const { y, m, d } = civilSantiago(hoy);
  const manana = new Date(Date.UTC(y, m - 1, d + 1));
  const fecha = `${manana.getUTCFullYear()}-${pad2(manana.getUTCMonth() + 1)}-${pad2(manana.getUTCDate())}`;
  return { fecha, hora: HORA_PRIMER_PARTE, frase: `mañana a las ${HORA_PRIMER_PARTE}` };
}
