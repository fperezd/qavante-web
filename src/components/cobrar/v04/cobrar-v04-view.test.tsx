import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { CobrarV04View } from "./cobrar-v04-view";
import {
  HOY,
  ar,
  arConcentracionAlta,
  arSinClientes,
  arTodoAlDia,
  arVencidoDesconocido,
  gestionado,
} from "./cobrar-v04-fixtures";

/* V04 · Cobrar — la vista, renderizada de verdad (react-dom/server, sin browser).
 *
 * Lo que se fija acá se fija sobre el HTML: la Ley 2 se CUENTA (elementos con token rojo), el
 * "no sé" se busca como texto y su gemelo positivo ("$0" del cero verificado) también. Las
 * interacciones (filtros, lote, cuenta regresiva) viven en las stories. */

function html(props: Partial<ComponentProps<typeof CobrarV04View>> = {}): string {
  return renderToStaticMarkup(
    <CobrarV04View
      ar={ar()}
      gestionado={gestionado()}
      hoy={HOY}
      onToggleGestionado={() => {}}
      {...props}
    />,
  );
}

function texto(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ley 2 — cuántos elementos llevan token rojo (ambos sistemas de tokens del repo). */
function rojos(h: string): number {
  return (h.match(/class="[^"]*(rediseno-rojo|danger-)[^"]*"/g) ?? []).length;
}

describe("CobrarV04View — crumb, tarjetas, banner, tabla y footer (caso normal)", () => {
  it("el crumb lleva el estado de gestión como chip GRIS (nunca verde)", () => {
    const h = html();
    expect(texto(h)).toContain("Cobrar · Gestionaste a 2 de 6 clientes · última hace 2 días");
    const chip = /<span[^>]*aria-label="Estado de gestión"[^>]*>/.exec(h)?.[0] ?? "";
    expect(chip).toContain("bg-rediseno-neutro-bg");
    expect(chip).not.toContain("rediseno-verde");
    // Gemelo: la clase verde SÍ existe en la página (la pill ok de "Al día"), así que el negativo
    // no pasa por vacío.
    expect(h).toMatch(/class="[^"]*rediseno-verde[^"]*"[^>]*>Al día</);
  });

  it("las cinco tarjetas con monto y % del total; Vencido · bruto con su ⓘ", () => {
    const t = texto(html());
    expect(t).toContain("Vigente $14.800.000 34,8% del total");
    expect(t).toContain("1–30 días $9.400.000 22,1% del total");
    expect(t).toContain("31–60 días $8.900.000 20,9% del total");
    expect(t).toContain("+61 días $9.479.467 22,3% del total");
    expect(t).toContain("Vencido · bruto $27.779.467 65,2% del total");
    expect(t).toContain(
      "Vencido (bruto) es la parte del por cobrar cuya fecha de vencimiento ya pasó",
    );
  });

  it("Ley 1: Vencido es `overdue` del contrato, aunque los tramos sumen otra cosa", () => {
    const t = texto(html({ ar: ar({ overdue: "27000000", overdue_pct: "63.4" }) }));
    expect(t).toContain("Vencido · bruto $27.000.000 63,4% del total");
    expect(t).not.toContain("$27.779.467");
    expect(texto(html())).toContain("$27.779.467"); // gemelo: el número existe cuando el contrato lo trae
  });

  it("banner: 3 clientes concentran EXACTAMENTE la suma de los 3 mayores del vencido, con CTA", () => {
    const t = texto(html());
    expect(t).toContain("3 clientes concentran $12.294.967 del vencido.");
    expect(t).toContain("Un recordatorio a cada uno cubre el 44,3% de tu deuda vencida.");
    expect(t).toContain("Enviar a los 3");
    expect(t).not.toContain("$14.087.408"); // con el 4º
  });

  it("tabla: nombre completo, `.sub` con vencido + días + gestión, pill, saldo y las acciones actuales", () => {
    const h = html();
    const t = texto(h);
    expect(t).toContain("Empresa de Correos de Chile"); // el nombre largo, entero
    expect(t).toContain("vencido $3.300.000 hace 73 días · gestionado 28 ago · 27,2% del total");
    expect(t).toContain("vencido $1.792.441 hace 80 días · sin gestión registrada");
    expect(t).toContain("vencido: no se sabe · sin gestión registrada");
    expect(t).toContain("$11.582.539");
    expect(t).toContain("Sin vencimiento conocido");
    expect(t).toContain("Al día");
    expect((h.match(/href="https:\/\/wa\.me\/\?text=/g) ?? []).length).toBe(6);
    expect((h.match(/href="mailto:\?subject=Cobranza%20pendiente/g) ?? []).length).toBe(6);
    expect((t.match(/Recordatorio/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(t).toContain("Reabrir"); // Diveimport y Kaufmann ya gestionados
    expect(t).toContain("Gestionado");
  });

  it("filtros con conteo: Prioridad · 6, Vencido · 4, +60 días · 2, Sin vencimiento conocido · 1, Al día · 1", () => {
    const t = texto(html());
    expect(t).toContain("Prioridad · 6");
    expect(t).toContain("Vencido · 4");
    expect(t).toContain("+60 días · 2");
    expect(t).toContain("Sin vencimiento conocido · 1");
    expect(t).toContain("Al día · 1");
  });

  it("footer: N clientes con saldo · Exportar · total por cobrar (bruto) = `total` del contrato, con su ⓘ (mutante e)", () => {
    const t = texto(html());
    expect(t).toContain("6 clientes con saldo");
    expect(t).toContain("Exportar");
    expect(t).toContain("total por cobrar (bruto) $42.579.467");
    expect(t).toContain("¿por qué “bruto”?");
    expect(t).toContain("Lo que marcaste cobrado a mano en Clientes");
    // Gemelo: la suma de los saldos de la tabla NO es el total y no se publica como tal.
    expect(t).not.toContain("$24.399.988");
  });

  it("el lote real declara identidad trazable y no promete éxito cuando falta destinatario", () => {
    const t = texto(html());
    expect(t).toContain("El envío se confirma documento por documento");
    expect(t).toContain("documentos identificados por el registro");
    expect(t).toContain("no se confirma como enviado");
  });
});

describe("CobrarV04View — el vencido desconocido (`overdue: null`, el caso VIVO)", () => {
  it("NUNCA $0 ni 0% vencido: cinco tarjetas 'sin dato' con el motivo; el cero verificado sí se muestra", () => {
    const h = html({ ar: arVencidoDesconocido(), gestionado: {} });
    const t = texto(h);
    expect((t.match(/sin dato/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(t).toContain("$42.579.467 de tu saldo por cobrar no tiene fecha de vencimiento");
    expect(t).not.toContain("$0");
    expect(t).not.toContain("0%");
    expect(h).not.toMatch(/>Al día</); // ninguna pill "Al día" (el chip "Al día · 0" es otra cosa)
    // Gemelo positivo: con todo al día, "$0" y "0% del total" SON la verdad y se ven.
    const hAlDia = html({ ar: arTodoAlDia(), gestionado: {} });
    const alDia = texto(hAlDia);
    expect(alDia).toContain("Vencido · bruto $0 0% del total");
    expect(alDia).toContain("· estás al día");
    expect(alDia).toContain("+61 días $0 0% del total");
    expect(hAlDia).toMatch(/>Al día</);
  });

  it("concentra por SALDO y lo dice; las pills son grises; ningún rojo", () => {
    const h = html({ ar: arVencidoDesconocido(), gestionado: {} });
    const t = texto(h);
    expect(t).toContain("3 clientes concentran $20.577.506 de tu saldo por cobrar (48,3%).");
    expect(t).toContain("No sabemos cuánto de eso está vencido");
    expect((t.match(/Sin vencimiento conocido/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(t).toContain("vencido: no se sabe");
    expect(t).toContain("Sin vencimiento conocido · 5");
    expect(rojos(h)).toBe(0);
  });
});

describe("CobrarV04View — Ley 2: máximo un rojo por pantalla", () => {
  it("caso normal: EXACTAMENTE un rojo, la pill del cliente más grave (80 días); el de 73 va en ámbar", () => {
    const h = html();
    expect(rojos(h)).toBe(1);
    expect(h).toMatch(/class="[^"]*rediseno-rojo[^"]*"[^>]*>80 días</);
    expect(h).toMatch(/class="[^"]*rediseno-ambar[^"]*"[^>]*>73 días</);
    expect(h).toMatch(/class="[^"]*rediseno-ambar[^"]*"[^>]*>34 días</); // mutante c: no es rojo
  });

  it("concentración alta con dos clientes por sobre los 60 días: sigue siendo UN rojo", () => {
    const h = html({ ar: arConcentracionAlta(), gestionado: {} });
    expect(rojos(h)).toBe(1);
    expect(h).toMatch(/class="[^"]*rediseno-rojo[^"]*"[^>]*>121 días</);
    expect(h).toMatch(/class="[^"]*rediseno-ambar[^"]*"[^>]*>66 días</);
    expect(texto(h)).toContain("3 clientes concentran $18.500.000 del vencido.");
    expect(texto(h)).toContain("92,5%");
  });

  it("todo al día: ningún rojo, ningún banner, pills 'Al día'", () => {
    const h = html({ ar: arTodoAlDia(), gestionado: {} });
    expect(rojos(h)).toBe(0);
    expect(h).not.toContain('role="note"');
    expect((texto(h).match(/Al día/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Gemelo positivo: la misma query cuenta 1 en el caso normal.
    expect(rojos(html())).toBe(1);
  });

  it("nadie por sobre los 60 días: ningún rojo aunque haya vencidos", () => {
    const suave = ar({
      overdue_documents: ar().overdue_documents!.map((d) => ({
        ...d,
        days_overdue: Math.min(d.days_overdue, 45),
      })),
    });
    expect(rojos(html({ ar: suave }))).toBe(0);
  });
});

describe("CobrarV04View — Ley 7 / §5.2: en angosto colapsa el metadato, nunca el dato primario", () => {
  /* La medida en píxeles vive en la story `Angosto360` (Chromium, contenedor de 360 px). Acá se
     fija lo ESTRUCTURAL de lo que esa medida depende: qué columna declara el colapso y cuáles no
     lo declaran jamás. Sin esto, borrar el `hideBelow` sólo rompería la story.

     Sin regex: partir el HTML por etiquetas es más simple de leer y no tiene cómo fallar en
     silencio (un `[\s\S]` mal escapado casa cualquier cosa y el negativo pasa por vacío). */
  const COLAPSA = "@max-[640px]:hidden";

  /** Los `<th…>…</th>` de la tabla, cada uno como su HTML completo. */
  function encabezados(h: string): string[] {
    return h
      .split("<th")
      .slice(1)
      .map((x) => "<th" + x.split("</th>")[0]!);
  }

  it("Antigüedad (metadato) declara el colapso por ancho de la tabla", () => {
    const th = encabezados(html()).find((x) => x.includes("Antigüedad"));
    expect(th).toBeDefined(); // el positivo: la columna existe y se encontró
    expect(th).toContain(COLAPSA);
  });

  it("Cliente y Saldo NO colapsan nunca (el dato primario y el monto)", () => {
    const h = html();
    const ths = encabezados(h);
    const cliente = ths.find((x) => x.includes("Cliente"));
    const saldo = ths.find((x) => x.includes("Saldo"));
    expect(cliente).toBeDefined();
    expect(saldo).toBeDefined();
    expect(cliente).not.toContain(COLAPSA);
    expect(saldo).not.toContain(COLAPSA);
    // Gemelo positivo de los dos negativos: la clase SÍ existe en la tabla (en Antigüedad).
    expect(ths.filter((x) => x.includes(COLAPSA))).toHaveLength(1);
  });

  it("el nombre va entero y sin truncar; el metadato trunca con tooltip", () => {
    const h = html();
    expect(h).toContain(
      '<div class="font-semibold text-rediseno-tinta">Empresa de Correos de Chile</div>',
    );
    const sub = h.split("<td").find((x) => x.includes("Empresa de Correos de Chile"))!;
    expect(sub).toContain("truncate");
    expect(sub).toContain('title="vencido $4.672.594');
  });
});

describe("CobrarV04View — estados que hablan (§5.4, Ley 8)", () => {
  it("sin cartera: dice qué falta y ofrece qué hacer", () => {
    const h = html({ ar: arSinClientes(), gestionado: {} });
    const t = texto(h);
    expect(t).toContain("No hay clientes con saldo por cobrar");
    expect(t).toContain("Falta: Conectar SII.");
    expect(h).toContain('href="/conexiones"');
    expect(t).not.toContain("Vencido · bruto");
  });

  it("sin respuesta: no está vacía, está ciega — con la causa y Reintentar", () => {
    const t = texto(
      html({
        ar: null,
        arMotivo: "El registro de cobranza no respondió (error de red).",
        onReintentar: () => {},
      }),
    );
    expect(t).toContain("No pudimos consultar las cuentas por cobrar");
    expect(t).toContain("El registro de cobranza no respondió (error de red).");
    expect(t).toContain("Reintentar");
  });
});
