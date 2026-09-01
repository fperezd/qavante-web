import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { GestionV08View } from "./gestion-v08-view";
import {
  HOY,
  alDia,
  alDiaPrevioCompleto,
  breakdown,
  breakdownSinOrigenCounts,
  breakdownTendencia,
  ciclo,
  docsCompras,
  docsUnCliente,
  docsUnProveedor,
  docsVentasRepartidas,
  documentosDescuadrados,
  documentosServicioMensual,
  mes,
  summary,
  summaryDivergente,
} from "./gestion-v08-fixtures";

/* V08 · Gestión — las seis tabs en sus estados, en Chromium headless (`npm run test:storybook`).
 *
 * Lo que se fija acá se fija sobre el DOM renderizado y sobre el LAYOUT: la Ley 2 se cuenta, el
 * drill-down se abre de verdad con un clic, el buscador del 360 filtra, y la Ley 7 se MIDE a 346 px
 * con un control anti-medición-hueca (si el viewport no quedó en 360, el test falla antes de
 * afirmar nada sobre el scroll). El HTML estático vive en `gestion-v08-view.test.tsx` y la lógica
 * pura en `gestion-v08-model.test.ts`. */

/** Ley 2 — los elementos con token rojo en pantalla (los dos sistemas de tokens del repo). */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

/** El mínimo que exige la spec (§5.2 / Ley 7): cero scroll horizontal de página en ≥ 360 px. */
const ANCHO_MINIMO = 360;

/* Se MIDE catorce píxeles por debajo del mínimo, y no es un número de gusto.
 *
 * La primera versión de esta medición corría justo en 360 y pasaba en Windows mientras FALLABA en
 * el runner de CI (Linux) sobre la misma tabla del Comparativo: el ancho real de un texto depende
 * de las fuentes que tenga instalado el sistema, así que medir en el borde exacto convierte al test
 * en una lotería de plataforma —y la que pierde es la que descubre el bug tarde—. Midiendo en 346
 * el contenido tiene que caber con margen: si pasa acá, pasa en 360 en cualquier máquina.
 *
 * No relaja el criterio: 346 es MÁS estricto que los 360 que pide la spec.
 *
 * LO QUE ESTA MEDICIÓN TODAVÍA NO ALCANZA, dicho para que nadie confíe de más: los catorce píxeles
 * se eligieron como cushion razonable, no calibrados contra el runner. Revirtiendo a mano el
 * arreglo del Comparativo (volverlo a cuatro columnas en angosto, que es EXACTAMENTE lo que CI
 * rechazó) esta medición **sigue pasando en Windows**. O sea: mata los desbordes grandes —los de
 * 369 y 438 px que encontró— pero no reproduce localmente un desborde de pocos píxeles que sí
 * aparece con las fuentes de Linux. El guard de verdad para ese margen fino es el job
 * `test-storybook` de CI, y así hay que tratarlo. Medir el ancho `min-content` real de cada tabla
 * cerraría la brecha; se intentó y el `waitFor` con el poke de estilo colgaba el runner, así que
 * quedó fuera de esta entrega en vez de a medio hacer. */
const HOLGURA_FUENTE = 14;
const ANCHO_MEDIDO = ANCHO_MINIMO - HOLGURA_FUENTE;

/** Ley 7 / §5.2 — a 346 px (= 360 con holgura de fuente) no hay scroll horizontal de página NI
 * dato recortado.
 *
 * Dos controles, y los dos costaron una medición hueca antes de quedar así:
 *
 *   (1) El viewport tiene que haber quedado REALMENTE en el ancho pedido. Sin esta aserción, un
 *       runner que ignore el `page.viewport` mediría el layout de una ventana ancha y el test
 *       pasaría siempre. Verificado a mano: forzando `page.viewport(1280, …)` las tres stories caen.
 *
 *   (2) Medir sólo `scrollWidth` NO alcanza, y esto se comprobó mutando: las tarjetas del rediseño
 *       envuelven sus tablas en un contenedor `overflow-hidden`, así que un contenido más ancho que
 *       la pantalla se RECORTA en vez de generar scroll — y `scrollWidth` no se entera. Con sólo esa
 *       aserción, poner `whitespace-nowrap` en la columna del concepto (o sacarle a los meses viejos
 *       el colapso en angosto) pasaba el test igual, mientras el usuario perdía el dato por el
 *       borde. Por eso además se exige que NINGÚN bloque —tabla o tarjeta— termine más allá del
 *       borde derecho de la ventana. Eso sí muere con la mutación.
 *
 * Se restaura el viewport al final para no contaminar las stories siguientes. */
