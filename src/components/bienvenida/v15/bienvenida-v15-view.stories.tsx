import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, waitFor } from "storybook/test";
import { BienvenidaV15View } from "./bienvenida-v15-view";
import { AMBAS_CONECTADAS, NINGUNA_CONECTADA, UNA_DIFERIDA } from "./bienvenida-v15-fixtures";

const RUN_EN_CURSO = {
  run_id: "00000000-0000-0000-0000-000000000001",
  status: "running" as const,
  updated_at: "2026-09-02T12:00:00Z",
  sources: [
    {
      source: "sii" as const,
      status: "running" as const,
      step: "reading",
      records_read: 0,
      eta_seconds: null,
      updated_at: "2026-09-02T12:00:00Z",
    },
    {
      source: "bank" as const,
      status: "queued" as const,
      step: null,
      records_read: null,
      eta_seconds: 60,
      updated_at: "2026-09-02T12:00:00Z",
    },
  ],
};

/** Texto plano de toda la pantalla, para frases que cruzan varios nodos hermanos (ej. "Con
 *  2 fuentes conectadas" — el número va en un `<b>` para énfasis tabular): `getByText` sólo
 *  matchea el texto PROPIO de un elemento, así que una frase partida por un `<b>` necesita el
 *  textContent completo en vez de un query por rol/texto exacto. */
function texto(canvasElement: HTMLElement): string {
  return (canvasElement.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** El run puede repetir los nombres de fuente; Ley 7 y sus stories leen la lista canónica del paso 1. */
function fuentesDelPaso1(canvasElement: HTMLElement) {
  const paso1 = canvasElement.querySelector<HTMLElement>(
    'section[aria-labelledby="paso-1-titulo"]',
  );
  if (!paso1) throw new Error("No se encontró la sección de fuentes del paso 1");
  return within(paso1);
}

/* V15 · Bienvenida — `/bienvenida` en sus estados (ESPECIFICACION §V15, issue #76). Corren en
 * Chromium headless como gate (`npm run test:storybook`).
 *
 * Lo que se fija acá: los hechos observables del run (incluidos cero y null), la ausencia de
 * promesa horaria y — la parte que decide el pase — Ley 7 medida a 360 px Y a 320 px con reflow
 * REAL de ventana, no un decorator de ancho fijo. La lógica pura vive en
 * `bienvenida-v15-model.test.ts` y el HTML estático en `bienvenida-v15-view.test.tsx`. */

/* ── Ley 7 — detector compartido, mismo patrón que `administracion-v12-view.stories.tsx` ───────
 *
 * Por qué a 320 Y a 360, y por qué con reflow real: dos PRs seguidos de este mismo rediseño
 * afirmaron "verde" habiendo medido sólo a 360 px y sólo en Windows — las fuentes de Linux (el
 * runner que de verdad decide el merge) miden más ancho, y 320 px (el ancho de teléfono más
 * angosto habitual) puede desbordar por su cuenta sin necesitar la brecha de fuente. Por eso:
 *
 *   (1) `page.viewport(ancho, 900)` — reflow REAL de la ventana, no un `<div style={{width}}>`: un
 *       decorator de ancho fijo no cambia `document.documentElement`, así que nada obliga a que el
 *       texto reflowee como en una pantalla angosta de verdad.
 *   (2) Control: se espera a que `document.documentElement.clientWidth` YA sea el ancho pedido
 *       antes de medir nada — sin esto se podría medir el layout viejo por una carrera.
 *   (3) Esta vista NO tiene tabla: no hay ningún `overflow-hidden` de por medio que pueda tragarse
 *       un desborde real en silencio (el bug que `gestion-v08`/`administracion-v12` documentan
 *       para sus tablas), así que el nodo que importa es la RAÍZ del documento — es ella la que
 *       scrollea si algo se pasa de ancho.
 *   (4) Control POSITIVO del detector, medido en cada corrida: se inyecta una sonda de 9999 px
 *       dentro del propio `canvasElement`, se confirma que la fórmula la marca como desborde, y se
 *       limpia ANTES de la medición real — un detector roto no puede dar un falso verde. */
async function medirLey7SinDesborde(canvasElement: HTMLElement, ancho: number): Promise<void> {
  const { page } = await import("@vitest/browser/context");
  await page.viewport(ancho, 900);
  try {
    await waitFor(() => expect(document.documentElement.clientWidth).toBe(ancho));

    const raiz = document.documentElement;

    const sonda = document.createElement("div");
    sonda.setAttribute("data-sonda-ley7", "");
    sonda.style.cssText = "width:9999px;height:1px;";
    canvasElement.appendChild(sonda);
    try {
      await waitFor(() => {
        expect(raiz.scrollWidth - raiz.clientWidth).toBeGreaterThan(0);
      });
    } finally {
      sonda.remove();
    }

    await waitFor(() => {
      expect(raiz.scrollWidth - raiz.clientWidth).toBeLessThanOrEqual(0);
    });

    /* Dato primario: el label de cada fuente y el titular de la promesa no se truncan ni se
       recortan en este ancho (Ley 7: "el dato primario no se trunca jamás"). */
    const canvas = within(canvasElement);
    const fuentesPaso1 = fuentesDelPaso1(canvasElement);

    /* Ley 1: en esta fixture SII es la fuente realmente conectada. Banco puede estar diferido;
       Ley 7 mide ambos labels sin inventar que sus estados son iguales. */
    const siiRow = fuentesPaso1.getByText("SII", { exact: true }).closest("li");
    expect(siiRow?.textContent).toContain("Conectada");

    for (const label of ["SII", "Banco"]) {
      /* El run del paso 2 puede repetir el nombre: por eso se consulta sólo Paso 1. */
      const nodo = fuentesPaso1.getByText(label, { exact: true });
      expect(nodo.className).not.toContain("truncate");
      expect(nodo.scrollWidth).toBeLessThanOrEqual(nodo.clientWidth + 1);
    }
    const titular = canvas.getByText(/primer parte estará disponible/i);
    expect(titular.scrollWidth).toBeLessThanOrEqual(titular.clientWidth + 1);
  } finally {
    await page.viewport(1280, 800);
  }
}

const meta = {
  title: "Rediseño F2 / V15 Bienvenida",
  component: BienvenidaV15View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "V15 · Bienvenida: fuentes con estado, run consultable de `/api/onboarding/sync-runs` y disponibilidad al terminar. `records_read` y ETA null se muestran honestamente; no se promete una hora porque el backend no publica scheduler. Flag `onboardingV15`, apagado por defecto.",
      },
    },
  },
  args: {
    states: AMBAS_CONECTADAS,
    run: RUN_EN_CURSO,
  },
} satisfies Meta<typeof BienvenidaV15View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal · dos fuentes conectadas, run consultable en curso",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fuentesPaso1 = fuentesDelPaso1(canvasElement);
    await expect(canvas.getByText("2 de 2 conectadas")).toBeInTheDocument();
    await expect(fuentesPaso1.getByText("SII", { exact: true })).toBeInTheDocument();
    await expect(fuentesPaso1.getByText("Banco", { exact: true })).toBeInTheDocument();
    await expect(canvas.getAllByText("Conectada")).toHaveLength(2);
    expect(texto(canvasElement)).toContain("Sincronización: running");
    expect(texto(canvasElement)).toContain("0 documentos leídos");
    expect(texto(canvasElement)).toContain("Sin tiempo estimado disponible.");
    expect(texto(canvasElement)).not.toMatch(/mañana a las 7/i);
    await expect(canvas.getByRole("link", { name: "Ir a mi panel" })).toHaveAttribute(
      "href",
      "/inicio",
    );
    // Ambas conectadas: ningún "Conectar ahora" en pantalla.
    await expect(canvas.queryByText("Conectar ahora")).not.toBeInTheDocument();
  },
};

