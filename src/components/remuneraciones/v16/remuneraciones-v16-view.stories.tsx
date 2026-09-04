import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent } from "storybook/test";
import { RemuneracionesV16View } from "./remuneraciones-v16-view";
import { PERIODO, REVENUE, detalle, movimientos, totales } from "./remuneraciones-v16-fixtures";

/* V16 · Remuneraciones — "Tu nómina" en sus estados.
 *
 * Corren en Chromium headless como gate (`npm run test:storybook`). Lo que se fija acá se fija
 * sobre el DOM renderizado: Ley 2 se CUENTA (cero elementos con token rojo, en TODOS los
 * estados) y el ⓘ de "% de ingresos" se abre de verdad. La lógica pura vive en
 * `remuneraciones-v16-model.test.ts` y el HTML estático (incluida la concordancia N=1) en
 * `remuneraciones-v16-view.test.tsx`. */

/** Ley 2 — los elementos con token rojo que hay en pantalla (ambos sistemas de tokens del repo). */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

/** Texto plano de toda la pantalla, para frases que cruzan varios nodos hermanos (ej. el footer,
 *  con el `<b>` de la Ley 9 en medio) — `getByText` sólo matchea el texto PROPIO de un elemento. */
function texto(canvasElement: HTMLElement): string {
  return (canvasElement.textContent ?? "").replace(/\s+/g, " ").trim();
}

const meta = {
  title: "Rediseño F2 / V16 Remuneraciones",
  component: RemuneracionesV16View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V16 · Remuneraciones (ESPECIFICACION §V16, issue #77): tríada Líquido/Cotizaciones (Previred)/Costo empresa con % de ingresos ⓘ + tabla por persona con estado y link a la liquidación. "Costo empresa" viene del costo_empresa por persona que BUK entrega · nunca líquido + cotizaciones (trampa de doble conteo ADR-0056/ADR-0070). Footer con el texto fijo de la Ley 9, literal. Cero rojo en toda la pantalla (Ley 2): "Pendiente" es progreso, no alarma.',
      },
    },
  },
  args: {
    periodo: PERIODO,
    totales: totales(),
    detalle: detalle(),
    movimientos: movimientos(),
    revenue: REVENUE,
  },
} satisfies Meta<typeof RemuneracionesV16View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal · tríada + tabla, 4 de 5 pagados, cero rojo",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Líquido de Julio 2026")).toBeInTheDocument();
    await expect(canvas.getByText("$13.387.759")).toBeInTheDocument();
    await expect(canvas.getByText("$3.190.631")).toBeInTheDocument();
    await expect(canvas.getByText("$18.990.000")).toBeInTheDocument();
    await expect(canvas.getByText(/48,8% de tus ingresos/)).toBeInTheDocument();
    // La persona sin débito calzado queda "Pendiente", NUNCA roja.
    await expect(canvas.getByText("Pendiente")).toBeInTheDocument();
    await expect(canvas.getAllByText("Pagado ✓")).toHaveLength(4);
    await expect(rojos(canvasElement)).toHaveLength(0);
    // Ley 9: literal (el texto cruza el <b> y su hermano, se busca en el textContent completo).
    expect(texto(canvasElement)).toContain(
      "Impuestos y sueldos jamás entran en postergaciones automáticas.",
    );
    // El link "liquidación" de cada fila apunta a la Planilla clásica del período.
    const links = canvas.getAllByRole("link", { name: "liquidación" });
    await expect(links).toHaveLength(5);
    await expect(links[0]!).toHaveAttribute("href", `/remuneraciones?period=${PERIODO}`);
  },
};

