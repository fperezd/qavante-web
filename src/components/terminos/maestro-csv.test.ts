import { describe, expect, it } from "vitest";

import { maestroCsvFilename, maestroCsvHeaders, maestroToCsv } from "./maestro-csv";
import type { ContraparteMaestro, DocMaestro } from "./terminos-pago";

function doc(over: Partial<DocMaestro> = {}): DocMaestro {
  return {
    folio: 101,
    fecha: "2026-03-10",
    fechaEmision: new Date("2026-03-10T00:00:00Z"),
    monto: 450000,
    vencimiento: new Date("2026-03-15T00:00:00Z"),
    estado: "vigente",
    diasParaVencer: 5,
    pagado: false,
    tipoDoc: 41,
    esNotaCredito: false,
    refFolio: null,
    anulacion: null,
    neto: null,
    ...over,
  };
}

function cp(over: Partial<ContraparteMaestro> = {}): ContraparteMaestro {
  return {
    rut: "12345678-5",
    name: "JUAN PEREZ",
    docCount: 1,
    total: 450000,
    vencido: 0,
    porVencer: 0,
    vigente: 450000,
    pagado: 0,
    termino: 5,
    terminoCustom: false,
    proximoVencimiento: new Date("2026-03-15T00:00:00Z"),
    docs: [doc()],
    ...over,
  };
}

function celdas(csv: string, n: number): string[] {
  const linea = csv.split("\r\n")[n];
  if (linea === undefined) throw new Error(`El CSV no tiene fila ${n}`);
  return linea.split(";");
}

describe("maestroToCsv", () => {
  it("emite una fila por DOCUMENTO, no por contraparte", () => {
    const csv = maestroToCsv(
      [cp({ docs: [doc({ folio: 1 }), doc({ folio: 2 })] }), cp({ docs: [doc({ folio: 3 })] })],
      "honorarios",
    );
    expect(csv.split("\r\n")).toHaveLength(4); // cabecera + 3 documentos
  });

  it("repite los datos de la contraparte en cada fila, para poder pivotear", () => {
    const csv = maestroToCsv([cp({ docs: [doc({ folio: 1 }), doc({ folio: 2 })] })], "honorarios");
    expect(celdas(csv, 1)[1]).toBe("JUAN PEREZ");
    expect(celdas(csv, 2)[1]).toBe("JUAN PEREZ");
  });

  it("nombra la contraparte segun el maestro", () => {
    expect(maestroCsvHeaders("honorarios")[1]).toBe("Profesional");
    expect(maestroCsvHeaders("compras")[1]).toBe("Proveedor");
    expect(maestroCsvHeaders("ventas")[1]).toBe("Cliente");
  });

  it("conserva el signo negativo de una nota de credito", () => {
    const csv = maestroToCsv(
      [cp({ docs: [doc({ monto: -120000, esNotaCredito: true, tipoDoc: 61 })] })],
      "honorarios",
    );
    expect(celdas(csv, 1)[5]).toBe("-120000");
  });

  it("rotula 'Sin fecha' como estado real y deja el vencimiento vacio", () => {
    const csv = maestroToCsv(
      [cp({ docs: [doc({ estado: "sin_fecha", vencimiento: null, diasParaVencer: null })] })],
      "honorarios",
    );
    const fila = celdas(csv, 1);
    expect(fila[6]).toBe("Sin fecha");
    expect(fila[7]).toBe("");
    expect(fila[8]).toBe("");
  });

  it("marca el documento reclamado, para que se entienda por que no suma", () => {
    const csv = maestroToCsv([cp({ docs: [doc({ reclamado: true })] })], "honorarios");
    expect(celdas(csv, 1)[10]).toBe("Si");
  });

  it("marca lo pagado", () => {
    const csv = maestroToCsv([cp({ docs: [doc({ pagado: true })] })], "honorarios");
    expect(celdas(csv, 1)[9]).toBe("Si");
  });

  it("escapa nombres con punto y coma o comillas", () => {
    const csv = maestroToCsv([cp({ name: 'PEREZ; "EL RAPIDO"' })], "honorarios");
    expect(csv).toContain('"PEREZ; ""EL RAPIDO"""');
  });

  it("una contraparte sin documentos no aporta filas", () => {
    const csv = maestroToCsv([cp({ docs: [] })], "honorarios");
    expect(csv).toBe(maestroCsvHeaders("honorarios").join(";"));
  });

  it("sin contrapartes entrega solo la cabecera", () => {
    expect(maestroToCsv([], "honorarios")).toBe(maestroCsvHeaders("honorarios").join(";"));
  });

  it("cae a la fecha cruda si no hay fechaEmision parseada", () => {
    const csv = maestroToCsv([cp({ docs: [doc({ fechaEmision: null })] })], "honorarios");
    expect(celdas(csv, 1)[4]).toBe("2026-03-10");
  });
});

describe("maestroCsvFilename", () => {
  it("usa el nombre del maestro", () => {
    expect(maestroCsvFilename("honorarios")).toBe("honorarios.csv");
    expect(maestroCsvFilename("compras")).toBe("proveedores.csv");
    expect(maestroCsvFilename("ventas")).toBe("clientes.csv");
  });

  it("normaliza la etiqueta de periodo para que sea un nombre de archivo valido", () => {
    expect(maestroCsvFilename("honorarios", "ene–jul 2026")).toBe("honorarios-ene-jul-2026.csv");
  });
});
