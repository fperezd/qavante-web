import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { PagarV05View } from "./pagar-v05-view";
import {
  ANOMALIA_ENTEL,
  HOY,
  pagos,
  pagosConDuplicado,
  pagosDegradados,
  pagosSoloImpuestosYSueldos,
  pagosVacio,
} from "./pagar-v05-fixtures";

/* V05 · Pagar — "¿a quién le pago, y qué es crítico?", en sus estados.
 *
 * Corren en Chromium headless como gate (`npm run test:storybook`). Lo que se fija acá se fija
 * sobre el DOM renderizado: la Ley 2 se CUENTA (elementos con token rojo) y se verifica QUIÉN
 * lleva el rojo; los filtros filtran de verdad; el selector de período cambia el número del
 * backend. Cada negativo lleva su gemelo positivo con la misma query. La lógica pura vive en
 * `pagar-v05-model.test.ts` y el HTML estático en `pagar-v05-view.test.tsx`. */

/** Ley 2 — los elementos con token rojo que hay en pantalla (ambos sistemas de tokens del repo). */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

function filas(canvasElement: HTMLElement): HTMLElement[] {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>("tbody tr"));
}

const meta = {
  title: "Rediseño F2 / V05 Pagar",
  component: PagarV05View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V05 · Pagar (ESPECIFICACION §V05): tríada (Vencido / Por pagar · selector 7-14-30 / Crítico vs. caja), banner de postergables que enlaza a Hoy (la ejecución masiva NO vive aquí), filtros con conteo (Impuestos y Remuneraciones incluidos) y tabla con proveedor completo, vence absoluto+relativo, pill de tipo y "detalle ▾". El posible duplicado llega como par UUID del backend y se marca con pill Revisar. NO existe "pagar todo" (Ley 9). "Servicio" y Postergar quedan fuera de esta entrega (huecos declarados).',
      },
    },
  },
  args: {
    pagos: pagos(),
    issueSucesor: "#88",
    hoy: HOY,
  },
} satisfies Meta<typeof PagarV05View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal · vencido ≠ crítico; un solo rojo (la fila crítica más urgente)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("$8.729.650")).toBeInTheDocument();
    await expect(canvas.getByText(/3 pagos · el más antiguo, 545 días/)).toBeInTheDocument();
    await expect(canvas.getByText("$17.998.105")).toBeInTheDocument();
    await expect(canvas.getByText("$8.078.055")).toBeInTheDocument();
    await expect(
      canvas.getByText(/faltan \$2\.878\.055 aun postergando lo negociable/),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("note")).toHaveTextContent(
      "$1.190.400 de lo que vence en 14 días es negociable",
    );
    await expect(canvas.getByRole("link", { name: "Ver Hoy" })).toHaveAttribute("href", "/");
    // Ley 2: UN rojo, y es el relativo de la fila crítica más urgente (Banco BICE, en 2 días).
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("en 2 días");
    // Orden por urgencia: la factura de 18 meses arriba; la nómina con su período; 8 filas.
    const lista = filas(canvasElement);
    await expect(lista).toHaveLength(8);
    await expect(lista[0]!).toHaveTextContent("Inmobiliaria Vista Kennedy SpA");
    await expect(lista[0]!).toHaveTextContent("3 mar 2025 · hace 545 días");
    // El nombre aparece en la celda y en su popover de detalle (el <details> vive en el DOM).
    await expect(canvas.getAllByText("Remuneraciones: Agosto 2026")).toHaveLength(2);
    // Ley 9: no existe "pagar todo"; el texto fijo está literal.
    await expect(canvas.queryByRole("button", { name: /pagar todo/i })).not.toBeInTheDocument();
    await expect(
      canvas.getByText(/Impuestos y sueldos jamás entran en postergaciones automáticas\./),
    ).toBeInTheDocument();
    // Footer §5.5 con el total del backend.
    await expect(canvas.getByText(/Total por pagar/)).toBeInTheDocument();
    await expect(canvas.getByText("$19.205.210")).toBeInTheDocument();
  },
};

