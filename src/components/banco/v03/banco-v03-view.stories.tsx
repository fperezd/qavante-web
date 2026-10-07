import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect } from "storybook/test";
import { BancoV03View } from "./banco-v03-view";
import { movimientosV03 } from "./banco-v03-model";
import { resolutionDetailFromMovement } from "./bank-resolution-detail-model";
import {
  BANCO,
  HOY,
  SUMMARY_STALE,
  categorias,
  cuentasQavante,
  links,
  movimientos,
  saldoOk,
  saldoSesionVencida,
  saldoTarjetas,
  sourcesError,
  sourcesOk,
  sourcesSinConectar,
  sourcesSyncing,
  summary,
  tarjetasOk,
  tarjetasSesionVencida,
} from "./banco-v03-fixtures";

/* V03 · Banco — la pantalla en sus estados (spec §V03): normal, sin banco conectado, conexión con
 * acción requerida (la forma REAL del 2026-08-30), sin movimientos y "actualizando". Corren en
 * Chromium como gate (`npm run test:storybook`); el test de vista con `react-dom/server` cubre las
 * mismas afirmaciones sin browser. */

/** Ley 2 — los elementos con token de rojo que hay en pantalla. */
function rojos(canvasElement: HTMLElement): Element[] {
  return Array.from(canvasElement.querySelectorAll('[class*="rediseno-rojo"], [class*="danger-"]'));
}

const meta = {
  title: "Rediseño F2 / V03 Banco",
  component: BancoV03View,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'V03 · Banco (ESPECIFICACION §V03): "Caja hoy" (la misma función que V01/V02), tabla de cuentas con frescura + pill de conexión + saldo según el banco, filtros con conteo y tabla de movimientos con su ciclo de vida. "Actualizando" muestra ETA/etapa sólo si la fuente los publica; con inicio sin ETA declara esa ausencia.',
      },
    },
  },
  args: {
    summary: summary(),
    saldo: saldoOk(),
    tarjetas: tarjetasOk(),
    saldoPorTarjeta: saldoTarjetas(),
    cuentasQavante: cuentasQavante(),
    links: links(),
    sources: sourcesOk(),
    movimientos: movimientos(),
    movimientosTotal: 8,
    categorias: categorias(),
    banco: BANCO,
    hoy: HOY,
  },
} satisfies Meta<typeof BancoV03View>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  name: "Normal · banco al día, movimientos con su ciclo de vida",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* El KPI "Caja hoy" (cajaHoy) y el saldo que el banco informa en la tabla valen lo mismo en
       esta fixture a propósito ($9.800.000): se afirma cada uno en SU zona. */
    const kpi = within(canvasElement.querySelector('section[aria-label="Caja hoy"]')!);
    await expect(kpi.getByText("$9.800.000")).toBeInTheDocument();
    await expect(kpi.getByText("BICE · hoy ✓")).toBeInTheDocument();
    await expect(kpi.getByText("el mismo número que en Hoy y Caja")).toBeInTheDocument();
    await expect(canvas.getAllByText("$9.800.000")).toHaveLength(2); // KPI + fila de la cuenta CLP
    await expect(canvas.getAllByText("Conectada ✓").length).toBeGreaterThan(0);
    await expect(
      canvas.getByText("actualizada hoy · 4 movimientos por conciliar"),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("combobox", { name: "Cuenta de la cartola" })).toHaveValue(
      "acc-clp",
    );
    await expect(
      canvas.getByRole("combobox", { name: "Filtrar por conciliación" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("combobox", { name: "Filtrar por clasificación" }),
    ).toBeInTheDocument();
    await expect(canvas.getAllByText("Conciliado ✓")).toHaveLength(2);
    await expect(canvas.getAllByText("Clasificado ✓")).toHaveLength(4);
    await expect(canvas.getAllByText("Sin clasificar")).toHaveLength(4);
    /* La contraparte que el banco acreditó manda en la columna principal (api#1134). */
    await expect(canvas.getByText("Abono · Cliente Norte SpA")).toBeInTheDocument();
    /* Ley 7: la glosa completa sigue en el DOM, entera. Ahora viaja dentro del `.sub` junto a la
       procedencia, así que se busca por contenido y no por nodo exacto: lo custodiado es que la
       glosa no se pierda ni se recorte, no en qué línea quedó. */
    await expect(
      canvas.getByText(/Abono por transferencia de Cliente Norte SpA 76\.123\.456-7/),
    ).toBeInTheDocument();
    /* Y la procedencia va al lado del nombre: la pantalla dice de dónde salió esa identidad. */
    await expect(
      canvas.getByText(/Contraparte informada por el banco · 76\.123\.456-7/),
    ).toBeInTheDocument();
    // "Clasificar" abre el flujo actual con el ítem cargado.
    const cta = canvas.getAllByRole("link", { name: "Clasificar" })[0]!;
    await expect(cta).toHaveAttribute("href", "/bandeja");
    await expect(rojos(canvasElement)).toHaveLength(0);
    await userEvent.click(canvas.getAllByRole("button", { name: "Ver detalle" })[0]!);
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByRole("dialog", { name: "Cómo se resolvió" })).toBeInTheDocument();
    await expect(page.getByRole("region", { name: "Conciliación" })).toBeInTheDocument();
    await expect(page.getByRole("region", { name: "Clasificación" })).toBeInTheDocument();
  },
};