async function medirSinScrollHorizontal(): Promise<void> {
  const { page } = await import("@vitest/browser/context");
  await page.viewport(ANCHO_MEDIDO, 900);
  try {
    const doc = document.documentElement;
    await waitFor(() => expect(doc.clientWidth).toBe(ANCHO_MEDIDO));
    await waitFor(() => {
      expect(doc.scrollWidth).toBeLessThanOrEqual(ANCHO_MEDIDO);
      expect(document.body.scrollWidth).toBeLessThanOrEqual(ANCHO_MEDIDO);
      /* 1 px de tolerancia: los redondeos sub-pixel del layout no son un desborde. El mensaje
         NOMBRA al culpable con su ancho — un `toBeLessThanOrEqual` pelado obliga a adivinar cuál
         de las tablas de la pantalla se salió. */
      const fuera = Array.from(document.querySelectorAll("table, [class*='overflow-hidden']"))
        .filter((el) => Math.round(el.getBoundingClientRect().right) > ANCHO_MEDIDO + 1)
        .map(
          (el) => `${el.tagName}.${el.className}=${Math.round(el.getBoundingClientRect().right)}`,
        );
      expect(fuera.join(" || ")).toBe("");
    });
  } finally {
    await page.viewport(1280, 800);
  }
}

const meta = {
  title: "Rediseño F2 / V08 Gestión",
  component: GestionV08View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V08 · Gestión (ESPECIFICACION §V08): las nueve páginas de /gestion en UNA vista con seis tabs — Resultado (con el pivote de 3 meses, el drill-down al documento y la sección Costos y gastos), Márgenes (con Ciclo de caja y Punto de equilibrio), Tendencia, Comparativo (regla de oro: mes en curso contra el mes anterior a la MISMA altura) y los dos 360. El titular del Resultado publica el mismo número que V01 · Hoy y lo compara contra el pivote (Ley 1). El export a xls es un hueco declarado: se baja CSV. "Días promedio en pagar" conserva su "en preparación" honesto.',
      },
    },
  },
  args: {
    tab: "resultado",
    onTabChange: fn(),
    summary: summary(),
    breakdown: breakdown(),
    breakdownLargo: breakdownTendencia(),
    mes: mes(),
    alDia: alDia(),
    alDiaPrevioCompleto: alDiaPrevioCompleto(),
    ciclo: ciclo(),
    onDrill: fn(),
    onReintentar: fn(),
    hoy: HOY,
    issueSucesor: "#92",
  },
} satisfies Meta<typeof GestionV08View>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ────────────────────────── Resultado ────────────────────────── */

export const Resultado: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "¿Gano o pierdo?" })).toBeInTheDocument();
    await expect(c.getByText(/Es el mismo número que muestra el Inicio/)).toBeInTheDocument();
    // Ley 2 — el caso normal no tiene NINGÚN rojo (§5.3 pide que exista esa pantalla).
    await expect(rojos(canvasElement)).toHaveLength(0);
    // Sólo una tab activa (§5.7).
    await expect(canvasElement.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
  },
};

