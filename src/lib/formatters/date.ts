import { MESES_CORTOS } from "./months";

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL").format(date);
}

/* Convención de fechas de la app: NUNCA año-mes; mes-año para meses (MM-AAAA) y
   DD-MM-AAAA para días. Reordena strings de fecha del backend SIN parsear a Date
   (evita corrimientos de timezone). Defensivo e idempotente — lo que no reconoce
   lo deja tal cual (sirve para valores ya en DD-MM-AAAA, "s/d", null):
     "2026-05-13"            → "13-05-2026"
     "2026-05-13T12:00:00Z"  → "13-05-2026"   (toma la parte de fecha)
     "2026-05"               → "05-2026"
     "13-05-2026" / "s/d"      → sin cambios
     null / undefined / ""   → "s/d"                                              */
export function formatDateLike(raw: string | null | undefined): string {
  if (!raw) return "s/d";
  // ISO date o datetime (YYYY-MM-DD...) → DD-MM-AAAA
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (day) return `${day[3]}-${day[2]}-${day[1]}`;
  // Año-mes (YYYY-MM) → MM-AAAA
  const month = /^(\d{4})-(\d{2})$/.exec(raw);
  if (month) return `${month[2]}-${month[1]}`;
  return raw;
}

/* ── Formatos de la especificación de rediseño (§1.4) ─────────────────────────
   `23 ago` / `23 ago 2026` / `hace 73 días`.

   OJO — todavía NO son la convención de la app: la app entera muestra fechas con
   `formatDateLike` (DD-MM-AAAA) y esa migración es visible en cada pantalla, así
   que va en su propio PR con su propia revisión. Estas tres funciones se agregan
   ACÁ (con tests) para que ese PR sea un cambio de llamadores y no una discusión
   de formato, y para que nadie escriba una duodécima variante mientras tanto.
   Ningún llamador las usa aún — es a propósito.                                */

/** La zona de negocio. Espeja `BUSINESS_TIME_ZONE` de `app/core/business_clock.py` en la API:
 *  el día que decide la API y el día que escribe la pantalla tienen que ser el mismo. */
export const BUSINESS_TIME_ZONE = "America/Santiago";

/** El día civil de un INSTANTE en la zona de negocio.
 *
 *  `en-CA` da `YYYY-MM-DD`, que es lo que se quiere parsear de vuelta. Es el mismo recurso que
 *  ya usaban `fechaSaldoSantiago` (inicio) y `dateInSantiago` (proyección) por su cuenta. */
function civilEnSantiago(d: Date): { y: number; m: number; d: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-");
  return { y: Number(partes[0]), m: Number(partes[1]), d: Number(partes[2]) };
}

/** Fecha CIVIL (año/mes/día) de una entrada. `null` si no se reconoce.
 *
 *  Distingue DOS cosas que se parecen y no lo son, y confundirlas es el defecto de fondo:
 *
 *  - Una **fecha de calendario** (`"2026-08-23"`) no tiene zona. Se lee literal. Un
 *    `new Date("2026-08-23")` la interpretaría como medianoche UTC y en Chile mostraría
 *    "22 ago": un día menos en cada vencimiento.
 *  - Un **instante** (`"2026-08-23T12:00:00Z"`, o un `Date`) sí tiene zona, y su día civil es
 *    el que se ve desde Chile. */
function civil(raw: string | Date | null | undefined): { y: number; m: number; d: number } | null {
  if (raw == null || raw === "") return null;
  // Un `Date` es un INSTANTE: su día depende de desde dónde se lo mire, y acá se lo mira desde
  // Chile. `getFullYear()/getMonth()/getDate()` daban el día del NAVEGADOR.
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return civilEnSantiago(raw);
  }
  // ── La distinción que importa, y que el 90% de los bugs de zona horaria confunde ──
  //
  // "2026-08-23" es una FECHA DE CALENDARIO: la fuente la informó SIN hora (`issue_date`,
  // `due_date`, `treasury.bank_movements.date` — todas `DATE` en el schema). No tiene zona, así
  // que no hay nada que convertir: se lee literal, tal como está. Convertirla la corrompería, y
  // ése es exactamente el error que introduce un arreglo apresurado de zona horaria.
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (soloFecha)
    return { y: Number(soloFecha[1]), m: Number(soloFecha[2]), d: Number(soloFecha[3]) };
  // "2026-10-06T00:30:00Z" es un INSTANTE: sí tiene zona, y su día es el de Chile. Leerle la
  // parte de fecha con una regex —lo que hacía esta función— devolvía el día en UTC. Con Chile
  // en UTC-3, un sello de las 21:30 del 05-10 llega como `2026-10-06T00:30Z` y se leía como el
  // 06: `formatRelative` lo comparaba contra el 05 de hoy y publicaba «mañana». De ahí salía
  // «actualizada mañana» en las tarjetas de cuenta después de las 21:00 (B16).
  const instante = /^\d{4}-\d{2}-\d{2}[T ]/.test(raw) ? new Date(raw) : null;
  if (instante && !Number.isNaN(instante.getTime())) return civilEnSantiago(instante);
  // "23-08-2026" (la convención vigente de la app) también se acepta. Fecha de calendario.
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (dmy) return { y: Number(dmy[3]), m: Number(dmy[2]), d: Number(dmy[1]) };
  return null;
}

