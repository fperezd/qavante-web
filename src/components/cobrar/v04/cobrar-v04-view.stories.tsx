import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect, userEvent, fn, waitFor } from "storybook/test";
import { CobrarV04View } from "./cobrar-v04-view";
import {
  HOY,
  NOTA_ESTIMADA,
  ar,
  arConFechasEstimadas,
  arConcentracionAlta,
  arSinClientes,
  arTodoAlDia,
  arVencidoDesconocido,
  gestionado,
} from "./cobrar-v04-fixtures";

/* V04 · Cobrar — "¿quién me debe?", en sus estados.
 *
 * Corren en Chromium headless como gate (`npm run test:storybook`). Lo que se fija acá se fija
 * sobre el DOM renderizado: la Ley 2 se CUENTA (elementos con token rojo), la cuenta regresiva del
 * lote (Ley 4) se cancela de verdad y se deja terminar de verdad. Cada negativo lleva su gemelo
 * positivo con la misma query. La lógica pura vive en `cobrar-v04-model.test.ts` y el HTML estático
 * en `cobrar-v04-view.test.tsx`. */

/** Ley 2 — los elementos con token rojo que hay en pantalla (ambos sistemas de tokens del repo). */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

/** Espera de RELOJ, más larga que la ventana de arrepentimiento.
 *
 * Existe por un defecto medido en el pase §6: afirmar `not.toHaveBeenCalled()` justo después de
 * Cancelar pasa igual aunque el timer siga vivo, porque la ventana todavía no venció. Un negativo
 * sólo prueba algo si se evalúa DESPUÉS del instante en que el positivo habría ocurrido. */
async function pasadaLaVentana(segundos: number) {
  await new Promise((r) => setTimeout(r, segundos * 1000 + 800));
}

function filas(canvasElement: HTMLElement): HTMLElement[] {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>("tbody tr"));
}

const meta = {
  title: "Rediseño F2 / V04 Cobrar",
  component: CobrarV04View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "V04 · Cobrar (ESPECIFICACION §V04): crumb con el estado de gestión como chip gris, 5 tarjetas de aging con % del total, banner de concentración → lote real con cuenta regresiva cancelable (Ley 4), filtros con conteo y la tabla de clientes con WhatsApp · correo · Recordatorio.",
      },
    },
  },
  args: {
    ar: ar(),
    gestionado: gestionado(),
    gestionDisponible: true,
    onToggleGestionado: fn(),
    onMarcarLote: fn(() => true),
    onEnviarLote: fn(async (ids: string[]) =>
      ids.map((receivable_id) => ({ receivable_id, status: "sent" as const, detail: "Enviado." })),
    ),
    onCopiar: fn(() => true),
    loteSegundos: 2,
    hoy: HOY,
  },
} satisfies Meta<typeof CobrarV04View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal · vencido conocido, un solo rojo (el más grave)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Estado de gestión")).toHaveTextContent(
      "Gestionaste a 2 de 6 clientes · última hace 2 días",
    );
    await expect(canvas.getByText("$27.779.467")).toBeInTheDocument();
    await expect(canvas.getByText("65,2% del total")).toBeInTheDocument();
    await expect(canvas.getByText("$9.479.467")).toBeInTheDocument(); // +61 = 61–90 + 90+
    await expect(canvas.getByRole("note")).toHaveTextContent(
      "3 clientes concentran $12.294.967 del vencido.",
    );
    // Ley 2: UN rojo, y es la pill de 80 días.
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("80 días");
    await expect(canvas.getByText("73 días")).toBeInTheDocument(); // el otro +60, en ámbar
    await expect(filas(canvasElement)).toHaveLength(6);
    await expect(canvas.getByText("Empresa de Correos de Chile")).toBeInTheDocument();
    await expect(canvas.getByText(/total por cobrar \(bruto\)/)).toBeInTheDocument();
    await expect(canvas.getByText("$42.579.467")).toBeInTheDocument();
    await expect(canvas.getAllByRole("link", { name: "WhatsApp" })).toHaveLength(6);
    /* Gemelo positivo del padding compacto de `Angosto360`: con la tabla ancha son 18 px, o sea el
       compacto es del ancho y no del componente. */
    await expect(
      getComputedStyle(canvasElement.querySelector<HTMLElement>("tbody td")!).paddingLeft,
    ).toBe("18px");
  },
};