export const SelectorDePeriodo: Story = {
  name: "Por pagar · 7/14/30 · cada tramo es el número del backend",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("$17.998.105")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("radio", { name: "7 días" }));
    await expect(canvas.getByText("$16.632.726")).toBeInTheDocument();
    await expect(canvas.queryByText("$17.998.105")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("radio", { name: "30 días" }));
    // El tramo de 30 coincide con el total del footer: aparece en los DOS lugares.
    await expect(canvas.getAllByText("$19.205.210")).toHaveLength(2);
  },
};

export const ConDuplicado: Story = {
  name: "Posible duplicado · pill roja Revisar con su .sub; la fila crítica cede el rojo (Ley 2)",
  args: { pagos: pagosConDuplicado(), anomalias: [ANOMALIA_ENTEL] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Ley 2: sigue habiendo UN rojo, y ahora es la pill Revisar del duplicado más urgente.
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("Revisar");
    // El .sub usa el par UUID publicado, no una regla recalculada en el cliente.
    await expect(
      canvas.getAllByText(/posible duplicado señalado por el registro/).length,
    ).toBeGreaterThanOrEqual(2);
    // El .sub de la fila y su popover de detalle dicen lo mismo (2 apariciones).
    await expect(
      canvas.getAllByText(
        "posible duplicado señalado por el registro: Factura 9017 (27 ago, $205.000)",
      ),
    ).toHaveLength(2);
    // El chip condicional aparece con su conteo y filtra.
    await userEvent.click(canvas.getByRole("radio", { name: "Revisar · 2" }));
    await expect(filas(canvasElement)).toHaveLength(2);
    // Gemelo del rojo: el relativo de la fila crítica (en 2 días) quedó SIN rojo.
    await userEvent.click(canvas.getByRole("radio", { name: "Todos · 9" }));
    const critico = canvas.getByText("en 2 días");
    await expect(critico.className).not.toContain("rediseno-rojo");
  },
};

export const AnomaliasSinDato: Story = {
  name: "Señal de anomalías no disponible · no se concluye que no haya duplicados",
  args: {
    pagos: pagosConDuplicado(),
    anomalias: null,
    anomaliasMotivo: "No pudimos revisar posibles duplicados; no los estamos descartando.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No pudimos revisar posibles duplicados/)).toBeInTheDocument();
    await expect(canvas.queryByText("Revisar")).not.toBeInTheDocument();
  },
};

export const FiltrosYBusqueda: Story = {
  name: "Filtros con conteo y búsqueda · los chips filtran; los conteos siguen la búsqueda",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(filas(canvasElement)).toHaveLength(8);
    await userEvent.click(canvas.getByRole("radio", { name: "Vencidos · 3" }));
    await expect(filas(canvasElement)).toHaveLength(3);
    await userEvent.click(canvas.getByRole("radio", { name: "Críticos · 3" }));
    await expect(filas(canvasElement)).toHaveLength(3);
    await expect(canvas.getAllByText("Remuneraciones: Agosto 2026").length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("radio", { name: "Impuestos · 1" }));
    await expect(filas(canvasElement)).toHaveLength(1);
    await expect(canvas.getAllByText("F29 · IVA de julio").length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("radio", { name: "Remuneraciones · 1" }));
    await expect(filas(canvasElement)).toHaveLength(1);
    await userEvent.click(canvas.getByRole("radio", { name: "Todos · 8" }));
    await userEvent.type(canvas.getByRole("searchbox"), "76.555.555");
    await expect(filas(canvasElement)).toHaveLength(1);
    await expect(canvas.getAllByText("Entel PCS Telecomunicaciones S.A.").length).toBeGreaterThan(
      0,
    );
    // Los conteos siguen la búsqueda.
    await expect(canvas.getByRole("radio", { name: "Todos · 1" })).toBeInTheDocument();
  },
};

