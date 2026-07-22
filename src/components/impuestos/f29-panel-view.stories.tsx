import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { F29PanelView } from "./f29-panel-view";

/* Panel F29 — grilla meses × años (estilo SII) + detalle del mes con/sin IVA. */

const estado = http.get("*/api/sii/f29/estado", ({ request }) => {
  const anio = Number(new URL(request.url).searchParams.get("anio")) || 2026;
  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    let e = "declarado";
    if (anio === 2026 && mes > 5) e = "sin_periodo";
    else if (anio === 2026 && mes === 5) e = "en_curso";
    else if (anio === 2026 && mes === 4) e = "por_declarar";
    else if (anio === 2026 && mes === 3) e = "no_declarado_vencido";
    else if (anio < 2024) e = "sin_dato";
    const declarado = e === "declarado";
    // Enero 2026: declarado pero con el IVA postergado → verde + (i) con el vencimiento diferido.
    const postergado = declarado && anio === 2026 && mes === 1;
    return {
      mes,
      periodo: `${anio}-${String(mes).padStart(2, "0")}`,
      estado: e,
      declarado,
      folio: declarado ? 6000 + mes : null,
      saldo: declarado ? mes * 10000 : null,
      remanente: declarado ? 0 : null,
      vencimiento: `${anio}-${String(mes).padStart(2, "0")}-12`,
      postergado_iva: postergado,
      vencimiento_postergado: postergado ? `${anio}-03-20` : null,
    };
  });
  return HttpResponse.json({ status: "ok", anio, meses, count: 12 });
});

const impuesto = http.get("*/api/sii/f29/impuesto", ({ request }) => {
  const manual = new URL(request.url).searchParams.get("impuesto_trabajadores");
  const imp = manual != null ? Number(manual) : 0;
  return HttpResponse.json({
    status: "ok",
    periodo: "2026-04",
    declarado: true,
    folio: 6123,
    iva_debito: 1_200_000,
    iva_credito: 800_000,
    remanente: 0,
    ppm: 150_000,
    impuesto_trabajadores: imp,
    fuente_impuesto_trabajadores: manual != null ? "manual" : "no_disponible",
    iva_determinado: 400_000,
    iva_postergable: 400_000,
    total_con_iva: 400_000 + 150_000 + imp,
    total_sin_iva: 150_000 + imp,
  });
});

const meta = {
  title: "Capa 2 / Impuestos / F29PanelView",
  component: F29PanelView,
  parameters: { layout: "padded", msw: { handlers: [estado, impuesto] } },
  args: { now: new Date("2026-05-15T12:00:00Z") },
} satisfies Meta<typeof F29PanelView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {};