export const VencidoDesconocido: Story = {
  name: 'Vencido desconocido · `overdue: null`, el caso vivo: "sin dato", nunca $0',
  args: { ar: arVencidoDesconocido(), gestionado: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("sin dato").length).toBeGreaterThanOrEqual(5);
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/0% del total/)).not.toBeInTheDocument();
    await expect(canvas.queryByText("Al día")).not.toBeInTheDocument();
    // Gemelo positivo del negativo: el saldo real de la tabla SÍ está.
    await expect(canvas.getByText("$11.582.539")).toBeInTheDocument();
    await expect(canvas.getByRole("note")).toHaveTextContent(
      "3 clientes concentran $20.577.506 de tu saldo por cobrar (48,3%). No sabemos cuánto de eso está vencido",
    );
    await expect(canvas.getAllByText("Sin vencimiento conocido")).toHaveLength(5);
    await expect(
      canvas.getByRole("radio", { name: "Sin vencimiento conocido · 5" }),
    ).toBeInTheDocument();
    await expect(canvas.getByLabelText("Estado de gestión")).toHaveTextContent(
      "Sin gestiones registradas",
    );
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const FechasEstimadas: Story = {
  name: "Certeza de la fecha · pill y nota del servidor por documento; lo estimado no es mora",
  args: { ar: arConFechasEstimadas() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Los tres valores del contrato en la misma cartera: una estimada, una sin confirmar, el resto
    // confirmadas (sin pill).
    await expect(canvas.getByText("Fecha estimada")).toBeInTheDocument();
    await expect(canvas.getByText("Fecha sin confirmar")).toBeInTheDocument();
    // La nota server-owned va tal cual junto al documento; sin nota, sólo el documento.
    await expect(canvas.getByText(`Factura 462 · ${NOTA_ESTIMADA}`)).toBeInTheDocument();
    await expect(canvas.getByText("Factura 495")).toBeInTheDocument();
    // Lo estimado no mueve los días de mora: Diveimport sigue en 73 (no 90) y en ámbar.
    const dive = filas(canvasElement).find((f) => f.textContent?.includes("Diveimport"))!;
    await expect(dive).toHaveTextContent("vencido $3.300.000 hace 73 días");
    await expect(dive).not.toHaveTextContent("90 días");
    // Ley 2: el único rojo sigue siendo GPS7000 (80 días confirmados).
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("80 días");
    // El conteo de estimados es del servidor y vive junto a Vencido · bruto.
    await expect(
      canvas.getByText(/1 documento con fecha estimada, fuera de la mora/),
    ).toBeInTheDocument();
    await expect(canvas.getByText("$27.779.467")).toBeInTheDocument(); // el vencido no cambia
  },
};

export const SinClientes: Story = {
  name: "Sin clientes · el registro no tiene documentos vivos y dice qué falta",
  args: { ar: arSinClientes(), gestionado: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No hay clientes con saldo por cobrar")).toBeInTheDocument();
    await expect(canvas.getByText(/Falta: Conectar SII\./)).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Revisar conexiones" })).toHaveAttribute(
      "href",
      "/conexiones",
    );
    await expect(canvas.queryByText("Vencido · bruto")).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const ConcentracionAlta: Story = {
  name: "Concentración alta · 3 clientes = 92,5% del vencido; sigue siendo un rojo",
  args: { ar: arConcentracionAlta(), gestionado: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("note")).toHaveTextContent(
      "3 clientes concentran $18.500.000 del vencido. Un recordatorio a cada uno cubre el 92,5% de tu deuda vencida.",
    );
    const marcados = rojos(canvasElement);
    await expect(marcados).toHaveLength(1);
    await expect(marcados[0]!).toHaveTextContent("121 días");
    await expect(canvas.getByText("66 días")).toBeInTheDocument();
  },
};

