import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, fn, waitFor } from "storybook/test";
import { PresupuestoV09View } from "./presupuesto-v09-view";
import {
  PERIODO,
  RESULT_OPERATIONAL_RESULT_DIVERGENTE,
  budgetVsActual,
  budgetVsActualIncompleto,
  budgetVsActualSinDesvios,
  budgetVsActualSinPresupuesto,
} from "./presupuesto-v09-fixtures";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";

/* V09 · Presupuesto — "¿cómo vas contra tu plan?" en sus estados (ESPECIFICACION §V09, issue #74).
 * Corren en Chromium headless como gate (`npm run test:storybook`).
 *
 * Lo que se fija acá: Ley 2 se CUENTA (cero elementos con token rojo, en TODOS los estados — esta
 * pantalla usa verde/ámbar para el desvío, nunca rojo) y — la parte que decide el pase — Ley 7
 * medida a 360, 346 y 320 px con reflow REAL de ventana y el detector correcto de la tabla
 * (`tabla.parentElement`, no el wrapper). La lógica pura vive en `presupuesto-v09-model.test.ts` y
 * el HTML estático (incluida la concordancia N=1) en `presupuesto-v09-view.test.tsx`. */

const PERIODO_LABEL = formatPeriodLabel(PERIODO);

/** Ley 2 — los elementos con token rojo que hay en pantalla (ambos sistemas de tokens del repo). */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

function texto(canvasElement: HTMLElement): string {
  return (canvasElement.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* Ley 7 — detector compartido (mismo patrón que `administracion-v12-view.stories.tsx` /
 * `remuneraciones-v16-view.stories.tsx`, hallazgo de revisión: `test-storybook` corre en Linux —
 * fuentes más anchas que Windows — así que la medición LOCAL nunca es evidencia sobre el runner
 * que de verdad decide el gate. Por eso:
 *
 *   (1) Reflow REAL de ventana (`page.viewport`), no un decorator de ancho fijo — el decorator no
 *       cambia `document.documentElement`, así que nada obliga a que el texto reflowee como en una
 *       pantalla angosta real.
 *   (2) Control anti-medición-hueca: se espera a que el viewport quede REALMENTE en el ancho
 *       pedido antes de confiar en cualquier medición.
 *   (3) `scroller = tabla.parentElement` — el `div.overflow-y-auto` de `table.tsx` que scrollea de
 *       verdad —, NUNCA el wrapper `overflow-hidden` de más afuera (ese informa desborde 0
 *       SIEMPRE: con un eje en `auto` el otro computa `auto` y el hijo se come el desborde).
 *   (4) Control POSITIVO del detector, medido en cada corrida: se inyecta una sonda de 9999 px
 *       DENTRO del mismo scroller, se confirma que la fórmula la marca como desborde, y se limpia
 *       ANTES de la medición real — así un detector roto no puede dar un falso verde por
 *       casualidad. */
async function medirLey7SinDesborde(canvasElement: HTMLElement, ancho: number): Promise<void> {
  const { page } = await import("@vitest/browser/context");
  await page.viewport(ancho, 900);
  try {
    await waitFor(() => expect(document.documentElement.clientWidth).toBe(ancho));

    const tabla = canvasElement.querySelector<HTMLElement>("table")!;
    const scroller = tabla.parentElement!;

    const sonda = document.createElement("div");
    sonda.setAttribute("data-sonda-ley7", "");
    sonda.style.cssText = "width:9999px;height:1px;";
    scroller.appendChild(sonda);
    try {
      await waitFor(() => {
        expect(scroller.scrollWidth - scroller.clientWidth).toBeGreaterThan(0);
      });
    } finally {
      sonda.remove();
    }

    await waitFor(() => {
      expect(scroller.scrollWidth - scroller.clientWidth).toBeLessThanOrEqual(0);
    });

    /* Dato primario (Ley 7): el concepto de CADA fila no trunca, y el monto del desvío entra
       completo dentro del contenedor — nunca colapsa (a diferencia del pill de apoyo, que sí). */
    const canvas = within(canvasElement);
    for (const label of ["Ingresos", "Costo directo", "Gastos operacionales"]) {
      const nodo = canvas.getByText(label);
      expect(nodo.className).not.toContain("truncate");
      expect(nodo.scrollWidth).toBeLessThanOrEqual(nodo.clientWidth + 1);
    }
    const borde = canvasElement.getBoundingClientRect().right;
    for (const monto of ["+$2.500.000", "−$1.400.000", "+$800.000"]) {
      const celda = canvas.getByText(monto);
      expect(celda.getBoundingClientRect().right).toBeLessThanOrEqual(borde + 1);
    }
  } finally {
    await page.viewport(1280, 800);
  }
}

const meta = {
  title: "Rediseño F2 / V09 Presupuesto",
  component: PresupuestoV09View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V09 · Presupuesto (ESPECIFICACION §V09, issue #74): tríada Plan/Real/Desvío + tabla de desvíos por concepto sobre `GET /api/planning/budget-vs-actual` — `variance`/`variance_pct` YA calculados por el backend, nunca recalculados en el front (Ley 1). INV-FIN-001: el "Real" de acá es el MISMO número que el "Resultado" de V08. Alcance recortado a propósito: sin el link a documentos (drill-down, fork del BO) ni el banner de proyección de cierre — huecos declarados EN pantalla, issue sucesor #101. Flag `presupuestoV09`, apagado por defecto.',
      },
    },
  },
  args: {
    periodoLabel: PERIODO_LABEL,
    bva: budgetVsActual(),
    issueSucesor: "#101",
    onReintentar: fn(),
    onProponer: fn(),
  },
} satisfies Meta<typeof PresupuestoV09View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal — tríada + tabla de desvíos, cero rojo",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("$9.000.000")).toBeInTheDocument(); // Plan (result)
    await expect(canvas.getByText("$10.900.000")).toBeInTheDocument(); // Real (result)
    await expect(canvas.getByText(/a favor · 21,1%/)).toBeInTheDocument();
    // Tabla de desvíos: peor primero.
    await expect(canvas.getByText("Costo directo")).toBeInTheDocument();
    await expect(canvas.getByText("Ingresos")).toBeInTheDocument();
    await expect(canvas.getByText("Gastos operacionales")).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
    // Huecos declarados, visibles en pantalla.
    expect(texto(canvasElement)).toContain("issue sucesor #101");
  },
};