export const DetallePorFila: Story = {
  name: '"detalle ▾" · los hechos del pago y el link a su módulo',
  play: async ({ canvasElement }) => {
    const fila = filas(canvasElement)[0]!; // Kennedy
    await userEvent.click(within(fila).getByText("detalle ▾"));
    await expect(within(fila).getByText("Factura 1201")).toBeInTheDocument();
    await expect(within(fila).getByText("76.222.222-2")).toBeInTheDocument();
    await expect(
      within(fila).getByRole("link", { name: "Ver en Facturas recibidas" }),
    ).toHaveAttribute("href", "/pagar/facturas-recibidas");
    // La nómina enlaza a Remuneraciones con su período.
    const nomina = filas(canvasElement)[4]!;
    await userEvent.click(within(nomina).getByText("detalle ▾"));
    await expect(
      within(nomina).getByRole("link", { name: "Ver en Remuneraciones" }),
    ).toHaveAttribute("href", "/remuneraciones?period=2026-08");
  },
};

export const SoloImpuestosYSueldos: Story = {
  name: "Sólo impuestos y sueldos · Ley 9: el filtro los muestra, nada es postergable",
  args: { pagos: pagosSoloImpuestosYSueldos() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El filtro los muestra…
    await expect(canvas.getByRole("radio", { name: "Impuestos · 1" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Remuneraciones · 2" })).toBeInTheDocument();
    // …y NADA entra en postergaciones: chip en cero, sin banner.
    await expect(canvas.getByRole("radio", { name: "Postergables · 0" })).toBeInTheDocument();
    await expect(canvas.queryByRole("note")).not.toBeInTheDocument();
    await expect(canvas.getAllByText("No se posterga")).toHaveLength(3);
    await expect(
      canvas.getByText(/Impuestos y sueldos jamás entran en postergaciones automáticas\./),
    ).toBeInTheDocument();
    // La caja cubre lo crítico: holgura, sin drama — y el único rojo sigue siendo la fila más urgente.
    await expect(
      canvas.getByText(/la caja proyectada \(\$9\.100\.000\) lo cubre/),
    ).toBeInTheDocument();
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("en 5 días");
  },
};

export const DatosDegradados: Story = {
  name: 'Degradado · "sin fecha" nunca es "vence hoy"; USD sin TC no suma; caja en USD no se compara',
  args: { pagos: pagosDegradados() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // La fila sin fecha parseable dice "sin fecha" (la celda Vence), al final de la tabla.
    const ultima = filas(canvasElement).at(-1)!;
    await expect(ultima).toHaveTextContent("Aguas Cordillera S.A.");
    await expect(ultima).toHaveTextContent("sin fecha");
    await expect(ultima).not.toHaveTextContent("hoy");
    // Lo sin fecha que el backend dejó fuera de la tabla, declarado con monto y conteo.
    await expect(
      canvas.getByText(/3 documentos por \$2\.450\.000 sin fecha, en ningún tramo/),
    ).toBeInTheDocument();
    // INV-FX-001: el USD sin TC no se suma como pesos, y se dice dónde.
    await expect(
      canvas.getByText(/1 pago en otra moneda sin tipo de cambio, fuera del total/),
    ).toBeInTheDocument();
    // La caja proyectada viene en USD: no se compara con pesos.
    await expect(
      canvas.getByText(
        /la caja proyectada viene en USD y lo crítico está en pesos: no se comparan/,
      ),
    ).toBeInTheDocument();
    // El chip condicional "Sin fecha" existe con su conteo.
    await userEvent.click(canvas.getByRole("radio", { name: "Sin fecha · 1" }));
    await expect(filas(canvasElement)).toHaveLength(1);
  },
};

export const Vacio: Story = {
  name: "Vacío · el registro no tiene pagos agendados y dice qué falta",
  args: { pagos: pagosVacio() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No hay pagos por pagar")).toBeInTheDocument();
    await expect(canvas.getByText(/Falta: Conectar SII\./)).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Revisar conexiones" })).toHaveAttribute(
      "href",
      "/conexiones",
    );
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinRespuesta: Story = {
  name: "Sin respuesta · la pantalla está ciega, no vacía",
  args: {
    pagos: null,
    pagosMotivo: "No pudimos conectar con el registro de pagos (error de red).",
    onReintentar: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("No pudimos consultar las cuentas por pagar"),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/error de red/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Reintentar" }));
    await expect(args.onReintentar).toHaveBeenCalledTimes(1);
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};
