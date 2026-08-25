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

/** Fecha CIVIL (año/mes/día) de una entrada, sin cruzar por `Date` cuando ya es
 *  un string ISO. Un `new Date("2026-08-23")` se interpreta como medianoche UTC y
 *  en Chile (UTC−3/−4) se muestra "22 ago": un día menos en cada vencimiento.
 *  `null` si no se reconoce. */
function civil(raw: string | Date | null | undefined): { y: number; m: number; d: number } | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return { y: raw.getFullYear(), m: raw.getMonth() + 1, d: raw.getDate() };
  }
  // "2026-08-23" y "2026-08-23T12:00:00Z" → se lee la parte de fecha, literal.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  // "23-08-2026" (la convención vigente de la app) también se acepta.
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
  const hoy = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
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