const rawHistoricalMovement = {
  ...movimientos()[0]!,
  id: "movement-historical",
  bank_account_id: "account-historical",
  date: "2025-01-15",
  description: "Pago histórico abierto desde una factura",
  /* Se declara la contraparte en vez de heredar la de m1 al spread: este movimiento es de enero
     de 2025 y entró por el historial, un camino de ingesta que no mira contraparte, así que al
     banco nunca se le preguntó por él. Heredar "Cliente Norte SpA" le pondría a un movimiento
     histórico una identidad que nadie acreditó. */
  counterparty_name: null,
  counterparty_tax_id: null,
  counterparty_source: "not_captured" as const,
};
const historicalMovement = movimientosV03({
  items: [rawHistoricalMovement],
  cuentas: new Map(),
  categorias: categorias(),
})[0]!;

export const EnlaceHistorico: Story = {
  name: "Enlace documental · abre un movimiento fuera de los tres meses",
  args: {
    selectedAccountId: "account-historical",
    deepLinkedMovement: historicalMovement,
    resolutionDetails: new Map([
      [
        historicalMovement.id,
        resolutionDetailFromMovement(rawHistoricalMovement, historicalMovement.categoria),
      ],
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("row", {
        name: "Ver detalle de Pago histórico abierto desde una factura",
      }),
    ).toBeInTheDocument();
    const page = within(canvasElement.ownerDocument.body);
    const dialog = page.getByRole("dialog", { name: "Cómo se resolvió" });
    await expect(dialog).toBeInTheDocument();
    await expect(
      within(dialog).getByText("Pago histórico abierto desde una factura"),
    ).toBeInTheDocument();
  },
};

export const SinBancoConectado: Story = {
  name: "Sin banco conectado · el vacío dice qué falta y cómo resolverlo",
  args: {
    saldo: null,
    tarjetas: null,
    saldoPorTarjeta: new Map(),
    cuentasQavante: [],
    links: null,
    sources: sourcesSinConectar(),
    movimientos: [],
    movimientosTotal: 0,
    summary: summary({ cash_today: null }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No hay cuentas de banco")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Conectar un banco" })).toHaveAttribute(
      "href",
      "/conexiones",
    );
    await expect(canvas.getByText("No hay movimientos del banco")).toBeInTheDocument();
    // El "no sé" del saldo: sin dato, no $0.
    await expect(canvas.getByText("BICE · sin saldo")).toBeInTheDocument();
    await expect(canvas.queryByText("$0")).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const AccionRequerida: Story = {
  name: "Conexión con acción requerida · la forma real con la sesión vencida",
  args: {
    summary: SUMMARY_STALE,
    saldo: saldoSesionVencida(),
    tarjetas: tarjetasSesionVencida(),
    saldoPorTarjeta: new Map(),
    links: null,
    sources: sourcesError(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Tu sesión con BICE no está disponible.")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Reconectar BICE" })).toHaveAttribute(
      "href",
      "/conexiones",
    );
    await expect(canvas.getAllByText("Tu acción").length).toBeGreaterThan(0);
    await expect(canvas.queryByText("Conectada ✓")).not.toBeInTheDocument();
    await expect(
      canvas.getByText("desde el 28 ago no llegan movimientos · 4 movimientos por conciliar"),
    ).toBeInTheDocument();
    // Saldo del banco: sin dato (Sin información + ⓘ), no $0. Caja hoy sigue (es otra fuente) pero marcada vieja.
    await expect(canvas.getAllByText("Sin información").length).toBeGreaterThan(0);
    await expect(canvas.getByText("BICE · hace 2 días")).toBeInTheDocument();
    await expect(canvas.getByText(/Puede estar desactualizado/)).toBeInTheDocument();
    /* Ley 2: "requiere tu acción" es ÁMBAR. Cero rojos, y el gemelo positivo: sí hay ámbar. */
    await expect(rojos(canvasElement)).toHaveLength(0);
    await expect(
      canvasElement.querySelectorAll('[class*="rediseno-ambar"]').length,
    ).toBeGreaterThan(0);
  },
};

