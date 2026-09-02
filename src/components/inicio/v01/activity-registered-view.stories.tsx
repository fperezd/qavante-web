import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActivityRegisteredView } from "./activity-registered-view";

const meta = { title: "Inicio/V01/Actividad registrada", component: ActivityRegisteredView } satisfies Meta<typeof ActivityRegisteredView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FuentesRegistradas: Story = {
  args: { activities: [
    { id: "reversible_action:1", fuente: "reversible_action", etiquetaFuente: "Automatismo reversible", tipo: "bank_movement.auto_classify", resumen: "Qavante clasificó movimientos.", creadaEn: "2026-09-02T12:00:00Z", resultado: null },
    { id: "audit_event:1", fuente: "audit_event", etiquetaFuente: "Evento auditado", tipo: "collection.plan_created", resumen: "Se registró un cambio auditado.", creadaEn: "2026-09-02T11:00:00Z", resultado: null },
    { id: "sync_run:1", fuente: "sync_run", etiquetaFuente: "Sincronización registrada", tipo: "sii.sync", resumen: "Se registró una sincronización.", creadaEn: "2026-09-02T10:00:00Z", resultado: "completed" },
  ] },
};
export const SinHechosRegistrados: Story = { args: { activities: [] } };
export const ErrorHonesto: Story = { args: { activities: null, error: true, onRetry: () => {} } };
