import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DimensionValueMoveDialog } from "./dimension-value-move-dialog";
import type { DimensionValueTreeRow } from "./types";

/* Dialog mover valor (sin DnD, ADR-0009). open=true para verlo montado. */

function row(p: Partial<DimensionValueTreeRow> & { id: string }): DimensionValueTreeRow {
  return { name: p.id, code: "", description: "", level: 0, parentId: null, active: true, ...p };
}

const VALUE = row({ id: "n1", name: "Obra Antofagasta", code: "N-01", level: 1, parentId: "n" });
const TARGETS: DimensionValueTreeRow[] = [
  row({ id: "n", name: "Zona Norte", code: "N", level: 0 }),
  row({ id: "s", name: "Zona Sur", code: "S", level: 0 }),
  row({ id: "s1", name: "Obra Temuco", code: "S-01", level: 1, parentId: "s" }),
];

const meta = {
  title: "Capa 2 / Clasificación / DimensionValueMoveDialog",
  component: DimensionValueMoveDialog,
  parameters: { layout: "fullscreen" },
  args: { open: true, onOpenChange: fn(), value: VALUE, targets: TARGETS },
} satisfies Meta<typeof DimensionValueMoveDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mover: Story = { name: "Mover (padre actual pre-seleccionado)" };
export const SoloRaiz: Story = { name: "Solo raíz disponible", args: { targets: [] } };
