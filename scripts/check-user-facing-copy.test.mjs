import { describe, expect, it } from "vitest";
import { FILE_ALLOWLIST, RAW_ACCESS_RULES, inspectSource } from "./check-user-facing-copy.mjs";

describe("check-user-facing-copy", () => {
  it("detecta referencias internas y ETA estática en copy renderizado", () => {
    const source = `
      // issue #999 y backend en comentario: no cuenta
      export function View() {
        return <><p>Sucesor #90</p><div aria-label="Carga (~5 s)" /></>;
      }
    `;
    expect(inspectSource(source).map(({ rule }) => rule)).toEqual([
      "referencia a sucesor",
      "identificador interno",
      "ETA estática",
    ]);
  });

  it("ignora strings técnicas que no llegan a una superficie de UI", () => {
    expect(inspectSource(`const endpoint = "/api/internal"; // piloto`)).toEqual([]);
  });

  it("detecta copy visible en fallback, objeto reason y función de mensaje", () => {
    const source = `
      const motivo = ok ? null : "El backend no respondió";
      const state = { reason: value ?? "Falta el endpoint" };
      function errMsg() { return "El backend rechazó la operación"; }
    `;
    expect(inspectSource(source).map(({ rule }) => rule)).toEqual([
      "referencia técnica",
      "referencia técnica",
      "referencia técnica",
    ]);
  });

  it("detecta nombres con sufijo de mensaje, detalle o razón", () => {
    const source = `
      const authMsg = "El backend no respondió";
      const sourceMessage = "Falta el endpoint";
      const avisoMensaje = "Issue #321";
      const responseDetail = "En preparación";
      const failureReason = "Piloto interno";
    `;
    expect(inspectSource(source).map(({ rule }) => rule)).toEqual([
      "referencia técnica",
      "referencia técnica",
      "referencia técnica",
      "identificador interno",
      "nota de implementación",
      "referencia a piloto",
    ]);
  });

  it("detecta copy prohibido devuelto por arrow y function expression", () => {
    const source = `
      const authMessage = () => "El backend no respondió";
      const responseDetail = function () { return "Falta el endpoint"; };
    `;
    expect(inspectSource(source).map(({ rule }) => rule)).toEqual([
      "referencia técnica",
      "referencia técnica",
    ]);
  });

  it("sigue el alias antes de bloquear detail crudo", () => {
    const file = "src/components/cobrar/v04/cobrar-v04-view.tsx";
    const source = `
      const row = item;
      export function View() { return <p>{row.detail}</p>; }
    `;
    expect(inspectSource(source, file)).toContainEqual(
      expect.objectContaining({ rule: "campo dinámico crudo", text: "item.detail" }),
    );
  });

  it("sigue destructuring antes de bloquear reason crudo", () => {
    const file = "src/components/inicio/v01/cash-gap-proposal-panel.tsx";
    const source = `
      const { reason } = target;
      export function View() { return <p>{reason}</p>; }
    `;
    expect(inspectSource(source, file)).toContainEqual(
      expect.objectContaining({ rule: "campo dinámico crudo", text: "target.reason" }),
    );
  });

  it("sigue un campo guardado dentro de un objeto alias", () => {
    const file = "src/components/inicio/v01/cash-gap-proposal-panel.tsx";
    const source = `
      const view = { reason: target.reason };
      export function View() { return <p>{view.reason}</p>; }
    `;
    expect(inspectSource(source, file)).toContainEqual(
      expect.objectContaining({ rule: "campo dinámico crudo", text: "target.reason" }),
    );
  });

  it("sigue destructuring por asignación", () => {
    const file = "src/components/inicio/v01/cash-gap-proposal-panel.tsx";
    const source = `
      let reason;
      ({ reason } = target);
      export function View() { return <p>{reason}</p>; }
    `;
    expect(inspectSource(source, file)).toContainEqual(
      expect.objectContaining({ rule: "campo dinámico crudo", text: "target.reason" }),
    );
  });

  it("sigue parámetros de componente alimentados mediante spread", () => {
    const file = "src/components/inicio/v01/cash-gap-proposal-panel.tsx";
    const source = `
      function TargetRow({ reason }) { return <p>{reason}</p>; }
      export function View() { return <TargetRow {...target} />; }
    `;
    expect(inspectSource(source, file)).toContainEqual(
      expect.objectContaining({ rule: "campo dinámico crudo", text: "target.reason" }),
    );
  });

  it("sigue spread de objeto sin acusar un override seguro", () => {
    const file = "src/components/cobrar/v04/cobrar-v04-view.tsx";
    const leaked = `
      const row = { ...item };
      export function View() { return <p>{row.detail}</p>; }
    `;
    const safe = `
      const row = { ...item, detail: safeCopy };
      export function View() { return <p>{row.detail}</p>; }
    `;
    expect(inspectSource(leaked, file)).toContainEqual(
      expect.objectContaining({ rule: "campo dinámico crudo", text: "item.detail" }),
    );
    expect(inspectSource(safe, file)).toEqual([]);
  });

  it("respeta el orden de overrides y múltiples spreads de objeto", () => {
    const file = "src/components/cobrar/v04/cobrar-v04-view.tsx";
    const finding = expect.objectContaining({
      rule: "campo dinámico crudo",
      text: "item.detail",
    });
    const unsafeSources = [
      `const row = { detail: safeCopy, ...item };
       export function View() { return <p>{row.detail}</p>; }`,
      `const row = { ...safeCopy, ...item };
       export function View() { return <p>{row.detail}</p>; }`,
      `const row = { ...safeCopy, detail: otherSafe, ...item };
       export function View() { return <p>{row.detail}</p>; }`,
      `const row = { nested: { detail: safeCopy, ...item } };
       export function View() { return <p>{row.nested.detail}</p>; }`,
    ];
    for (const source of unsafeSources) {
      expect(inspectSource(source, file)).toContainEqual(finding);
    }

    const safeSources = [
      `const row = { ...item, detail: safeCopy };
       export function View() { return <p>{row.detail}</p>; }`,
      `const row = { ...item, ...safeCopy };
       export function View() { return <p>{row.detail}</p>; }`,
      `const row = { ...item, ...otherSafe, detail: safeCopy };
       export function View() { return <p>{row.detail}</p>; }`,
      `const row = { nested: { ...item, detail: safeCopy } };
       export function View() { return <p>{row.nested.detail}</p>; }`,
    ];
    for (const source of safeSources) {
      expect(inspectSource(source, file)).toEqual([]);
    }
  });

  it("respeta el orden de props explícitas y spreads JSX", () => {
    const file = "src/components/cobrar/v04/cobrar-v04-view.tsx";
    const finding = expect.objectContaining({
      rule: "campo dinámico crudo",
      text: "item.detail",
    });
    const render = (attributes) => `
      function Row({ detail }) { return <p>{detail}</p>; }
      export function View() { return <Row ${attributes} />; }
    `;

    expect(inspectSource(render("detail={safeCopy} {...item}"), file)).toContainEqual(finding);
    expect(inspectSource(render("{...safeCopy} {...item}"), file)).toContainEqual(finding);
    expect(
      inspectSource(render("{...safeCopy} detail={otherSafe} {...item}"), file),
    ).toContainEqual(finding);
    expect(inspectSource(render("{...{ detail: safeCopy, ...item }}"), file)).toContainEqual(
      finding,
    );

    expect(inspectSource(render("{...item} detail={safeCopy}"), file)).toEqual([]);
    expect(inspectSource(render("{...item} {...safeCopy}"), file)).toEqual([]);
    expect(inspectSource(render("{...item} {...otherSafe} detail={safeCopy}"), file)).toEqual([]);
    expect(inspectSource(render("{...{ ...item, detail: safeCopy }}"), file)).toEqual([]);
  });

  it("detecta acceso computed y conserva aliases legítimos", () => {
    const file = "src/components/inicio/v01/cash-gap-proposal-panel.tsx";
    expect(inspectSource(`const leaked = target["reason"];`, file)).toContainEqual(
      expect.objectContaining({ rule: "campo dinámico crudo", text: "target.reason" }),
    );
    expect(
      inspectSource(
        `
          const row = safeCopy;
          const fetchData = () => "backend interno no visible";
          export function View() { return <p>{row.message}</p>; }
        `,
        file,
      ),
    ).toEqual([]);
  });

  it("bloquea los accesos crudos de las fronteras auditadas", () => {
    for (const [file, accesses] of RAW_ACCESS_RULES) {
      for (const access of accesses) {
        expect(inspectSource(`const leaked = ${access};`, file)).toContainEqual(
          expect.objectContaining({ rule: "campo dinámico crudo", text: access }),
        );
      }
    }
  });

  it("documenta las excepciones de boundary", () => {
    expect([...FILE_ALLOWLIST.values()]).toEqual([
      "D06 Cliente 360 está fuera del boundary D16-A.",
      "Caja y cash-projection están fuera del boundary D16-A.",
    ]);
  });
});