export const InfoIngresos: Story = {
  name: "ⓘ % de ingresos · se abre y explica de dónde sale cada número",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Qué es % de ingresos"));
    await expect(
      canvas.getByText(/Costo empresa del mes dividido por tus ingresos del mismo mes/),
    ).toBeVisible();
    await expect(
      canvas.getByText(/no incluye las cotizaciones de Previred otra vez/),
    ).toBeVisible();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinDetallePorPersona: Story = {
  name: "Sin detalle por persona · Costo empresa 'sin dato', nunca líquido + cotizaciones",
  args: { detalle: [], movimientos: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Costo empresa total")).toBeInTheDocument();
    await expect(canvas.getAllByText("sin dato").length).toBeGreaterThan(0);
    // El número que NO debe aparecer como si fuera el costo empresa (líquido + cotizaciones).
    expect(texto(canvasElement)).not.toContain("$16.578.390");
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const BancoSinConsultar: Story = {
  name: "Banco no consultado · TODOS 'No verificado', nunca 'Pendiente' (no se sabe, no se afirma)",
  args: { movimientos: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("No verificado")).toHaveLength(5);
    await expect(canvas.queryByText("Pagado ✓")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Pendiente")).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const UnaSolaPersona: Story = {
  name: "1 persona · concordancia singular (issue #94)",
  args: {
    totales: totales({ empleados_contados: 1, total_liquido: 2_850_000 }),
    detalle: [detalle()[0]!],
    movimientos: [movimientos()[0]!],
  },
  play: async ({ canvasElement }) => {
    // "1 persona · pagado ✓" vive entero en un solo <div> (el detalle del KpiCard): getByText
    // matchea su textContent propio sin ambigüedad.
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 persona · pagado ✓")).toBeInTheDocument();
    // El footer cruza el <b> de la Ley 9: se busca en el textContent completo de la pantalla.
    const t = texto(canvasElement);
    expect(t).toContain("1 de 1 persona conciliada con el cargo de nómina del banco.");
    // Gemelos negativos con la MISMA frase en plural — no deben aparecer en ningún lado.
    expect(t).not.toContain("1 personas");
    expect(t).not.toContain("1 de 1 personas conciliadas");
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinPlanillaDelPeriodo: Story = {
  name: "Sin planilla del período · estado vacío honesto, cero rojo",
  args: { totales: undefined, detalle: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No hay planilla de Julio 2026/i)).toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: "Ver Remuneraciones (todos los períodos)" }),
    ).toHaveAttribute("href", "/remuneraciones");
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

/* ── Ley 7 / §5.2 a 360 px (hallazgo del pase §6, PR #97: la tabla desbordaba 122 px un
 * contenedor de 360) ─────────────────────────────────────────────────────────────────────────
 *
 * Mismo patrón que `cobrar-v04-view.stories.tsx` (`Angosto360`), que es el detector exacto que
 * usó el reviewer para medir el desborde: un decorator con un `<div>` fijo de 360 px —no un
 * resize real del viewport— porque esta vista puede vivir embebida en un contenedor angosto
 * aunque la ventana del navegador sea ancha (por eso las columnas usan `hideBelowTable`, no
 * `hideBelow`, igual que V04). */
export const Angosto360: Story = {
  name: "360 px · persona y líquido no se recortan; Estado y liquidación colapsan (Ley 7 · §5.2)",
  decorators: [
    (Story) => (
      <div data-angosto="360" style={{ width: 360, maxWidth: 360, overflow: "hidden" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const caja = canvasElement.querySelector<HTMLElement>('[data-angosto="360"]')!;
    /* Control: el contenedor quedó realmente en 360 px antes de medir nada más. Con el decorator
       la ventana real del navegador sigue ancha (`documentElement.clientWidth` no baja de 360) —
       lo que constriñe la tabla es ESTE nodo, así que es a ÉL a quien hay que preguntarle. Medir
       cualquier otra cosa (el documento, un ancestro sin este límite) mediría otro layout. */
    await expect(Math.round(caja.getBoundingClientRect().width)).toBe(360);
    expect(document.documentElement.clientWidth).toBeGreaterThanOrEqual(360);

    const tabla = canvas.getByRole("table");
    /* EL NODO IMPORTA (mismo hallazgo que dejó documentado `cobrar-v04`): se mide
       `tabla.parentElement`, el `div.overflow-y-auto` de `table.tsx`, que es el que scrollea de
       verdad. Su padre —el wrapper `overflow-hidden`— informa desborde 0 SIEMPRE (con un eje en
       `auto` el otro computa `auto` y el hijo se come el desborde): medirlo a él es una aserción
       que no puede fallar aunque el contenido se esté cortando. */
    const scroller = tabla.parentElement!;
    await expect(scroller.scrollWidth - scroller.clientWidth).toBeLessThanOrEqual(0);

    /* CONTROL POSITIVO del detector — sin esto, el "0" de arriba no prueba nada: podría ser una
       medición rota que SIEMPRE da 0. Se inyecta una sonda ancha dentro del MISMO scroller y se
       confirma que la MISMA expresión la detecta, antes de confiar en el negativo. */
    const sonda = document.createElement("div");
    sonda.setAttribute("data-sonda-desborde", "");
    sonda.style.width = "600px";
    sonda.style.height = "1px";
    scroller.appendChild(sonda);
    try {
      await expect(scroller.scrollWidth - scroller.clientWidth).toBeGreaterThan(0);
    } finally {
      scroller.removeChild(sonda);
    }
    // Y limpia la sonda vuelve a dar 0 — el DOM queda como estaba para el resto del play.
    await expect(scroller.scrollWidth - scroller.clientWidth).toBeLessThanOrEqual(0);

    /* El dato primario (Ley 7): la persona más larga del fixture, entera, sin truncar. */
    const nombre = canvas.getByText("Fernanda Pizarro Díaz");
    await expect(nombre.scrollWidth).toBeLessThanOrEqual(nombre.clientWidth);

    /* Y el líquido de CADA fila entra completo dentro del contenedor — es el otro dato primario
       (§5.2: "el dato primario jamás se trunca"), nunca colapsa. */
    const borde = caja.getBoundingClientRect().right;
    for (const monto of ["$2.850.000", "$2.610.000", "$2.245.500", "$2.281.259", "$3.401.000"]) {
      const celda = canvas.getByText(monto);
      await expect(celda.getBoundingClientRect().right).toBeLessThanOrEqual(borde + 1);
    }

    /* Lo accesorio SÍ colapsó: la columna "Estado" (metadato) no está en el DOM visible (rol de
       accesibilidad, que sí respeta `display:none`)… */
    await expect(canvas.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
    /* …y su celda en CADA fila queda oculta y sin ancho — `getByText` no sirve de negativo acá:
       a diferencia de `getByRole`, no filtra por visibilidad y encuentra el Pill igual aunque
       esté `display:none` (lo comprobó este mismo test: falló con "multiple elements" antes de
       este fix). El estado real se verifica en el layout, no en la accesibilidad. */
    const celdasEstado = Array.from(canvasElement.querySelectorAll<HTMLElement>("tbody tr")).map(
      (fila) => fila.querySelectorAll<HTMLElement>("td")[1]!,
    );
    await expect(celdasEstado).toHaveLength(5);
    for (const celda of celdasEstado) {
      expect(celda.className).toMatch(/hidden/);
      await expect(celda.getBoundingClientRect().width).toBe(0);
    }
    /* …y la columna principal sigue ahí (gemelo positivo del negativo de arriba). */
    await expect(canvas.getByRole("columnheader", { name: "Persona" })).toBeInTheDocument();
    /* El link "liquidación" (navegación, no dato) también colapsó — sigue en el DOM (no se borra
       la fila ni deja de existir el link para quien vea la tabla más ancha), pero `display:none`
       lo saca del árbol de accesibilidad — por eso se busca con `querySelectorAll` crudo y no con
       `getByRole`, que de otro modo daría 0 SIEMPRE y el assert de abajo no probaría nada. */
    const linksOcultos = Array.from(
      canvasElement.querySelectorAll<HTMLAnchorElement>('td a[href*="/remuneraciones?period="]'),
    );
    await expect(linksOcultos).toHaveLength(5);
    for (const link of linksOcultos) {
      const celda = link.closest("td")!;
      expect(celda.className).toMatch(/hidden/);
      await expect(celda.getBoundingClientRect().width).toBe(0);
    }
  },
};

export const ErrorDeConexion: Story = {
  name: "Error · el conector no respondió, con acción de reintentar",
  args: { totales: undefined, payrollError: "No pudimos conectar con Remuneraciones (BUK)." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("No pudimos conectar con Remuneraciones (BUK).", { exact: false }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Revisar conexiones" })).toHaveAttribute(
      "href",
      "/conexiones",
    );
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};
