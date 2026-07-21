import { describe, it, expect } from "vitest";
import {
  construirCascada,
  pisoCascada,
  rangoCascada,
  type MovimientoCaja,
} from "./caja-cascada-model";

const mov = (fecha: string, label: string, monto: number): MovimientoCaja => ({
  fecha: new Date(fecha),
  fechaLabel: fecha.slice(5),
  label,
  monto,
});

describe("construirCascada", () => {
  it("ancla hoy + un paso por movimiento (cronológico) + ancla proyectado, con saldo corriente", () => {
    const pasos = construirCascada(6_000_000, [
      mov("2026-08-10", "Proveedores", -5_000_000),
      mov("2026-07-30", "Sueldos", -3_000_000), // desordenado a propósito
      mov("2026-08-05", "Kaufmann", 4_000_000),
    ]);
    // ordena por fecha: hoy, Sueldos(30-jul), Kaufmann(5-ago), Proveedores(10-ago), Proyectado
    expect(pasos.map((p) => p.label)).toEqual([
      "Saldo hoy",
      "Sueldos",
      "Kaufmann",
      "Proveedores",
      "Proyectado",
    ]);
    expect(pasos.map((p) => p.kind)).toEqual(["hoy", "out", "in", "out", "proyectado"]);
    // saldo corriente: 6 → 3 → 7 → 2
    expect(pasos.map((p) => p.saldoDespues)).toEqual([
      6_000_000, 3_000_000, 7_000_000, 2_000_000, 2_000_000,
    ]);
  });

  it("no muta la entrada", () => {
    const movs = [mov("2026-08-10", "B", -1), mov("2026-07-30", "A", -2)];
    const copia = [...movs];
    construirCascada(0, movs);
    expect(movs).toEqual(copia);
  });

  it("saldoAntes del paso = saldoDespues del anterior", () => {
    const pasos = construirCascada(1_000, [
      mov("2026-07-30", "X", -400),
      mov("2026-08-01", "Y", 900),
    ]);
    for (let i = 1; i < pasos.length; i++) {
      expect(pasos[i]!.saldoAntes).toBe(pasos[i - 1]!.saldoDespues);
    }
  });
});

describe("pisoCascada", () => {
  it("el saldo corriente más bajo del camino y su índice", () => {
    const pasos = construirCascada(6_000_000, [
      mov("2026-07-30", "Sueldos", -6_800_000), // baja a -800k
      mov("2026-08-05", "Kaufmann", 2_900_000), // sube a 2.1M
    ]);
    const piso = pisoCascada(pasos)!;
    expect(piso.saldo).toBe(-800_000);
    expect(piso.indice).toBe(1); // el paso "Sueldos"
  });
  it("null si no hay pasos", () => {
    expect(pisoCascada([])).toBeNull();
  });
});

describe("rangoCascada", () => {
  it("incluye el $0 aunque el camino no toque negativo (muestra el rojo en el eje)", () => {
    const pasos = construirCascada(5_000_000, [mov("2026-07-30", "X", 2_000_000)]);
    const r = rangoCascada(pasos);
    expect(r.min).toBe(0);
    expect(r.max).toBe(7_000_000);
  });
  it("captura el piso negativo", () => {
    const pasos = construirCascada(2_000_000, [mov("2026-07-30", "X", -5_000_000)]);
    expect(rangoCascada(pasos).min).toBe(-3_000_000);
  });
});
