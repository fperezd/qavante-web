import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { AdministracionV12View } from "./administracion-v12-view";
import { FILAS_HUB_EJEMPLO } from "./administracion-v12-fixtures";

/* V12 · Administración — el hub como tabla de 8 entradas con estado por fila (ESPECIFICACION
 * §V12). Corren en Chromium headless como gate (`npm run test:storybook`).
 *
 * Lo que se fija acá: la fila Credenciales pinta "N requiere(n) tu acción → Renovar" con la MISMA
 * concordancia que V11 (Ley 1), las filas sin estado calculado (hueco declarado, ver el modelo)
 * NO pintan una pill vacía, y cada fila enlaza a su propia ruta. La lógica pura vive en
 * `administracion-v12-model.test.ts` y el HTML estático en `administracion-v12-view.test.tsx`. */

/* Ley 7 — detector compartido por las tres mediciones de abajo (vuelta 3, hallazgo de revisión
 * PR #95): `test-storybook` estaba ROJO en CI (Linux, fuentes más anchas que Windows) en la
 * story `Ley7Angosto360` de la vuelta anterior — 37 px de desborde — y a 320 px desbordaba 21 px
 * incluso en Windows. La medición local en verde nunca fue evidencia sobre el runner que decide
 * el merge; por eso ahora:
 *
 *   (1) Reflow REAL de ventana (`page.viewport`, patrón de `gestion-v08-view.stories.tsx`) en vez
 *       del decorator de ancho fijo que usaba esta story antes — el decorator no cambiaba
 *       `document.documentElement`, así que nada obligaba a que las fuentes reflowearan como en
 *       una pantalla angosta real.
 *   (2) Control anti-medición-hueca: se verifica que el viewport quedó REALMENTE en el ancho
 *       pedido antes de confiar en cualquier medición (mismo criterio que `gestion-v08`).
 *   (3) `scroller = tabla.parentElement` (el `overflow-y-auto` que scrollea de verdad), no el
 *       `overflow-hidden` de más afuera — ese informa desborde 0 SIEMPRE, es el mismo criterio de
 *       `cobrar-v04-view.stories.tsx`.
 *   (4) Control POSITIVO del propio detector, medido en cada corrida (no un comentario
 *       histórico): se inyecta una sonda de 9999 px dentro del scroller, se confirma que la
 *       fórmula la marca como desborde, y se limpia ANTES de la medición real — así un detector
 *       roto (por ejemplo, por medir el nodo equivocado) no puede dar un falso verde por
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

    /* Dato primario: NINGÚN título de las 8 filas lleva `truncate` ni queda recortado — el
       accesorio que colapsa en este ancho es la columna Estado (`hideBelowTable`, ver el
       comentario en `administracion-v12-view.tsx`), nunca el título. */
    const canvas = within(canvasElement);
    for (const fila of FILAS_HUB_EJEMPLO) {
      const titulo = canvas.getByText(fila.titulo);
      expect(titulo.className).not.toContain("truncate");
      expect(titulo.scrollWidth).toBeLessThanOrEqual(titulo.clientWidth);
    }
  } finally {
    await page.viewport(1280, 800);
  }
}

const meta = {
  title: "Rediseño F2 / V12 Administración",
  component: AdministracionV12View,
  parameters: { layout: "padded" },
  args: {
    filas: FILAS_HUB_EJEMPLO,
  },
} satisfies Meta<typeof AdministracionV12View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal — 8 módulos, Credenciales con 1 fuente que requiere acción",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Empresas")).toBeInTheDocument();
    await expect(canvas.getByText("2 empresas")).toBeInTheDocument();
    await expect(canvas.getByText("4 usuarios")).toBeInTheDocument();
    await expect(canvas.getByText("1 requiere tu acción → Renovar")).toBeInTheDocument();
    // Concordancia: NO aparece la forma plural cuando N=1.
    await expect(canvas.queryByText(/requieren tu acción/)).not.toBeInTheDocument();
    // Filas sin estado calculado (hueco declarado): título presente, sin una pill fantasma al lado.
    await expect(canvas.getByText("Monedas")).toBeInTheDocument();
    await expect(canvas.getByText("Plantillas por rubro")).toBeInTheDocument();
    // Los 8 links "Ver" a cada módulo.
    const links = canvas.getAllByRole("link", { name: "Ver" });
    await expect(links).toHaveLength(8);
    await expect(canvas.getByText("8 módulos")).toBeInTheDocument();
  },
};

export const TodoAlDia: Story = {
  name: "Todo al día — Credenciales en verde, sin ninguna fuente que requiera acción",
  args: {
    filas: FILAS_HUB_EJEMPLO.map((f) =>
      f.id === "credenciales" ? { ...f, estado: { tono: "ok" as const, texto: "Al día" } } : f,
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Al día")).toBeInTheDocument();
    await expect(canvas.queryByText(/requiere/)).not.toBeInTheDocument();
  },
};

export const NueveConMcp: Story = {
  name: "Con MCP habilitado — 9ª fila al final",
  args: {
    filas: [
      ...FILAS_HUB_EJEMPLO,
      {
        id: "mcp",
        titulo: "Conectar un asistente (MCP)",
        descripcion:
          "Deja que ChatGPT o Claude lean tus datos de Qavante para responderte, con una API-key que controlas.",
        href: "/administracion/mcp",
        estado: null,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Conectar un asistente (MCP)")).toBeInTheDocument();
    await expect(canvas.getByText("9 módulos")).toBeInTheDocument();
    const filas = canvasElement.querySelectorAll("tbody tr");
    await expect(filas[filas.length - 1]!).toHaveTextContent("Conectar un asistente (MCP)");
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

/** Ley 7 / margen adoptado (vuelta 3): 346 px = 360 con la misma holgura de fuente que
 *  `gestion-v08-view.tsx` documenta y mide — 14 px, no un número de gusto. `gestion/v08` es el
 *  precedente que descubrió la brecha (Linux mide más ancho que Windows) y la resolvió así; V12
 *  adopta el MISMO margen por la MISMA razón, en vez de reinventar un número propio. Ésta es la
 *  medición que decide el gate: si pasa acá, pasa a 360 en cualquier máquina. */
export const Ley7Angosto346: Story = {
  name: "Ley 7 · 346 px — margen de fuente (= 360, holgura Linux/Windows de gestion-v08)",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 346);
  },
};

/** Ancho que la vuelta anterior NO midió: a 320 px (el más angosto habitual de un teléfono) la
 *  misma tabla desbordaba 21 px incluso en Windows, sin necesitar las fuentes de Linux para
 *  romperse. Con la columna Estado colapsada (`hideBelowTable`) entra con margen real. */
export const Ley7Angosto320: Story = {
  name: "Ley 7 · 320 px — ancho de teléfono, sin scroll horizontal",
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 320);
  },
};