export const SinMovimientos: Story = {
  name: "Sin movimientos · el cero es real y se dice",
  args: { movimientos: [], movimientosTotal: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No hay movimientos del banco")).toBeInTheDocument();
    // Las cuentas siguen (no hay pendientes que contar: el .sub no inventa un cero).
    await expect(canvas.getAllByText("actualizada hoy").length).toBeGreaterThan(0);
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const Actualizando: Story = {
  name: "Actualizando · el tiempo estimado que publica el sync, sin la etapa libre de la fuente",
  args: {
    saldo: null,
    tarjetas: null,
    saldoPorTarjeta: new Map(),
    links: null,
    sources: sourcesSyncing(),
    refrescando: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Actualizando").length).toBeGreaterThan(0);
    // El `.sub` lleva además los pendientes ("· N movimientos por conciliar"): se busca por prefijo.
    await expect(canvas.getAllByText(/^trayendo la cartola… listo en 45 s/).length).toBeGreaterThan(
      0,
    );
    await expect(
      canvas.getByText("Actualizando saldos con el banco (trayendo la cartola… listo en 45 s)"),
    ).toBeInTheDocument();
    /* `sync_progress.step` es texto libre de la fuente: no cruza a la pantalla. Gemelo con la
       MISMA palabra que sí trae la fixture. */
    await expect(canvas.queryByText(/Leyendo cartola/)).not.toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};

export const BuscarYFiltrar: Story = {
  name: "Buscar por glosa, RUT o monto + filtros con conteo",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "Buscar por glosa, RUT o monto" });
    await userEvent.type(input, "76.123.456-7");
    await expect(canvas.getByRole("radio", { name: "Todos · 1" })).toBeInTheDocument();
    /* El RUT buscado está en el campo de contraparte Y en la glosa; el único resultado se lee por
       su principal nueva, y la glosa completa sigue presente debajo (Ley 7). */
    await expect(canvas.getByText("Abono · Cliente Norte SpA")).toBeInTheDocument();
    await expect(
      canvas.getByText(/Abono por transferencia de Cliente Norte SpA 76\.123\.456-7/),
    ).toBeInTheDocument();
    await expect(canvas.queryByText("Transf. Dattatec.com hosting")).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "7.450.761");
    await expect(canvas.getByText("Pago SII F29")).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Cargos · 1" })).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Filtrar por conciliación" }),
      "pendiente",
    );
    // El filtro muestra exactamente lo que el chip contó: los conciliados no están.
    await expect(canvas.queryByText("Nómina en línea agosto")).not.toBeInTheDocument();
    await expect(canvas.getByText("Pago SII F29")).toBeInTheDocument();
    await expect(canvas.getByText("Transf. Dattatec.com hosting")).toBeInTheDocument();
  },
};

export const Ley1CajaHoyVsBanco: Story = {
  name: "Ley 1 · Caja hoy con apellido; cuando el banco informa otra cosa, se dice",
  args: {
    summary: summary({
      cash_today: {
        total: "9500000",
        last_updated: "2026-08-30T00:12:00Z",
        data_state: "available",
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // El KPI es cajaHoy(): $9.500.000. El banco informa $9.800.000 y la vista lo declara al lado.
    await expect(canvas.getByText("$9.500.000")).toBeInTheDocument();
    await expect(canvas.getByText("· el banco informa $9.800.000 en CLP")).toBeInTheDocument();
    await expect(canvas.getByText("el mismo número que en Hoy y Caja")).toBeInTheDocument();
    await expect(rojos(canvasElement)).toHaveLength(0);
  },
};
