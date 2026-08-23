import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, userEvent, expect, fn, waitFor, waitForElementToBeRemoved } from "storybook/test";
import { RedisenoToastProvider, useRedisenoToast } from "./toast";

function Demo({ onUndo, durationMs }: { onUndo?: () => void; durationMs?: number }) {
  const { show } = useRedisenoToast();
  return (
    <button
      type="button"
      className="rounded-full bg-rediseno-tinta px-4 py-2 text-sm font-bold text-white"
      onClick={() =>
        show({
          message: (
            <>
              Clasificaste <b>Dattatec.com</b> como Software y tecnología
            </>
          ),
          action: onUndo ? { label: "Deshacer", onClick: onUndo } : undefined,
          durationMs,
        })
      }
    >
      Clasificar
    </button>
  );
}

const meta = {
  title: "Rediseño / Toast",
  parameters: { layout: "padded" },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RedisenoToastProvider>
      <Demo />
    </RedisenoToastProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clasificar" }));
    await expect(canvas.getByRole("status")).toBeVisible();
    await expect(canvas.getByText("Software y tecnología", { exact: false })).toBeVisible();
  },
};

/** Click en "Deshacer" dispara el callback Y cierra el toast (Ley 5/6). */
export const ConDeshacer: Story = {
  render: () => {
    const onUndo = fn();
    return (
      <RedisenoToastProvider>
        <Demo onUndo={onUndo} />
      </RedisenoToastProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clasificar" }));

    const undo = canvas.getByRole("button", { name: "Deshacer" });
    await userEvent.click(undo);

    await waitFor(() => expect(canvas.queryByRole("status")).not.toBeInTheDocument());
  },
};

/** Auto-dismiss real a los N ms (Ley 6) — sin fake timers, duración corta para el test. */
export const AutoDismiss: Story = {
  render: () => (
    <RedisenoToastProvider>
      <Demo durationMs={400} />
    </RedisenoToastProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clasificar" }));

    const status = canvas.getByRole("status");
    await expect(status).toBeVisible();
    await waitForElementToBeRemoved(status, { timeout: 2000 });
  },
};

/** Cerrar manualmente antes del auto-dismiss también funciona. */
export const CierreManual: Story = {
  render: () => (
    <RedisenoToastProvider>
      <Demo />
    </RedisenoToastProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clasificar" }));

    const close = canvas.getByRole("button", { name: "Cerrar notificación" });
    await userEvent.click(close);

    await waitFor(() => expect(canvas.queryByRole("status")).not.toBeInTheDocument());
  },
};
