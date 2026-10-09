import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn } from "storybook/test";
import { PagarV05View } from "./pagar-v05-view";
import {
  ANOMALIA_ENTEL,
  HOY,
  pagos,
  pagosAuditoriaD01,
  pagosConDuplicado,
  pagosConFechasEstimadas,
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
          'V05 · Pagar (ESPECIFICACION §V05): tríada (Vencido / Por pagar · selector 7-14-30 / Caja proyectada con críticos separados), banner de postergables que enlaza a Hoy (la ejecución masiva NO vive aquí), filtros con conteo (Impuestos y Remuneraciones incluidos) y tabla con proveedor completo, vence absoluto+relativo, pill de tipo y "detalle ▾". El posible duplicado llega como par UUID del backend y se marca con pill Revisar. NO existe "pagar todo" (Ley 9). "Servicio" y Postergar quedan fuera de esta entrega (huecos declarados).',
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

async function expandirHorizonte90(canvas: ReturnType<typeof within>) {
  const horizonte = canvas.getByRole("group", { name: "Horizonte de compromisos de pago" });
  await userEvent.click(within(horizonte).getByRole("button", { name: "90 días" }));
}

export const Normal: Story = {
  name: "Normal · vencido ≠ crítico; un solo rojo (la fila crítica más urgente)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("$8.729.650")).toBeInTheDocument();
    await expect(canvas.getByText("$16.632.726")).toBeInTheDocument();
    await expect(canvas.getByText("Conciliación por cerrar")).toBeInTheDocument();
    await expect(canvas.queryByText(/en la lista visible/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/\$16\.807\.705 críticos · 6 pagos/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/\$2\.878\.055/)).not.toBeInTheDocument();
    /* D01 — el monto negociable ya no se deriva de la tabla; la caja proyectada no vuelve a
       restar lo que la curva ya trae. */
    await expect(canvas.queryByRole("note")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/no se vuelven a restar/)).not.toBeInTheDocument();
    await expandirHorizonte90(canvas);
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
    await expect(canvas.queryByText(/jamás entran en postergaciones/)).not.toBeInTheDocument();
    // Footer §5.5 con el total del backend; a 90 días el KPI Por pagar coincide con ese total.
    await expect(canvas.getByText(/Total por pagar/)).toBeInTheDocument();
    await expect(canvas.getAllByText("$19.205.210").length).toBeGreaterThanOrEqual(2);
  },
};

export const AuditoriaD01: Story = {
  name: "Auditoría D01 · caja y críticos separados, sin doble resta",
  args: { pagos: pagosAuditoriaD01() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* La tríada ya no publica la caja proyectada legacy; sí el estado de conciliación de Pagado. */
    await expect(canvas.getByText("Conciliación por cerrar")).toBeInTheDocument();
    await expect(canvas.queryByText(/57\.238\.923/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/faltan \$/i)).not.toBeInTheDocument();
  },
};

export const SelectorDePeriodo: Story = {
  name: "Por pagar · 7/14/30 · cada tramo es el número del backend",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const horizonte = canvas.getByRole("group", { name: "Horizonte de compromisos de pago" });
    await expect(canvas.getByText("$16.632.726")).toBeInTheDocument();
    await userEvent.click(within(horizonte).getByRole("button", { name: "14 días" }));
    await expect(canvas.getByText("$17.998.105")).toBeInTheDocument();
    await expect(canvas.queryByText("$16.632.726")).not.toBeInTheDocument();
    await userEvent.click(within(horizonte).getByRole("button", { name: "30 días" }));
    // El tramo de 30 coincide con el total del footer (KPI + pie).
    await expect(canvas.getAllByText("$19.205.210").length).toBeGreaterThanOrEqual(2);
  },
};