export const TodoAlDia: Story = {
  name: "Todo al día · cero verificado: $0 y 0% son la verdad; sin banner, sin rojo",
  args: { ar: arTodoAlDia(), gestionado: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("$0").length).toBeGreaterThanOrEqual(4);
    await expect(canvas.getByText(/0% del total · estás al día/)).toBeInTheDocument();
    await expect(canvas.queryByRole("note")).not.toBeInTheDocument();
    await expect(canvas.getAllByText("Al día")).toHaveLength(2);
    await expect(canvas.queryByText("sin dato")).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const SinRespuesta: Story = {
  name: "Sin respuesta · la pantalla está ciega, no vacía",
  args: {
    ar: null,
    arMotivo: "No pudimos conectar con el registro de cobranza (error de red).",
    onReintentar: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("No pudimos consultar las cuentas por cobrar"),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/error de red/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Reintentar" }));
    await expect(args.onReintentar).toHaveBeenCalledTimes(1);
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const FiltrosYBusqueda: Story = {
  name: "Filtros con conteo y búsqueda · los chips filtran la tabla",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(filas(canvasElement)).toHaveLength(6);
    await userEvent.click(canvas.getByRole("radio", { name: "+60 días · 2" }));
    await expect(filas(canvasElement)).toHaveLength(2);
    await userEvent.click(canvas.getByRole("radio", { name: "Al día · 1" }));
    await expect(filas(canvasElement)).toHaveLength(1);
    await expect(canvas.getByText("Tepille SpA")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("radio", { name: "Prioridad · 6" }));
    await userEvent.type(canvas.getByRole("searchbox"), "76.111.111");
    await expect(filas(canvasElement)).toHaveLength(1);
    await expect(canvas.getByText("Diveimport S.A.")).toBeInTheDocument();
    // Los conteos siguen la búsqueda.
    await expect(canvas.getByRole("radio", { name: "Prioridad · 1" })).toBeInTheDocument();
  },
};

export const LoteCancelable: Story = {
  name: "Lote · Ley 4: la cuenta regresiva se ve, se cancela y no envía nada",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Enviar a los 3" }));
    const panel = within(canvas.getByRole("region", { name: "Recordatorio a 3 clientes" }));
    await expect(panel.getByText("Diveimport S.A.")).toBeInTheDocument();
    // Antes de la cuenta no hay links de envío en el panel: nada sale sin la ventana.
    await expect(panel.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
    await userEvent.click(panel.getByRole("button", { name: "Enviar los 3 recordatorios" }));
    await expect(panel.getByRole("status")).toHaveTextContent("Enviando 3 recordatorios en 2 s");
    await userEvent.click(panel.getByRole("button", { name: "Cancelar" }));
    await expect(panel.queryByRole("status")).not.toBeInTheDocument();
    /* El negativo, DESPUÉS de que la ventana haya vencido: un timer que sigue corriendo (o un
       Cancelar que sólo limpia la UI) marcaría acá, y este assert lo caza. Afirmarlo antes es un
       negativo hueco — pasaba con el timer vivo. */
    await pasadaLaVentana(args.loteSegundos!);
    await expect(args.onEnviarLote).not.toHaveBeenCalled();
    // Gemelo positivo: sin cancelar, la cuenta termina y SÍ envía (misma query, misma función).
    await userEvent.click(panel.getByRole("button", { name: "Enviar los 3 recordatorios" }));
    await waitFor(() => expect(args.onEnviarLote).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await expect(panel.getByRole("status")).toHaveTextContent("Se enviaron 3 recordatorios");
    await expect(panel.getAllByRole("link", { name: "WhatsApp" })).toHaveLength(3);
    await expect(panel.getAllByRole("link", { name: "correo" })).toHaveLength(3);
    // Un solo rojo en toda la pantalla, también con el panel abierto.
    await expect(rojos(canvasElement)).toHaveLength(1);
  },
};

export const LoteSinPreferencias: Story = {
  name: "Lote sin preferencias · el envío puede completar, pero no inventa una gestión local",
  args: { gestionDisponible: false, onMarcarLote: fn(() => false) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Enviar a los 3" }));
    const panel = within(canvas.getByRole("region", { name: "Recordatorio a 3 clientes" }));
    await userEvent.click(panel.getByRole("button", { name: "Enviar los 3 recordatorios" }));
    await waitFor(() => expect(args.onEnviarLote).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await expect(args.onEnviarLote).toHaveBeenCalledWith(
      expect.arrayContaining(["00000000-0000-4000-8000-000000000003"]),
      expect.any(String),
    );
    await expect(args.onMarcarLote).not.toHaveBeenCalled();
    await expect(rojos(canvasElement)).toHaveLength(1); // el ámbar no suma un segundo rojo
  },
};

export const LoteResultadosParciales: Story = {
  name: "Lote · resultados por documento: no confunde omitido, error ni sin destinatario con envío",
  args: {
    loteSegundos: 1,
    onEnviarLote: fn(async (ids: string[]) => [
      { receivable_id: ids[0]!, status: "sent" as const, detail: "Enviado." },
      { receivable_id: ids[1]!, status: "sin_destinatario" as const, detail: "Sin correo." },
      { receivable_id: ids[2]!, status: "skipped" as const, detail: "Ya existía." },
    ]),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Enviar a los 3" }));
    const panel = within(canvas.getByRole("region", { name: "Recordatorio a 3 clientes" }));
    await userEvent.click(panel.getByRole("button", { name: "Enviar los 3 recordatorios" }));
    await waitFor(() => expect(args.onEnviarLote).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await expect(panel.getByRole("status")).toHaveTextContent("Se envió 1 recordatorio");
    await expect(panel.getByRole("status")).toHaveTextContent("1 sin destinatario");
    await expect(panel.getByRole("status")).toHaveTextContent("1 ya procesado anteriormente");
    await expect(panel.getByRole("list", { name: "Resultado por documento" })).toHaveTextContent(
      "sin destinatario",
    );
    // Gemelo positivo: sólo el resultado `sent` cuenta como envío real.
    await expect(panel.getByRole("status")).not.toHaveTextContent("Se enviaron 3 recordatorios");
  },
};

export const LoteEscapeCancela: Story = {
  name: "Lote · Escape cancela la ventana (foco DENTRO del panel) y el PUT no sale",
  args: { loteSegundos: 1 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Enviar a los 3" }));
    const panel = within(canvas.getByRole("region", { name: "Recordatorio a 3 clientes" }));
    await userEvent.click(panel.getByRole("button", { name: "Enviar los 3 recordatorios" }));
    await expect(panel.getByRole("status")).toHaveTextContent("Enviando 3 recordatorios");
    // El foco quedó dentro del panel tras pulsar; Escape desde ahí.
    await userEvent.keyboard("{Escape}");
    await expect(panel.queryByRole("status")).not.toBeInTheDocument();
    /* Y el PUT no sale pasada la ventana: la UI volvió atrás Y el timer murió. */
    await pasadaLaVentana(args.loteSegundos!);
    await expect(args.onEnviarLote).not.toHaveBeenCalled();
    await expect(panel.queryByText(/Se enviaron/)).not.toBeInTheDocument();
    /* Gemelo positivo, con la MISMA aserción y la misma espera: sin Escape sí envía. */
    await userEvent.click(panel.getByRole("button", { name: "Enviar los 3 recordatorios" }));
    await pasadaLaVentana(args.loteSegundos!);
    await expect(args.onEnviarLote).toHaveBeenCalledTimes(1);
    await expect(panel.getByRole("status")).toHaveTextContent("Se enviaron");
  },
};

export const LoteEscapeDesdeFuera: Story = {
  name: "Lote · Escape cancela también con el foco FUERA del panel",
  args: { loteSegundos: 1 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Enviar a los 3" }));
    const panel = within(canvas.getByRole("region", { name: "Recordatorio a 3 clientes" }));
    await userEvent.click(panel.getByRole("button", { name: "Enviar los 3 recordatorios" }));
    await expect(panel.getByRole("status")).toHaveTextContent("Enviando 3 recordatorios");
    /* El listener vive en `document`, así que tiene que cancelar también desde afuera: se mueve
       el foco al buscador de la tabla y recién ahí se pulsa Escape. */
    const buscador = canvas.getByRole("searchbox");
    buscador.focus();
    await expect(document.activeElement).toBe(buscador);
    await userEvent.keyboard("{Escape}");
    await expect(panel.queryByRole("status")).not.toBeInTheDocument();
    await pasadaLaVentana(args.loteSegundos!);
    await expect(args.onEnviarLote).not.toHaveBeenCalled();
  },
};

export const Angosto360: Story = {
  name: "360 px · el nombre y el monto no se recortan; sólo colapsa el metadato (Ley 7 · §5.2)",
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
    await expect(Math.round(caja.getBoundingClientRect().width)).toBe(360);

    /* (1) La TABLA entra completa: ni scroll horizontal ni contenido recortado por el
       `overflow-hidden` del wrapper. Es el defecto que se está fijando: antes la tabla pedía
       730 px de mínimo dentro de un contenedor de 360 y el saldo quedaba afuera.

       Se mide la tabla y no `caja.scrollWidth` a propósito: los popovers ⓘ son `position:
       absolute` y se dimensionan en `vw`, así que en un contenedor de 360 px dentro de una
       ventana ancha NO se achican (en una pantalla de 360 px reales miden 80vw = 288 px). Medir
       el contenedor entero mezclaría ese artefacto del método con el desborde real del layout.
       El del footer, que sí vivía recortado dentro del wrapper, ahora abre hacia arriba. */
    const tabla = caja.querySelector<HTMLElement>("table")!;
    /* EL NODO IMPORTA: se mide `tabla.parentElement`, que es el `overflow-y-auto` y por lo tanto
       el que scrollea de verdad. Su padre (el `overflow-hidden`) informa desborde 0 SIEMPRE —con un
       eje en `auto` el otro computa `auto` y el hijo se come el desborde—, así que medirlo a él era
       una aserción que no podía fallar: con el fix del `.sub` revertido el monto queda 208 px fuera,
       el scroller dice 209 y el wrapper sigue diciendo 0.

       Tampoco se compara el ANCHO absoluto de la tabla: ese número depende de las métricas de fuente
       de la plataforma (358 px en Windows, 379 px en el Linux de CI antes de compactar el padding) y
       falla por la plataforma en vez de por el defecto. */
    const scroller = tabla.parentElement!;
    await expect(scroller.scrollWidth - scroller.clientWidth).toBeLessThanOrEqual(0);

    /* B2: el padding compacto es un cambio de layout que ningún test miraba — revertirlo dejaba la
       suite entera en verde. Su gemelo positivo (18 px con la tabla ancha) vive en `Normal`. */
    const celda = canvasElement.querySelector<HTMLElement>("tbody td")!;
    await expect(getComputedStyle(celda).paddingLeft).toBe("10px");
    /* Y el dato primario no queda truncado: el nombre más largo, sin ellipsis. */
    const largo = canvas.getByText("Empresa de Correos de Chile");
    await expect(getComputedStyle(largo).textOverflow).not.toBe("ellipsis");
    await expect(largo.scrollWidth).toBeLessThanOrEqual(largo.clientWidth);

    /* (2) La columna de METADATO colapsó… */
    await expect(
      canvas.queryByRole("columnheader", { name: /Antigüedad/ }),
    ).not.toBeInTheDocument();
    /* …y las que no colapsan jamás siguen ahí (gemelo positivo del negativo de arriba). */
    await expect(canvas.getByRole("columnheader", { name: /Cliente/ })).toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: /Saldo/ })).toBeInTheDocument();

    /* (3) En CADA fila, el nombre va entero y el monto entra completo en el contenedor. */
    const borde = caja.getBoundingClientRect().right;
    for (const fila of filas(canvasElement)) {
      /* La celda colapsada sigue en el DOM con `display:none`: se filtran las que ocupan lugar,
         así que quedan las tres que NUNCA colapsan (cliente, saldo, acciones). */
      const visibles = Array.from(fila.querySelectorAll<HTMLElement>("td")).filter(
        (td) => td.getBoundingClientRect().width > 0,
      );
      await expect(visibles).toHaveLength(3);
      const nombre = visibles[0]!.querySelector<HTMLElement>("div > div")!;
      const monto = visibles[1]!;
      await expect(nombre.scrollWidth).toBeLessThanOrEqual(nombre.clientWidth);
      await expect(monto.textContent).toMatch(/^\$/); // es la celda del monto, no otra
      await expect(monto.getBoundingClientRect().right).toBeLessThanOrEqual(borde + 1);
    }
    /* Y el dato de la columna colapsada NO se perdió: sigue escrito en el `.sub` de la fila. */
    await expect(canvas.getByText(/vencido \$1\.792\.441 hace 80 días/)).toBeInTheDocument();
  },
};

export const RecordatorioYGestion: Story = {
  name: "Fila · Recordatorio copia la plantilla actual; Gestionado persiste",
  play: async ({ canvasElement, args }) => {
    const fila = within(filas(canvasElement)[0]!); // Empresa de Correos de Chile (prioridad 1)
    await userEvent.click(fila.getByRole("button", { name: "Recordatorio" }));
    await expect(args.onCopiar).toHaveBeenCalledWith(
      expect.stringContaining("Estimados Empresa de Correos de Chile:"),
    );
    await expect(args.onCopiar).toHaveBeenCalledWith(expect.stringContaining("$4.672.594"));
    await expect(fila.getByRole("button", { name: "Copiado ✓" })).toBeInTheDocument();
    await userEvent.click(fila.getByRole("button", { name: "Gestionado" }));
    await expect(args.onToggleGestionado).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Empresa de Correos de Chile" }),
    );
  },
};
