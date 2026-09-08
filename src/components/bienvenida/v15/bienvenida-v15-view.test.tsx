import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { OnboardingSyncRun } from "@/lib/api/onboarding-sync-runs";
import { BienvenidaV15View } from "./bienvenida-v15-view";
import { AMBAS_CONECTADAS } from "./bienvenida-v15-fixtures";

const run: OnboardingSyncRun = {
  run_id: "00000000-0000-0000-0000-000000000001",
  status: "running",
  updated_at: "2026-09-02T12:00:00Z",
  sources: [
    {
      source: "sii",
      status: "running",
      step: "normalizing_documents",
      records_read: 4,
      eta_seconds: null,
      updated_at: "2026-09-02T12:00:00Z",
    },
    {
      source: "bank",
      status: "queued",
      step: null,
      records_read: null,
      eta_seconds: 60,
      updated_at: "2026-09-02T12:00:00Z",
    },
  ],
};

function text(runValue: OnboardingSyncRun | null = run) {
  return renderToStaticMarkup(<BienvenidaV15View states={AMBAS_CONECTADAS} run={runValue} />)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

describe("BienvenidaV15View", () => {
  it("muestra los hechos del run y no convierte null en cero", () => {
    const rendered = text();
    expect(rendered).toContain("4 documentos leídos");
    expect(rendered).toContain("Sin tiempo estimado disponible.");
    expect(rendered).toContain("Sincronización · En curso");
    expect(rendered).toContain("Ordenando documentos");
    expect(rendered).not.toContain("normalizing_documents");
    expect(rendered).not.toContain("0 documentos leídos");
  });

  it("no promete una entrega horaria sin scheduler", () => {
    const rendered = text(null);
    expect(rendered).toContain("No prometemos una hora de entrega");
    expect(rendered).not.toMatch(/mañana a las 7/i);
  });

  it("durante el POST no deja un segundo comando y si falla ofrece reintento", () => {
    const starting = renderToStaticMarkup(
      <BienvenidaV15View states={AMBAS_CONECTADAS} cargandoRun onIniciarRun={() => {}} />,
    );
    expect(starting).toContain("Iniciando la sincronización.");
    expect(starting).not.toContain("Iniciar sincronización</button>");

    const failed = renderToStaticMarkup(
      <BienvenidaV15View
        states={AMBAS_CONECTADAS}
        errorInicioRun="No pudimos iniciar la sincronización. Vuelve a intentar en un momento."
        onIniciarRun={() => {}}
      />,
    );
    expect(failed).toContain("No pudimos iniciar la sincronización.");
    expect(failed).toContain("Reintentar");
  });

  it("muestra disponibilidad sólo cuando el run terminó", () => {
    const completed = { ...run, status: "completed" as const };
    const rendered = text(completed);
    expect(rendered).toContain("Tu primer parte ya está disponible.");

    const failed = text({ ...run, status: "failed" as const });
    expect(failed).toContain("Tu primer parte aún no está disponible.");
    expect(failed).toContain("La sincronización no terminó.");
  });

  it("muestra el error exacto si falla el reintento de un run terminal", () => {
    const errorMutante = "Sólo owner/admin · intento terminal 403";
    const rendered = renderToStaticMarkup(
      <BienvenidaV15View
        states={AMBAS_CONECTADAS}
        run={{ ...run, status: "failed" }}
        errorInicioRun={errorMutante}
        onIniciarRun={() => {}}
      />,
    );

    expect(rendered).toContain(errorMutante);
    expect(rendered).toContain("el inicio de otra sincronización");
    expect(rendered).toContain("Reintentar");
  });

  it("conserva el gemelo exitoso del reintento terminal", () => {
    const rendered = renderToStaticMarkup(
      <BienvenidaV15View
        states={AMBAS_CONECTADAS}
        run={{ ...run, status: "failed" }}
        onIniciarRun={() => {}}
      />,
    );

    expect(rendered).toContain("Iniciar otra sincronización");
    expect(rendered).not.toContain("el inicio de otra sincronización");
  });

  it("trata errorInicioRun null como ausencia en un run terminal", () => {
    const rendered = renderToStaticMarkup(
      <BienvenidaV15View
        states={AMBAS_CONECTADAS}
        run={{ ...run, status: "failed" }}
        errorInicioRun={null}
        onIniciarRun={() => {}}
      />,
    );

    expect(rendered).toContain("Iniciar otra sincronización");
    expect(rendered).not.toContain("el inicio de otra sincronización");
  });
});
