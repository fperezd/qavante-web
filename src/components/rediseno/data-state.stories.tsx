import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect, fn } from "storybook/test";
import { DataState } from "./data-state";

const meta = {
  title: "Rediseño / DataState",
  component: DataState,
  parameters: { layout: "padded" },
  args: { status: "empty", what: "documentos de venta" },
} satisfies Meta<typeof DataState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hay datos: el componente se hace a un lado y no dibuja nada propio. */
export const ConDatos: Story = {
  args: {
    status: "ready",
    what: "documentos de venta",
    children: (
      <div className="rounded-xl border border-rediseno-hairline bg-rediseno-superficie p-4 text-[13.5px] text-rediseno-tinta-2">
        412 documentos de venta en agosto 2026.
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("412 documentos de venta en agosto 2026.")).toBeVisible();
    // Sin panel de estado: cuando hay datos, el primitivo desaparece.
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};

/** Preguntamos y no había nada. El cero es verdad y se dice que lo es. */
export const SinDatos: Story = {
  args: {
    status: "empty",
    what: "documentos de venta en agosto",
    hint: "Cambia el período si esperabas ver documentos de otro mes.",
  },
};

/** No pudimos preguntar. Se dice la causa y qué hacer (Ley 8). */
export const NoPudimosSaber: Story = {
  args: {
    status: "error",
    what: "tus documentos de venta",
    cause:
      "El certificado digital del SII venció el 12 de agosto, así que no pudimos iniciar sesión para consultarlos.",
    action: { label: "Renovar certificado", href: "/administracion/credenciales" },
  },
};

/**
 * El corazón de U2: vacío-por-error y vacío-sin-datos NO pueden verse igual.
 * Si alguien vuelve a colapsar los dos estados en uno, este test se cae.
 */
export const ErrorNoSeConfundeConVacio: Story = {
  args: {
    status: "error",
    what: "tus documentos de venta",
    cause: "El certificado digital del SII venció el 12 de agosto.",
    action: { label: "Renovar certificado", href: "/administracion/credenciales" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Dice que NO pudo, no que no hay.
    await expect(canvas.getByText("No pudimos consultar tus documentos de venta")).toBeVisible();
    await expect(canvas.queryByText("No hay tus documentos de venta")).toBeNull();

    // La causa se muestra tal cual la declaró el backend.
    await expect(
      canvas.getByText("El certificado digital del SII venció el 12 de agosto."),
    ).toBeVisible();

    // Nunca afirma el cero que sí afirma el estado vacío.
    await expect(canvas.queryByText(/Este cero es real/)).toBeNull();

    // Y siempre ofrece qué hacer.
    const cta = canvas.getByRole("link", { name: "Renovar certificado" });
    await expect(cta).toHaveAttribute("href", "/administracion/credenciales");
  },
};

/** El vacío confirma que no hubo registros, sin convertir esa ausencia en un cero financiero. */
export const VacioAfirmaElCero: Story = {
  args: {
    status: "empty",
    what: "documentos de venta en agosto",
    hint: "Cambia el período si esperabas ver documentos de otro mes.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No hay documentos de venta en agosto")).toBeVisible();
    await expect(canvas.getByText(/Esto no confirma que el importe sea cero/)).toBeVisible();
    await expect(canvas.getByText(/Cambia el período/)).toBeVisible();
    // No hay lenguaje de falla en el estado vacío.
    await expect(canvas.queryByText(/No pudimos/)).toBeNull();
    await expect(canvas.queryByText(/está ciega/)).toBeNull();
  },
};

/**
 * `cause` es obligatoria en el tipo, pero el tipo no puede prohibir la cadena
 * vacía. Si llega vacía el panel lo dice en vez de quedarse mudo — quedarse
 * mudo acá sería repetir el bug exacto que U2 vino a arreglar.
 */
export const CausaVaciaNoQuedaMuda: Story = {
  args: { status: "error", what: "tus documentos de venta", cause: "  " },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No pudimos consultar tus documentos de venta")).toBeVisible();
    await expect(
      canvas.getByText(/No recibimos información suficiente sobre el problema/),
    ).toBeVisible();
  },
};

/** La acción también puede ser un callback (reintentar, resincronizar). */
export const AccionComoCallback: Story = {
  args: {
    status: "error",
    what: "tus movimientos del banco",
    cause: "La conexión con BICE no respondió a tiempo.",
    action: { label: "Reintentar", onClick: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reintentar" }));
    await expect(args.action?.onClick).toHaveBeenCalledOnce();
  },
};
