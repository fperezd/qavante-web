import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect, fn } from "storybook/test";
import { Banner } from "./banner";

const meta = {
  title: "Rediseño / Banner",
  component: Banner,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <b>Tu proyección está incompleta:</b> 3 excepciones en la bandeja (~$2,1M en entradas) aún
        no cuentan.
      </>
    ),
    action: { label: "Resolver · ~4 min" },
  },
};

export const Warn: Story = {
  args: {
    variant: "warn",
    children: (
      <>
        <b>A este ritmo, agosto cierra ~$2,1M sobre el plan de gastos.</b> Te avisaré el día que la
        proyección cruce el límite · antes de que ocurra.
      </>
    ),
    action: { label: "Ajustar plan" },
  },
};

export const Ok: Story = {
  args: {
    variant: "ok",
    children: (
      <>
        <b>Si gastas como el mes pasado, necesitas vender $23.142.326 al mes.</b> En julio vendiste
        $39,9M: cubriste el piso con $16,8M de holgura.
      </>
    ),
    ghostAction: { label: "Ver el cálculo" },
  },
};

export const Dismissible: Story = {
  args: {
    children: "Recordatorio contextual: podés descartarlo sin que vuelva a aparecer.",
    dismissible: true,
    onDismiss: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dismiss = canvas.getByRole("button", { name: "Descartar" });
    await userEvent.click(dismiss);
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};

export const AccionEjecutaCallback: Story = {
  args: {
    children: "El botón primario siempre responde al click (Ley 6).",
    action: { label: "Aprobar y ejecutar", onClick: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cta = canvas.getByRole("button", { name: "Aprobar y ejecutar" });
    await userEvent.click(cta);
    await expect(args.action?.onClick).toHaveBeenCalledOnce();
  },
};
