import { describe, it, expect } from "vitest";
import {
  buildMaestro,
  readPagados,
  readTerminos,
  totalesMaestro,
  PAGADOS_KEY,
  type ConciliacionMap,
  type DocConVencimiento,
} from "./terminos-pago";
import { DESTINO_CONCILIACION, nombreDestino } from "./conciliacion-destino";
import { COMMANDS } from "@/components/shell/command-palette-commands";

/* Decisión del dueño (2026-10-04) sobre el maestro de Términos:
 *   1. un documento conciliado de verdad NO aparece;
 *   2. uno al que le falta conciliar SÍ aparece, y desde ahí se llega a la pantalla donde se
 *      concilia contra un movimiento bancario;
 *   3. se va el botón "Marcar conciliado" (y no se reemplaza por "declarar pagado").
 *
 * "Conciliado de verdad" NO lo decide el front: lo decide el motor
 * (`POST /api/treasury/reconciliation/document-resolution/statuses`), que marca `reconciled`
 * sólo cuando el documento tiene un movimiento bancario asignado y saldo 0. Acá se prueba el
 * cableado puro: qué entra y qué sale de la lista según ese estado. */

const HOY = new Date(2026, 6, 20);
const T = readTerminos(undefined);

/** Kaufmann: folio 1 vencida ($5M) + folio 2 vigente ($3M). Diveimport: folio 3 ($1M). */
const docs: DocConVencimiento[] = [
  {
    rut: "96572360-9",
    name: "COMERCIAL KAUFMANN S.A.",
    fecha: "01/06/2026",
    monto: 5_000_000,
    folio: 1,
    tipoDoc: 33,
    sourceExternalId: "33-1-96572360-9",
  },
  {
    rut: "96572360-9",
    name: "COMERCIAL KAUFMANN S.A.",
    fecha: "01/07/2026",
    monto: 3_000_000,
    folio: 2,
    tipoDoc: 33,
    sourceExternalId: "33-2-96572360-9",
  },
  {
    rut: "77111222-3",
    name: "DIVEIMPORT S.A.",
    fecha: "01/06/2026",
    monto: 1_000_000,
    folio: 3,
    tipoDoc: 33,
    sourceExternalId: "33-3-77111222-3",
  },
];

/** Folios visibles, ordenados (el orden de la grilla se prueba en las stories). */
const folios = (cps: ReturnType<typeof buildMaestro>) =>
  cps.flatMap((c) => c.docs.map((d) => Number(d.folio))).sort((a, b) => a - b);

describe("requisito 1 — un documento conciliado de verdad no aparece", () => {
  it("el documento `reconciled` sale de la lista y su plata sale del saldo", () => {
    const conciliacion: ConciliacionMap = { "33-1-96572360-9": "reconciled" };
    const m = buildMaestro(docs, T, "ventas", HOY, {}, conciliacion);
    const kauf = m.find((c) => c.rut === "96572360-9")!;

    expect(folios(m)).not.toContain(1);
    expect(folios(m)).toEqual([2, 3]);
    expect(kauf.docCount).toBe(1);
    expect(kauf.total).toBe(3_000_000); // ya no carga los $5M conciliados
    expect(kauf.vencido).toBe(0); // la única vencida era la conciliada
    expect(totalesMaestro(m).total).toBe(4_000_000);
  });

  it("CONTROL NEGATIVO: si el documento conciliado volviera a aparecer, esto falla", () => {
    /* Mismo set, pero el motor NO lo da por conciliado → debe aparecer. Si un cambio futuro
       dejara de filtrar por `reconciled`, el caso de arriba pasaría a verse como este y el
       test anterior caería. Acá se fija el contraste explícito. */
    const sinConciliar: ConciliacionMap = { "33-1-96572360-9": "unreconciled" };
    const m = buildMaestro(docs, T, "ventas", HOY, {}, sinConciliar);

    expect(folios(m)).toContain(1);
    expect(totalesMaestro(m).total).toBe(9_000_000);
    expect(m.find((c) => c.rut === "96572360-9")!.vencido).toBe(5_000_000);
  });

  it("una contraparte sin documentos pendientes desaparece de la lista", () => {
    const conciliacion: ConciliacionMap = { "33-3-77111222-3": "reconciled" };
    const m = buildMaestro(docs, T, "ventas", HOY, {}, conciliacion);
    expect(m.map((c) => c.rut)).toEqual(["96572360-9"]);
    expect(totalesMaestro(m).contrapartes).toBe(1);
  });

  it("`partial` NO se oculta: queda saldo, así que sigue siendo deuda viva", () => {
    const conciliacion: ConciliacionMap = { "33-1-96572360-9": "partial" };
    const m = buildMaestro(docs, T, "ventas", HOY, {}, conciliacion);
    const doc1 = m.flatMap((c) => c.docs).find((d) => d.folio === 1)!;
    expect(doc1.conciliacion).toBe("partial");
    expect(m.find((c) => c.rut === "96572360-9")!.vencido).toBe(5_000_000);
  });

  it("sin respuesta del motor no se oculta nada (un mapa vacío no es evidencia)", () => {
    const m = buildMaestro(docs, T, "ventas", HOY, {}, {});
    expect(folios(m)).toEqual([1, 2, 3]);
    expect(totalesMaestro(m).total).toBe(9_000_000);
  });

  it("un documento sin `sourceExternalId` tampoco se oculta", () => {
    const sinClave = docs.map((d) => ({ ...d, sourceExternalId: null }));
    const m = buildMaestro(sinClave, T, "ventas", HOY, {}, { "33-1-96572360-9": "reconciled" });
    expect(folios(m)).toEqual([1, 2, 3]);
  });
});