export const UnaDiferida: Story = {
  name: "Una diferida · 'la conectas después', 1 pendiente (singular)",
  args: { states: UNA_DIFERIDA, run: null, onIniciarRun: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 de 2 conectadas")).toBeInTheDocument();
    await expect(canvas.getByText("La conectas después")).toBeInTheDocument();
    expect(texto(canvasElement)).toContain("Te queda 1 fuente por conectar.");
    await expect(canvas.getByRole("link", { name: "Conectar ahora" })).toHaveAttribute(
      "href",
      "/onboarding/conectar-banco",
    );
    await expect(
      canvas.getByRole("button", { name: "Iniciar sincronización" }),
    ).toBeInTheDocument();
  },
};

export const NingunaConectada: Story = {
  name: "Ninguna conectada · paso 2 dice que no hay nada que construir todavía",
  args: { states: NINGUNA_CONECTADA, run: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("0 de 2 conectadas")).toBeInTheDocument();
    expect(texto(canvasElement)).toContain("Te quedan 2 fuentes por conectar.");
    await expect(canvas.getByText(/No hay algo que construir todavía/)).toBeInTheDocument();
    await expect(canvas.getByText(/Conecta al menos una fuente en el paso 1/)).toBeInTheDocument();
    // Ley 8: el vacío no se queda en el texto — ofrece el botón que lo resuelve. `next/link`
    // resuelve el ancla contra el pathname actual (acá "/"): se verifica el sufijo, no el
    // pathname exacto, que en producción es el de `/bienvenida`.
    const hrefIrAlPaso1 = canvas.getByRole("link", { name: "Ir al paso 1" }).getAttribute("href");
    expect(hrefIrAlPaso1).toMatch(/#paso-1-titulo$/);
    await expect(canvas.getByText(/No prometemos una hora de entrega/)).toBeInTheDocument();
    await expect(canvas.getAllByText("Conectar ahora")).toHaveLength(2);
  },
};

export const Cargando: Story = {
  name: "Cargando · dice qué se está trayendo y un ETA (Ley 8)",
  args: { states: null, cargando: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/revisando el estado de tus conexiones \(~2 s\)/),
    ).toBeInTheDocument();
  },
};

export const ErrorDeConexion: Story = {
  name: "Error · el estado de conexiones no respondió, con Reintentar",
  args: { states: null, motivo: "No pudimos conectar con tus fuentes (error de red)." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("No pudimos conectar con tus fuentes (error de red).", { exact: false }),
    ).toBeInTheDocument();
  },
};

/* ────────────────────────── Ley 7 · dos mediciones (360 y 320) ────────────────────────── */

/** El mínimo que pide la spec (§5.2): sin scroll horizontal de página en ≥ 360 px. */
export const Ley7Angosto360: Story = {
  name: "Ley 7 · 360 px · sin scroll horizontal de página",
  args: { states: UNA_DIFERIDA, run: null },
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 360);
  },
};

/** El ancho de teléfono más angosto habitual — la instrucción explícita de esta entrega es medir
 *  también acá, no sólo a 360: un desborde a 320 puede existir sin necesitar la brecha de fuente
 *  Linux/Windows que motiva el margen de 346 en otras vistas de este mismo rediseño. */
export const Ley7Angosto320: Story = {
  name: "Ley 7 · 320 px · ancho de teléfono, sin scroll horizontal",
  args: { states: UNA_DIFERIDA, run: null },
  play: async ({ canvasElement }) => {
    await medirLey7SinDesborde(canvasElement, 320);
  },
};
