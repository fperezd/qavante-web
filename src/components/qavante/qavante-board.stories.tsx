import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteBoard } from "./qavante-board";
import type { BoardState } from "./board-state";

type Task = { id: string; title: string; owner: string };

const initial: BoardState<Task> = [
  {
    id: "todo",
    title: "Por hacer",
    items: [
      { id: "t1", title: "Diseñar onboarding", owner: "Ana" },
      { id: "t2", title: "Revisar contratos", owner: "Luis" },
    ],
  },
  {
    id: "doing",
    title: "En curso",
    items: [{ id: "t3", title: "Integrar API de pagos", owner: "Sofía" }],
  },
  { id: "done", title: "Listo", items: [{ id: "t4", title: "Setup de CI", owner: "Marco" }] },
];

/* Wrapper con estado: el Board es controlado. */
function BoardDemo() {
  const [columns, setColumns] = React.useState(initial);
  return (
    <QavanteBoard
      columns={columns}
      onColumnsChange={setColumns}
      renderCard={(t) => (
        <div>
          <p className="text-sm font-medium text-neutral-dark">{t.title}</p>
          <p className="text-xs text-neutral-mid">{t.owner}</p>
        </div>
      )}
    />
  );
}

const meta = {
  title: "Capa 1 / QavanteBoard",
  component: QavanteBoard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tablero tipo Kanban con drag & drop entre columnas (dnd-kit). Controlado: recibe `columns` y notifica `onColumnsChange`. La lógica de movimiento vive en board-state.ts (testeada). Accesible por teclado.",
      },
    },
  },
  args: {
    columns: initial,
    onColumnsChange: () => {},
    renderCard: () => null,
  },
} satisfies Meta<typeof QavanteBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Kanban: Story = {
  render: () => <BoardDemo />,
};