export const ResultadoDrillDown: Story = {
  name: "Resultado · drill-down abierto",
  args: {
    drill: {
      account: "operating_income.service_monthly",
      label: "Servicio mensual",
      period: "2026-07",
    },
    drillDocs: documentosServicioMensual(),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/FAC 435/)).toBeInTheDocument();
    await expect(c.getByText(/Comercial Kaufmann/)).toBeInTheDocument();
    await expect(
      c.getByText(/3 documentos · suman \$14\.616\.879, exactamente el monto de la celda/),
    ).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const ResultadoDrillPidePorMontoYMes: Story = {
  name: "Resultado · el monto es el que abre el detalle",
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    // El monto de "Servicio mensual" en julio (el mes más reciente) es un botón, no texto muerto.
    const monto = c.getByRole("button", { name: "14.616.879" });
    await userEvent.click(monto);
    await expect(args.onDrill).toHaveBeenCalledWith({
      account: "operating_income.service_monthly",
      label: "Servicio mensual",
      period: "2026-07",
    });
  },
};

/* Este clic atraviesa el límite Resultado → Pivote: si `TabResultado` deja de entregar el
 * callback, el botón queda inerte y esta story cae. La URL/rango del export nativo se fija en
 * `gestion-export.test.ts`; aquí comprobamos que esa acción llega al control que la persona usa. */
export const ResultadoExportaCsv: Story = {
  name: "Resultado · exporta el pivote como CSV",
  args: { onExportarPivote: fn(async () => {}) },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "⬇ Exportar CSV" }));
    await expect(args.onExportarPivote).toHaveBeenCalledTimes(1);
  },
};

export const ResultadoExportandoCsv: Story = {
  name: "Resultado · preparando CSV",
  args: { exportandoPivote: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("button", { name: "⬇ Exportar CSV" })).toBeDisabled();
    await expect(c.getByRole("status")).toHaveTextContent("Preparando CSV…");
  },
};

export const ResultadoExportCsvConError: Story = {
  name: "Resultado · el export CSV no respondió",
  args: { errorExportPivote: "El export no respondió." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "El export no respondió.",
    );
  },
};

export const ResultadoDrillDescuadrado: Story = {
  name: "Resultado · el detalle no suma su total",
  args: {
    drill: {
      account: "operating_income.service_monthly",
      label: "Servicio mensual",
      period: "2026-07",
    },
    drillDocs: documentosDescuadrados(),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/no confíes en esta lista como completa/)).toBeInTheDocument();
    // Ley 2 — UN solo rojo, y es éste.
    const r = rojos(canvasElement);
    await expect(r).toHaveLength(1);
    await expect(r[0]?.textContent).toMatch(/Los 2 documentos listados suman/);
  },
};

export const ResultadoLey1Divergente: Story = {
  name: "Resultado · los dos motores no cuadran (Ley 1)",
  args: { summary: summaryDivergente() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(
      c.getByText(/Dos motores publican un resultado distinto para jul 2026/),
    ).toBeInTheDocument();
    await expect(c.getByText(/una diferencia de/)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(1);
  },
};

export const ResultadoSinConteoDeExcepciones: Story = {
  name: "Resultado · no se sabe cuántas excepciones quedan fuera",
  args: { breakdown: breakdownSinOrigenCounts() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(
      c.getByText(/no sabemos cuántas excepciones quedan fuera de este cuadro/),
    ).toBeInTheDocument();
    // El gemelo positivo de este negativo vive en la story `Resultado` (dice "no incluye 3").
    await expect(c.queryByText(/no incluye 0 excepciones/)).not.toBeInTheDocument();
  },
};

export const ResultadoSinDato: Story = {
  name: "Resultado · el motor no respondió",
  args: { breakdown: null },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/No pudimos consultar tu Estado de Resultados/)).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  },
};

export const ResultadoColapsaYExpande: Story = {
  name: "Resultado · las secciones se pliegan",
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const seccion = c.getByRole("button", { name: /Ingresos/ });
    await expect(seccion).toHaveAttribute("aria-expanded", "true");
    await expect(c.getByText("Servicio mensual")).toBeInTheDocument();
    await userEvent.click(seccion);
    await expect(seccion).toHaveAttribute("aria-expanded", "false");
    await expect(c.queryByText("Servicio mensual")).not.toBeInTheDocument();
  },
};

/* ────────────────────────── Márgenes / Tendencia ────────────────────────── */