const MES_INVALIDO = (m: number) => m < 1 || m > 12;

/** Fecha corta de la spec: `23 ago`. Sin año — para listas donde el año es obvio
 *  por el contexto (el mes en curso, los próximos vencimientos). No reconocido →
 *  "s/d". */
export function formatDateShort(raw: string | Date | null | undefined): string {
  const c = civil(raw);
  if (!c || MES_INVALIDO(c.m)) return "s/d";
  return `${c.d} ${MESES_CORTOS[c.m - 1]}`;
}

/** Fecha larga de la spec: `23 ago 2026`. Con año — para todo lo que cruza años
 *  (histórico, documentos, bitácora). No reconocido → "s/d". */
export function formatDateLong(raw: string | Date | null | undefined): string {
  const c = civil(raw);
  if (!c || MES_INVALIDO(c.m)) return "s/d";
  return `${c.d} ${MESES_CORTOS[c.m - 1]} ${c.y}`;
}

/** Relativo de la spec: `hace 73 días`, `en 5 días`, `hoy`, `ayer`, `mañana`.
 *
 *  Se cuenta en DÍAS CIVILES, no en horas: algo de anoche es "ayer" aunque hayan
 *  pasado 9 horas, que es como lo lee una persona. Y se queda en días a propósito
 *  —no escala a "hace 2 meses"— porque en cobranza la distancia exacta ES el
 *  dato: "hace 73 días" decide una acción, "hace ~2 meses" no.
 *
 *  @param now referencia (default: ahora). Explícito para poder testearlo. */
export function formatRelative(
  raw: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const c = civil(raw);
  if (!c || MES_INVALIDO(c.m)) return "s/d";
  const MS_DIA = 86_400_000;
  // UTC a ambos lados: compara días civiles sin que un cambio de horario de
  // verano en el medio corra la cuenta en un día.
  const objetivo = Date.UTC(c.y, c.m - 1, c.d);
  // `now` es un instante; su día también se mira desde Chile. Con `getFullYear()` acá y el día
  // UTC del otro lado se comparaban DOS CALENDARIOS DISTINTOS, que es la mitad del defecto.
  const h = civilEnSantiago(now);
  const hoy = Date.UTC(h.y, h.m - 1, h.d);
  const dias = Math.round((objetivo - hoy) / MS_DIA);
  if (dias === 0) return "hoy";
  if (dias === -1) return "ayer";
  if (dias === 1) return "mañana";
  return dias < 0 ? `hace ${-dias} días` : `en ${dias} días`;
}

/* Timestamp ISO (UTC) → "DD-MM-AAAA HH:MM:SS" en hora local. Para "última
   sincronización". Defensivo: null/inválido → "s/d"; lo que no parsea, tal cual. */
export function formatDateTimeLike(raw: string | null | undefined): string {
  if (!raw) return "s/d";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Hora corta de la spec (§1.3, chip de la tarjeta KPI: `BICE · 08:12 ✓`): `HH:MM` en hora
 *  LOCAL, desde un timestamp ISO o un `Date`. Sólo la hora, a propósito: el chip la usa para
 *  un sello de HOY; cuando el sello es de otro día, el llamador muestra la fecha corta en su
 *  lugar (una hora suelta de anteayer se lee como de hoy). No reconocido → "s/d". */
export function formatHoraCorta(raw: string | Date | null | undefined): string {
  if (raw == null || raw === "") return "s/d";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return "s/d";
  // Hora de CHILE, no del navegador: el chip sella «BICE · 08:12» sobre un timestamp UTC.
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
