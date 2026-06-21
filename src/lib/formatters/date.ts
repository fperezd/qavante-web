export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-CL").format(date);
}

/* Convención de fechas de la app: NUNCA año-mes; mes-año para meses (MM-AAAA) y
   DD-MM-AAAA para días. Reordena strings de fecha del backend SIN parsear a Date
   (evita corrimientos de timezone). Defensivo e idempotente — lo que no reconoce
   lo deja tal cual (sirve para valores ya en DD-MM-AAAA, "—", null):
     "2026-05-13"            → "13-05-2026"
     "2026-05-13T12:00:00Z"  → "13-05-2026"   (toma la parte de fecha)
     "2026-05"               → "05-2026"
     "13-05-2026" / "—"      → sin cambios
     null / undefined / ""   → "—"                                              */
export function formatDateLike(raw: string | null | undefined): string {
  if (!raw) return "—";
  // ISO date o datetime (YYYY-MM-DD...) → DD-MM-AAAA
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (day) return `${day[3]}-${day[2]}-${day[1]}`;
  // Año-mes (YYYY-MM) → MM-AAAA
  const month = /^(\d{4})-(\d{2})$/.exec(raw);
  if (month) return `${month[2]}-${month[1]}`;
  return raw;
}