describe("marcas heredadas de `docs_pagados` — se muestran, no se contabilizan", () => {
  const pagados = readPagados({
    [PAGADOS_KEY]: { "ventas:96572360-9:1": "2026-07-20" },
  });

  it("con el motor cableado la declaración manual NO descuenta del saldo", () => {
    const m = buildMaestro(docs, T, "ventas", HOY, pagados, {
      "33-1-96572360-9": "unreconciled",
    });
    const kauf = m.find((c) => c.rut === "96572360-9")!;
    const doc1 = kauf.docs.find((d) => d.folio === 1)!;

    expect(doc1.pagado).toBe(false); // no se disfraza de conciliado
    expect(doc1.declaradoPagadoEl).toBe("2026-07-20"); // pero la declaración se conserva
    expect(kauf.vencido).toBe(5_000_000); // sigue vencida: no hay movimiento bancario detrás
    expect(kauf.pagado).toBe(0);
    expect(kauf.declaradoSinEvidencia).toBe(5_000_000);
    expect(kauf.docsDeclarados).toBe(1);
    expect(totalesMaestro(m).declaradoSinEvidencia).toBe(5_000_000);
  });

  it("si el motor SÍ lo tiene conciliado, el documento se va y la anotación con él", () => {
    const m = buildMaestro(docs, T, "ventas", HOY, pagados, {
      "33-1-96572360-9": "reconciled",
    });
    expect(folios(m)).not.toContain(1);
    expect(totalesMaestro(m).declaradoSinEvidencia).toBe(0);
  });

  it("los callers que no pasan `conciliacion` conservan el comportamiento anterior", () => {
    const m = buildMaestro(docs, T, "ventas", HOY, pagados);
    const kauf = m.find((c) => c.rut === "96572360-9")!;
    expect(kauf.pagado).toBe(5_000_000);
    expect(kauf.vencido).toBe(0);
    expect(kauf.docCount).toBe(2);
  });
});

describe("requisito 2 — a dónde lleva cada maestro", () => {
  it("cada tipo apunta al Libro de su lado, donde el documento se cruza con el banco", () => {
    expect(DESTINO_CONCILIACION).toEqual({
      ventas: "/cobrar/facturas-emitidas",
      compras: "/pagar/facturas-recibidas",
      honorarios: "/pagar/honorarios-recibidos",
    });
  });

  it("el nombre del destino se lee del catálogo de navegación, no se escribe a mano", () => {
    for (const [kind, href] of Object.entries(DESTINO_CONCILIACION)) {
      const comando = COMMANDS.find((c) => c.href === href);
      expect(comando, `desapareció ${href} del catálogo de navegación`).toBeDefined();
      expect(nombreDestino(kind as keyof typeof DESTINO_CONCILIACION)).toBe(comando!.label);
    }
  });

  it("no apunta a las pantallas que arrancan desde el MOVIMIENTO", () => {
    // `/bandeja`, `/caja/conciliacion` y `/banco/cuenta/[numero]` sólo se pueden abrir en un
    // movimiento bancario: desde un documento no hay forma de preseleccionarlo.
    const destinos = Object.values(DESTINO_CONCILIACION);
    for (const ruta of ["/bandeja", "/caja/conciliacion", "/banco"]) {
      expect(destinos.some((d) => d.startsWith(ruta))).toBe(false);
    }
  });
});
