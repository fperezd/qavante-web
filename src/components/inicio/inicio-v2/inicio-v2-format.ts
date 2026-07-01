/* Helpers PUROS del Inicio Ejecutivo v2 (cobertura de obligaciones, deltas,
 * geometría del sparkline). Testeable sin UI. */

export type Tone = "success" | "warning" | "danger" | "neutral";
export type Coverage = "covered" | "tight" | "uncovered";

export function coverageInfo(c: Coverage): { tone: Tone; label: string } {
  switch (c) {
    case "covered":
      return { tone: "success", label: "Cubierta" };
    case "tight":
      return { tone: "warning", label: "Ajustada" };
    case "uncovered":
      return { tone: "danger", label: "Sin cubrir" };
  }
}

/** Runway (días de caja): <14 crítico, <30 ajustado, ≥30 sano. */
export function runwayTone(days: number | null | undefined): Tone {
  if (days == null) return "neutral";
  if (days < 14) return "danger";
  if (days < 30) return "warning";
  return "success";
}

/** Delta % con signo y dirección; `higherIsBetter` define el color. */
export function deltaInfo(
  pct: number | null | undefined,
  higherIsBetter = true,
): { tone: Tone; text: string; up: boolean } | null {
  if (pct == null) return null;
  const up = pct > 0;
  const good = higherIsBetter ? up : !up;
  const tone: Tone = pct === 0 ? "neutral" : good ? "success" : "danger";
  return { tone, up, text: `${pct > 0 ? "+" : ""}${pct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%` };
}

/** Puntos [x,y] normalizados a un viewBox WxH para un sparkline. */
export function sparklinePoints(values: number[], w: number, h: number, pad = 2): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length;
  return values
    .map((v, i) => {
      const x = n <= 1 ? w / 2 : (i / (n - 1)) * w;
      const y = h - pad - ((v - min) / span) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
