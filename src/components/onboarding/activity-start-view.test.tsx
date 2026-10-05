import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "@/lib/api/errors";
import type {
  LegalEntityActivityStartItem,
  OnboardingActivityStartResponse,
} from "@/lib/api/onboarding-activity-start";
import { ActivityStartStepView } from "./activity-start-view";

/* La vista presentacional se renderiza sin router ni cliente de datos: recibe el censo por
   props. Las cifras son las medidas en producción el 2026-10-04. */

const noop = vi.fn();

function entidad(over: Partial<LegalEntityActivityStartItem> = {}): LegalEntityActivityStartItem {
  return {
    legal_entity_id: "a58a2ea8-0000-0000-0000-000000000001",
    legal_name: "Tooxs Digital SpA",
    effective_from: "2024-07-02",
    declared: false,
    provenance: "inherited_from_backfill",
    ...over,
  };
}

const CENSO: OnboardingActivityStartResponse = {
  entities: [entidad()],
  declared_count: 0,
  undeclared_count: 1,
  unattributed_history: {
    documents: 395,
    amount: "610236099.00",
    payables_documents: 220,
    payables_periods: 15,
    payables_amount: "175878842.00",
    receivables_documents: 175,
    receivables_periods: 12,
    receivables_amount: "434357257.00",
  },
  live_debt_protected: {
    payables_count: 93,
    payables_amount: "48200100.00",
    receivables_count: 41,
    receivables_amount: "12750000.00",
  },
  opening_cutoff_overlap: {
    active: true,
    cutoff_date: "2026-08-31",
    import_start_date: "2026-03-01",
    overlap_months: 5,
    detail: "prosa del productor",
  },
  summary: "prosa del productor",
};

function render(props: Partial<React.ComponentProps<typeof ActivityStartStepView>> = {}): string {
  return renderToStaticMarkup(
    <ActivityStartStepView
      census={CENSO}
      isLoading={false}
      loadError={null}
      onRetry={noop}
      drafts={{}}
      onDraftChange={noop}
      onDeclare={noop}
      savingId={null}
      saveErrorId={null}
      saveError={null}
      onContinue={noop}
      onSkip={noop}
      {...props}
    />,
  );
}

describe("el paso existe en el asistente, no es una pantalla suelta", () => {
  it("es un paso numerado con su propio título", () => {
    const html = render();
    expect(html).toContain("¿Desde cuándo existe cada sociedad?");
    expect(html).toContain("Paso 10 de 11");
    expect(html).toContain("Inicio de tus sociedades");
  });

  it("NO es el paso de la ventana de importación: nombra las dos y las separa", () => {
    /* El defecto de origen: los dos pasos estaban confundidos y Fernando mismo no
       distinguía uno de otro. */
    const html = render();
    expect(html).toContain("Fecha de inicio");
    expect(html).toContain("Mes desde el que leemos");
    expect(html).toContain("no tiene tope");
    expect(html).toContain("seis meses antes de tu registro");
  });
});

describe("una fecha heredada se VE distinta de una declarada", () => {
  it("la sociedad heredada trae su propio rótulo y el campo vacío", () => {
    const html = render();
    expect(html).toContain("La calculó una carga anterior");
    expect(html).not.toContain("Declarada por tu empresa");
    /* El campo nace vacío: nada se pre-llena desde la fecha heredada. */
    expect(html).toContain('type="date"');
    expect(html).not.toContain('value="2024-07-02"');
    expect(html).toContain("Declarar esta fecha");
  });

  it("la sociedad declarada trae su rótulo y su propia fecha en el campo", () => {
    const html = render({
      census: {
        ...CENSO,
        entities: [
          entidad({
            declared: true,
            provenance: "declared_by_company",
            effective_from: "2017-01-01",
          }),
        ],
        declared_count: 1,
        undeclared_count: 0,
      },
    });
    expect(html).toContain("Declarada por tu empresa");
    expect(html).toContain('value="2017-01-01"');
    expect(html).toContain("Actualizar la fecha");
  });

  it("la fecha que puso la plataforma dice que la sociedad figura existiendo desde 1970", () => {
    const html = render({
      census: {
        ...CENSO,
        entities: [entidad({ provenance: "platform_default", effective_from: "1970-01-01" })],
      },
    });
    expect(html).toContain("La puso Qavante por omisión");
    expect(html).toContain("1970");
  });
});

describe("la ausencia tiene su cifra, y la deuda viva va al lado", () => {
  it("lo que queda sin atribuir va con monto, documentos y períodos", () => {
    const html = render();
    expect(html).toContain("Historia sin atribuir");
    expect(html).toContain("$610.236.099");
    expect(html).toContain("220");
    expect(html).toContain("$175.878.842");
    expect(html).toContain("$434.357.257");
  });

  it("la deuda viva se rotula como lo que SIGUE contando, no como un pendiente", () => {
    const html = render();
    expect(html).toContain("SIGUE contando");
    expect(html).toContain("134 cuentas");
    expect(html).toContain("se exige hoy");
  });

  it("explica por qué se ven documentos saldados dentro del tramo pedido", () => {
    const html = render();
    expect(html).toContain("Por qué ves documentos saldados");
    expect(html).toContain("01-03-2026");
    expect(html).toContain("31-08-2026");
    expect(html).toContain("5 meses");
  });
});

describe("los estados de la pantalla", () => {
  it("mientras carga lo dice con un estado anunciado, sin afirmar cifras", () => {
    const html = render({ census: undefined, isLoading: true });
    expect(html).toContain('role="status"');
    expect(html).toContain("Reuniendo tus sociedades");
    expect(html).not.toContain("Historia sin atribuir");
  });

  it("el 409 del alcance se explica y deja reintentar", () => {
    const html = render({
      census: undefined,
      loadError: new ApiError("x", 409, "activity_start_census_scope"),
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain("todas las sociedades de tu empresa");
    expect(html).toContain("Reintentar");
  });

  it("el fallo de una declaración se muestra en SU fila, no en toda la pantalla", () => {
    const html = render({
      saveErrorId: CENSO.entities[0]!.legal_entity_id,
      saveError: new ApiError("x", 403),
    });
    expect(html).toContain("administrador");
  });

  it("se puede dejar para después, y nada bloquea el asistente", () => {
    const html = render();
    expect(html).toContain("Declararlas después");
    expect(html).toContain("Continuar");
  });
});
