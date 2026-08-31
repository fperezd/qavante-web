import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { ImpuestosV06View } from "./impuestos-v06-view";
import { filasCalendarioV06 } from "./impuestos-v06-model";
import {
  HOY_V06,
  PREVIRED_TOTALES_V06,
  mesesF29SinVencidosV06,
  mesesF29V06,
  tgrMovimientosV06,
} from "./impuestos-v06-fixtures";

/* V06 · Impuestos — "¿qué impuestos vencen, y cuáles ya declaraste?" en sus estados
 * (ESPECIFICACION §V06, issue #73). Corren en Chromium headless como gate (`npm run test:storybook`).
 *
 * Lo que se fija acá: Ley 2 se CUENTA (máximo un elemento con token rojo, en TODOS los estados) y
 * — la parte que decide el pase — Ley 7 medida a 360, 346 y 320 px con reflow REAL de ventana y el
 * detector correcto de la tabla (`tabla.parentElement`, no el wrapper). La lógica pura vive en
 * `impuestos-v06-model.test.ts` y el HTML estático (huecos declarados, concordancia N=1, "no sé"
 * explícito) en `impuestos-v06-view.test.tsx`. */

function filasNormales() {
  return filasCalendarioV06({
    mesesF29: mesesF29V06(),
    previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
    tgrAutenticado: true,
    tgrMovimientos: tgrMovimientosV06(),
    hoy: HOY_V06,
  });
}

/** Ley 2 — los elementos con token rojo que hay en pantalla. */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"]'));
}

/* Ley 7 — detector compartido (mismo patrón que `presupuesto-v09-view.stories.tsx` /
 * `gestion-v08-view.stories.tsx` / `administracion-v12-view.stories.tsx`): reflow REAL de
 * ventana, `scroller = tabla.parentElement` (el `div.overflow-y-auto` que scrollea de verdad, NO
 * el wrapper `overflow-hidden` de más afuera), y control POSITIVO del detector con una sonda de
 * 9999 px inyectada y removida ANTES de la medición real. */
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

    /* Dato primario (Ley 7): el concepto de cada fila no trunca, y el monto entra completo dentro
       del contenedor — nunca colapsa (a diferencia del pill de estado, que sí puede). */
    const canvas = within(canvasElement);
    const borde = canvasElement.getBoundingClientRect().right;
    for (const label of ["F-29 · Marzo 2026", "Previred · Agosto 2026"]) {
      const nodo = canvas.getByText(label);
      expect(nodo.className).not.toContain("truncate");
      expect(nodo.scrollWidth).toBeLessThanOrEqual(nodo.clientWidth + 1);
    }
    for (const monto of ["$850.000", "$612.000"]) {
      const celda = canvas.getByText(monto);
      expect(celda.getBoundingClientRect().right).toBeLessThanOrEqual(borde + 1);
    }
  } finally {
    await page.viewport(1280, 800);
  }
}

const meta = {
  title: "Rediseño F2 / V06 Impuestos",
  component: ImpuestosV06View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "V06 · Impuestos (ESPECIFICACION §V06, issue #73): tríada (Próximo vencimiento / F-29 del mes en curso / Deudas TGR) + calendario tributario sobre `/api/sii/f29/estado`, `/api/tgr/*` y `/api/buk/payroll` — las MISMAS fuentes que ya publican Pagar → Impuestos → F29/TGR, Pagar → Previred y V16 (Ley 1). Alcance recortado a propósito: la estimación del F-29 del mes en curso es R2 `[money]` (pendiente de contrastarse contra un F-29 real) y la conciliación bancaria de un F-29 declarado no existe en el contrato — ambos huecos declarados EN pantalla. Flag `impuestosV06`, apagado por defecto.",
      },
    },
  },
  args: {
    hoy: HOY_V06,
    filas: filasNormales(),
    issueSucesor: "#105",
  },
} satisfies Meta<typeof ImpuestosV06View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal — tríada + calendario, un solo rojo (F-29 vencido)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Próximo vencimiento")).toBeInTheDocument();
    await expect(canvas.getByText("F-29 · mes en curso (estimado)")).toBeInTheDocument();
    await expect(canvas.getByText("$525.000")).toBeInTheDocument(); // Deudas TGR
    await expect(rojos(canvasElement)).toHaveLength(1); // el F-29 de julio, no declarado y vencido
    // Huecos declarados, visibles en pantalla.
    const texto = (canvasElement.textContent ?? "").replace(/\s+/g, " ");
    expect(texto).toContain("issue sucesor #105");
    expect(texto).toContain("Las obligaciones tributarias nunca se postergan desde Qavante.");
  },
};

export const SinVencidos: Story = {
  name: "Sin ningún F-29 vencido — cero rojo (Ley 2, existe pantalla sin rojo)",
  args: {
    filas: filasCalendarioV06({
      mesesF29: mesesF29SinVencidosV06(),
      previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
      tgrAutenticado: true,
      tgrMovimientos: tgrMovimientosV06(),
      hoy: HOY_V06,
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const TgrSinAutenticar: Story = {
  name: "TGR en preparación — 'sin dato' honesto, no un cero ni una fila omitida",
  args: {
    filas: filasCalendarioV06({
      mesesF29: mesesF29V06(),
      previred: { period: "2026-08", ...PREVIRED_TOTALES_V06 },
      tgrAutenticado: false,
      tgrMovimientos: undefined,
      hoy: HOY_V06,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/en preparación/i)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(1); // el F-29 de julio sigue vencido
  },
};

export const Cargando: Story = {
  name: "Carga — dice qué trae y da ETA, nunca 'Cargando…' mudo",
  args: { filas: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/trayendo/i)).toBeInTheDocument();
    await expect(canvas.getByText(/~3 s/)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const ErrorDeConexion: Story = {
  name: "Error — el SII no respondió, con Reintentar",
  args: { filas: undefined, error: "El SII no respondió. Vuelve a intentar en un momento." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("El SII no respondió. Vuelve a intentar en un momento.", { exact: false }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Revisar conexiones" })).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

/* ────────────────────────── Ley 7 · tres mediciones ────────────────────────── */

export const Ley7Angosto360: Story = {
  name: "Ley 7 · 360 px — el calendario entra completo, sin scroll horizontal",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 360);
  },
};

export const Ley7Angosto346: Story = {
  name: "Ley 7 · 346 px — margen de fuente (= 360, holgura Linux/Windows)",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 346);
  },
};

export const Ley7Angosto320: Story = {
  name: "Ley 7 · 320 px — ancho de teléfono, sin scroll horizontal",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 320);
  },
};