export const Margenes: Story = {
  args: { tab: "margenes" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("$16.779.336 · 42%")).toBeInTheDocument();
    await expect(c.getByText(/necesita tu costo de ventas del período/)).toBeInTheDocument();
    await expect(c.getByText(/necesitas vender \$9\.469\.080 al mes/)).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const Tendencia: Story = {
  args: { tab: "tendencia" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("jul 26 · 42%")).toBeInTheDocument();
    await expect(c.getByText("feb 26 · −31,7%")).toBeInTheDocument();
    await expect(c.getByText("18,1%")).toBeInTheDocument();
  },
};

/* ────────────────────────── Comparativo ────────────────────────── */

export const Comparativo: Story = {
  args: { tab: "comparativo" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/Ago 2026 va en curso \(día 23\)/)).toBeInTheDocument();
    // La regla de oro, medida sobre el DOM: +11,8 % (misma altura), nunca −12,5 % (mes completo).
    await expect(c.getByText("+11,8%")).toBeInTheDocument();
    await expect(c.queryByText("−12,5%")).not.toBeInTheDocument();
    // Gemelo positivo del negativo: el mes completo SÍ está, como referencia gris.
    await expect(c.getByText("$39.945.158")).toBeInTheDocument();
  },
};

export const ComparativoSinCorteAlDia: Story = {
  name: "Comparativo · el backend no dio el corte al día",
  args: { tab: "comparativo", alDia: null },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/No lo simulamos recortando una serie mensual/)).toBeInTheDocument();
  },
};

/* ────────────────────────── 360 ────────────────────────── */

export const Proveedores360: Story = {
  args: { tab: "proveedores", docs360: docsCompras() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "TD Synnex Chile Limitada" })).toBeInTheDocument();
    await expect(
      c.getByText(/Dependes mucho de esta contraparte \(54,4% de tus compras\)/),
    ).toBeInTheDocument();
    await expect(c.getByText("en preparación")).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(1);
  },
};

export const Clientes360SinConcentracion: Story = {
  name: "Clientes 360 · cartera repartida (sin alerta)",
  args: { tab: "clientes", docs360: docsVentasRepartidas() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/bajo el umbral de alerta \(30%\)/)).toBeInTheDocument();
    await expect(c.queryByText(/Dependes mucho de esta contraparte/)).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const Proveedores360Busca: Story = {
  name: "Proveedores 360 · el buscador filtra",
  args: { tab: "proveedores", docs360: docsCompras() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const buscador = c.getByRole("searchbox");
    await userEvent.type(buscador, "Andes");
    await expect(c.getByRole("heading", { name: "Servicios Andes SpA" })).toBeInTheDocument();
    await expect(
      c.queryByRole("heading", { name: "TD Synnex Chile Limitada" }),
    ).not.toBeInTheDocument();
    await userEvent.clear(buscador);
    await expect(c.getByRole("heading", { name: "TD Synnex Chile Limitada" })).toBeInTheDocument();
  },
};

/* El sustantivo tiene que quedar CALIFICADO en las dos frases del mensaje de "sin resultados": la
 * primera ("Ningún proveedor") y la segunda ("Los 3 proveedores"), no un número suelto. Nació roto
 * porque la variable `plural` se declaró y nunca se conectó (ver PR #93); este test la ejercita de
 * verdad, con el gemelo positivo de la MISMA regex. */
export const Proveedores360BuscaSinResultados: Story = {
  name: "Proveedores 360 · el buscador sin resultados",
  args: { tab: "proveedores", docs360: docsCompras() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const buscador = c.getByRole("searchbox");
    await userEvent.type(buscador, "Zzzzzzzz");
    await expect(
      c.getByText(
        /Ningún proveedor coincide con “Zzzzzzzz”\. Los 3 proveedores de los últimos 12 meses siguen ahí: borra la búsqueda para verlos\./,
      ),
    ).toBeInTheDocument();
    await userEvent.clear(buscador);
    await expect(c.getByRole("heading", { name: "TD Synnex Chile Limitada" })).toBeInTheDocument();
  },
};

