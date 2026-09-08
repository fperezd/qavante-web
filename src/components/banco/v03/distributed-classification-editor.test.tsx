import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DistributedClassificationEditor } from "./distributed-classification-editor";

describe("DistributedClassificationEditor", () => {
  it("parte simple, permite monto/%/híbrido y no muestra dimensiones no activadas", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rendered = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <DistributedClassificationEditor
          totalAmount={100_000}
          currency="CLP"
          accounts={[{ id: "00000000-0000-0000-0000-000000000001", label: "Administración" }]}
          events={[{ code: "payroll_payment", label: "Pago de remuneraciones" }]}
          dimensions={[]}
          onCancel={vi.fn()}
          onSave={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(rendered).toContain("Pago de remuneraciones");
    expect(rendered).toContain("Porcentaje");
    expect(rendered).toContain("Monto + porcentaje");
    expect(rendered).toContain("Agregar distribución");
    expect(rendered).not.toContain("Centro de costo");
  });
});