export const ConDuplicado: Story = {
  name: "Posible duplicado · pill roja Revisar con su .sub; la fila crítica cede el rojo (Ley 2)",
  args: { pagos: pagosConDuplicado(), anomalias: [ANOMALIA_ENTEL] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandirHorizonte90(canvas);
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
    /* El duplicado es una señal de la fila, no un filtro: no existe un chip que recorte la
       página por él. Los chips son los que publica el servidor sobre todo el registro. */
    await expect(canvas.queryByRole("radio", { name: /^Revisar/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Todos · 9" })).toBeInTheDocument();
    // Gemelo del rojo: el relativo de la fila crítica (en 2 días) quedó SIN rojo.
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
  name: "Filtros y búsqueda · el servidor filtra y cuenta; la vista no recorta la página",
  args: { onFiltroChange: fn(), onConsultaChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expandirHorizonte90(canvas);
    /* D02/D15 — los conteos de los chips los publica `filter_metadata` sobre TODO el registro:
       no salen de contar la tabla ni se mueven al filtrar o buscar. */
    await expect(canvas.getByRole("radio", { name: "Todos · 8" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Vencidos · 3" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Alta · 5" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Impuestos · 1" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Remuneraciones · 1" })).toBeInTheDocument();

    // Elegir un chip es una CONSULTA nueva: se le pide al servidor, no se recorta lo ya traído.
    await expect(filas(canvasElement)).toHaveLength(8);
    await userEvent.click(canvas.getByRole("radio", { name: "Vencidos · 3" }));
    await expect(args.onFiltroChange).toHaveBeenCalledWith("vencidos");
    await expect(filas(canvasElement)).toHaveLength(8);
    await expect(canvas.getByRole("radio", { name: "Todos · 8" })).toBeInTheDocument();

    // La búsqueda también viaja al servidor, y tampoco mueve los conteos publicados.
    await userEvent.type(canvas.getByRole("searchbox"), "76.555.555");
    await expect(args.onConsultaChange).toHaveBeenCalled();
    await expect(canvas.getByRole("radio", { name: "Todos · 8" })).toBeInTheDocument();
  },
};

export const DetallePorFila: Story = {
  name: '"detalle ▾" · los hechos del pago y el link a su módulo',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandirHorizonte90(canvas);
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
    await expandirHorizonte90(canvas);
    // El filtro los muestra, con los conteos que publica el servidor…
    await expect(canvas.getByRole("radio", { name: "Impuestos · 1" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Remuneraciones · 2" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Todos · 3" })).toBeInTheDocument();
    // …y NADA entra en postergaciones: ninguna fila negociable y sin banner de postergables.
    await expect(canvas.queryByRole("note")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/es negociable/)).not.toBeInTheDocument();
    await expect(canvas.getAllByText("No se posterga")).toHaveLength(3);
    await expect(canvas.queryByText(/jamás entran en postergaciones/)).not.toBeInTheDocument();
    // La cobertura canónica confirma que cubre; el único rojo sigue siendo la fila más urgente.
    await expect(canvas.queryByText(/Alcanza para los pagos críticos/)).not.toBeInTheDocument();
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("en 5 días");
  },
};

export const DatosDegradados: Story = {
  name: 'Degradado · "sin fecha" nunca es "vence hoy"; USD sin TC no suma; cobertura indeterminada',
  args: { pagos: pagosDegradados() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandirHorizonte90(canvas);
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
    /* La tríada ya no publica la caja proyectada en USD; el footer sí declara monedas sin TC. */
    await expect(canvas.queryByRole("radio", { name: /^Sin fecha/ })).not.toBeInTheDocument();
  },
};

export const FechasEstimadas: Story = {
  name: "Certeza de la fecha · pill y nota del servidor por fila; lo estimado no es mora ni crítico",
  args: { pagos: pagosConFechasEstimadas() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandirHorizonte90(canvas);
    // Los tres valores del contrato en la misma página: dos estimadas, una sin confirmar.
    await expect(canvas.getAllByText("Fecha aproximada")).toHaveLength(4);
    // La pill del arriendo y, sin nota, la misma etiqueta sola en su "detalle ▾" (en el DOM).
    await expect(canvas.getAllByText("Fecha por confirmar")).toHaveLength(2);
    // La nota server-owned va tal cual en el `.sub` de la fila y en su detalle (2 apariciones).
    await expect(
      canvas.getAllByText(
        /Fecha estimada a 30 días desde la emisión; el documento no trae vencimiento pactado\./,
      ),
    ).toHaveLength(1);
    // Sin nota no se inventa copy: el arriendo dice sólo su estado.
    const arriendo = filas(canvasElement).find((f) =>
      f.textContent?.includes("Inmobiliaria Los Leones"),
    )!;
    await expect(arriendo).toHaveTextContent("Fecha por confirmar");
    await expect(arriendo).toHaveTextContent("hace 10 días");
    await expect(within(arriendo).getByText("hace 10 días").className).not.toContain(
      "rediseno-ambar",
    );
    // Gemelo: la vencida confirmada (Kennedy) sí va en ámbar.
    await expect(canvas.getByText("hace 545 días").className).toContain("rediseno-ambar");
    // Ley 2: el único rojo sigue siendo la fila crítica CONFIRMADA (BICE), no el F29 estimado.
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("en 2 días");
    // El conteo de estimados es del servidor y vive en Por pagar, fuera de los tramos.
    await expect(canvas.getByText(/2 pagos con fecha aproximada/)).toBeInTheDocument();
    // "detalle ▾" de la fila estimada trae la certeza con su nota.
    const telefonica = filas(canvasElement).find((f) => f.textContent?.includes("Telefónica"))!;
    await userEvent.click(within(telefonica).getByText("detalle ▾"));
    await expect(within(telefonica).getByText("Fecha")).toBeInTheDocument();
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