export const Clientes360BuscaSinResultados: Story = {
  name: "Clientes 360 · el buscador sin resultados",
  args: { tab: "clientes", docs360: docsVentasRepartidas() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const buscador = c.getByRole("searchbox");
    await userEvent.type(buscador, "Zzzzzzzz");
    await expect(
      c.getByText(
        /Ningún cliente coincide con “Zzzzzzzz”\. Los 4 clientes de los últimos 12 meses siguen ahí: borra la búsqueda para verlos\./,
      ),
    ).toBeInTheDocument();
    await userEvent.clear(buscador);
    await expect(c.getByRole("heading", { name: "Cliente Uno SpA" })).toBeInTheDocument();
  },
};

/* PR #93 — el pase §6 sobre `8ed0e549` midió el defecto que la corrección de arriba dejó vivo: con
 * UNA sola contraparte en 12 meses, "Los 1 proveedores" (o "Los 1 clientes") es tan falso como el
 * "Los 42" original. El texto en singular no es sólo cambiar la terminación (también cambia el
 * artículo, el verbo y el pronombre de "verlos"), así que se afirma la frase completa, no un
 * fragmento. Gemelo positivo de la MISMA regex que las dos stories de arriba (N>1). */
export const Proveedores360BuscaSinResultadosUno: Story = {
  name: "Proveedores 360 · el buscador sin resultados, con UN solo proveedor",
  args: { tab: "proveedores", docs360: docsUnProveedor() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const buscador = c.getByRole("searchbox");
    await userEvent.type(buscador, "Zzzzzzzz");
    await expect(
      c.getByText(
        /Ningún proveedor coincide con “Zzzzzzzz”\. El proveedor de los últimos 12 meses sigue ahí: borra la búsqueda para verlo\./,
      ),
    ).toBeInTheDocument();
    await expect(c.queryByText(/Los 1 proveedores/)).not.toBeInTheDocument();
    await userEvent.clear(buscador);
    await expect(c.getByRole("heading", { name: "TD Synnex Chile Limitada" })).toBeInTheDocument();
  },
};

export const Clientes360BuscaSinResultadosUno: Story = {
  name: "Clientes 360 · el buscador sin resultados, con UN solo cliente",
  args: { tab: "clientes", docs360: docsUnCliente() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const buscador = c.getByRole("searchbox");
    await userEvent.type(buscador, "Zzzzzzzz");
    await expect(
      c.getByText(
        /Ningún cliente coincide con “Zzzzzzzz”\. El cliente de los últimos 12 meses sigue ahí: borra la búsqueda para verlo\./,
      ),
    ).toBeInTheDocument();
    await expect(c.queryByText(/Los 1 clientes/)).not.toBeInTheDocument();
    await userEvent.clear(buscador);
    await expect(c.getByRole("heading", { name: "Cliente Uno SpA" })).toBeInTheDocument();
  },
};

export const Contrapartes360SinDato: Story = {
  name: "360 · el registro no respondió",
  args: { tab: "clientes", docs360: null },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/esta pantalla no está vacía, está ciega/)).toBeInTheDocument();
  },
};

/* ────────────────────────── Ley 7 · medición a 346 px ────────────────────────── */

export const Ley7ResultadoAngosto: Story = {
  name: "Ley 7 · Resultado a 346 px",
  args: {
    drill: {
      account: "operating_income.service_monthly",
      label: "Servicio mensual",
      period: "2026-07",
    },
    drillDocs: documentosServicioMensual(),
  },
  play: medirSinScrollHorizontal,
};

export const Ley7ComparativoAngosto: Story = {
  name: "Ley 7 · Comparativo a 346 px",
  args: { tab: "comparativo" },
  play: medirSinScrollHorizontal,
};

export const Ley7Proveedores360Angosto: Story = {
  name: "Ley 7 · Proveedores 360 a 346 px",
  args: { tab: "proveedores", docs360: docsCompras() },
  play: medirSinScrollHorizontal,
};