export const SinPresupuesto: Story = {
  name: "Sin presupuesto del período — estado vacío honesto, con acción",
  args: { bva: budgetVsActualSinPresupuesto() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Todavía no tienes presupuesto/i)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Proponer presupuesto" })).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const DatoIncompleto: Story = {
  name: "Dato incompleto — declara la fuente faltante, no la esconde",
  args: { bva: budgetVsActualIncompleto() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Dato parcial/i)).toBeInTheDocument();
    expect(texto(canvasElement)).toContain("sii_rcv");
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinDesvios: Story = {
  name: "Sin desvíos — 'clavado al plan', tabla no queda vacía muda",
  args: { bva: budgetVsActualSinDesvios() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/clavado al plan/i)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const ErrorDeConexion: Story = {
  name: "Error — la fuente no respondió, con Reintentar",
  args: { bva: undefined, error: "No pudimos conectar con Planificación (error de red)." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("No pudimos conectar con Planificación (error de red).", { exact: false }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const InvarianteRoto: Story = {
  name: "INV-FIN-001 roto — declara Real y Resultado, ninguno se elige en silencio (Ley 1)",
  args: { resultOperacional: RESULT_OPERATIONAL_RESULT_DIVERGENTE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/no coincide con el/i)).toBeInTheDocument();
    // El Real que la tríada pinta (budget-vs-actual, sin cambiar) Y el Resultado declarado
    // (operational-result) — los DOS números en pantalla, no uno elegido en silencio.
    await expect(canvas.getByText("$10.900.000")).toBeInTheDocument();
    expect(texto(canvasElement)).toContain("$9.000.000");
    await expect(rojos(canvasElement)).toHaveLength(0); // ámbar, no rojo (Ley 2)
  },
};

/* ────────────────────────── Ley 7 · tres mediciones ────────────────────────── */

/** El mínimo que pide la spec (§5.2): sin scroll horizontal de página en ≥ 360 px. */
export const Ley7Angosto360: Story = {
  name: "Ley 7 · 360 px — la tabla entra completa, sin scroll horizontal",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 360);
  },
};

/** Margen de fuente adoptado por el rediseño (`gestion-v08`/`administracion-v12`): 346 px = 360
 *  con la holgura Linux/Windows medida en esas vistas — la que de verdad decide si el gate de CI
 *  (Linux) va a pasar. */
export const Ley7Angosto346: Story = {
  name: "Ley 7 · 346 px — margen de fuente (= 360, holgura Linux/Windows)",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 346);
  },
};

/** Ancho de teléfono más angosto habitual — la columna del pill (`hideBelowTable: "sm"`) colapsa
 *  acá; el concepto y el monto del desvío (dato primario) siguen enteros. */
export const Ley7Angosto320: Story = {
  name: "Ley 7 · 320 px — ancho de teléfono, sin scroll horizontal",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 320);
  },
};
