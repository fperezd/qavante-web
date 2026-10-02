import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PayrollSystemCardView } from "./payroll-system-card";

const noop = vi.fn();

function render(props: Partial<React.ComponentProps<typeof PayrollSystemCardView>> = {}): string {
  return renderToStaticMarkup(
    <PayrollSystemCardView
      declared={false}
      selected=""
      onSelect={noop}
      monthInput="2026-10"
      onMonthInputChange={noop}
      onSave={noop}
      canSave={false}
      {...props}
    />,
  );
}

describe("PayrollSystemCardView", () => {
  it("ofrece las tres opciones exactas y ninguna más", () => {
    const html = render();
    expect(html).toContain("BUK");
    expect(html).toContain("Talana");
    expect(html).toContain("Sin sistema (carga manual)");
    expect(html).not.toContain("Previred");
    expect(html).not.toContain("Ninguno");
  });

  it("sin declaración pide elegir y NO presenta BUK como lo elegido", () => {
    const html = render({ declared: false, payrollSystem: null });
    expect(html).toContain("Todavía no elegiste tu sistema de remuneraciones");
    expect(html).not.toContain("Tu sistema de remuneraciones: BUK");
    /* Ninguna opción queda marcada como la actual: marcar BUK sería volver a suponer. */
    expect(html).not.toContain("Actual");
  });

  it("marca como actual la opción declarada", () => {
    const html = render({
      declared: true,
      payrollSystem: "manual",
      adapterState: "manual_upload",
      selected: "manual",
      effectiveFromPeriod: "202610",
    });
    expect(html).toContain("Tu sistema de remuneraciones: Sin sistema (carga manual)");
    expect(html).toContain("Actual");
    expect(html).toContain("octubre de 2026");
  });

  it("dice que el cambio no reescribe los meses anteriores", () => {
    expect(render()).toContain("conservan el sistema del que vinieron");
  });

  it("sin empresa activa explica que el sistema es por empresa, no de la cuenta", () => {
    const html = render({ scopeMissing: true });
    expect(html).toContain("Elige una empresa");
    expect(html).toContain("es de cada empresa, no de la cuenta");
    /* Y no ofrece un formulario que iba a fallar. */
    expect(html).not.toContain("¿Con qué sistema pagas tus sueldos?");
    expect(html).not.toContain("Guardar");
  });

  it("con varias empresas dice cuál se está configurando", () => {
    const html = render({ multipleCompanies: true, companyName: "Tooxs SpA" });
    expect(html).toContain("Estás configurando Tooxs SpA");
  });

  it("con una sola empresa no agrega ruido sobre cuál es", () => {
    const html = render({ multipleCompanies: false, companyName: "Tooxs SpA" });
    expect(html).not.toContain("Estás configurando");
  });

  it("sin permiso muestra el estado pero no el botón de guardar", () => {
    const html = render({ readOnly: true, declared: true, payrollSystem: "buk" });
    expect(html).toContain("Sólo quien administra la empresa");
    expect(html).not.toContain(">Guardar<");
    expect(html).toContain("disabled");
  });

  it("lista sólo las eras cerradas como historia (la vigente ya está arriba)", () => {
    const html = render({
      declared: true,
      payrollSystem: "manual",
      adapterState: "manual_upload",
      effectiveFromPeriod: "202610",
      history: [
        { payroll_system: "manual", label: "Carga manual", effective_from_period: "202610" },
        {
          payroll_system: "buk",
          label: "BUK",
          effective_from_period: "202601",
          effective_to_period: "202610",
        },
      ],
    });
    expect(html).toContain("Antes usabas");
    expect(html).toContain("BUK: desde enero de 2026 hasta octubre de 2026");
    expect(html).not.toContain("(vigente)");
  });

  it("sin historia cerrada no muestra la sección", () => {
    const html = render({
      declared: true,
      payrollSystem: "buk",
      adapterState: "active",
      history: [{ payroll_system: "buk", label: "BUK", effective_from_period: "202601" }],
    });
    expect(html).not.toContain("Antes usabas");
  });

  it("un error de carga no se disfraza de 'no elegiste'", () => {
    const html = render({ error: new Error("boom") });
    expect(html).not.toContain("Todavía no elegiste");
    expect(html).toContain("No pudimos cargar tu sistema de remuneraciones.");
  });
});
