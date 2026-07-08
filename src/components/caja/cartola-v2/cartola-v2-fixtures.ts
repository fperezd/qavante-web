/* Datos de ejemplo del prototipo "Cartola nivel dios" (Storybook). No prod.
   Espeja el resumen + movimientos de la cartola de BICE (Tooxs, jun 2026). */

import type { SparkTone } from "@/components/ui/sparkline";

export interface CartolaKpi {
  label: string;
  value: number;
  hint: string;
  /** Flujo: "in" (abono, ↘ verde) / "out" (cargo, ↗ naranja) / undefined (neutro). */
  direction?: "in" | "out";
  tone?: SparkTone;
  /** Mini-tendencia 30d (opcional). */
  trend?: number[];
}

export interface CartolaMovimiento {
  fecha: string;
  tipo: "Cargo" | "Abono";
  descripcion: string;
  /** Firmado: negativo = cargo (sale), positivo = abono (entra). */
  monto: number;
  /** Saldo contable tras el movimiento. */
  saldo: number;
}

/** Saldo diario (30 días) para el sparkline del hero — cierra negativo. */
const saldoDiario = [
  0.44, 0.4, 0.38, 0.3, 0.1, -0.6, -1.2, -0.9, -0.4, 0.2, 0.6, 0.3, -0.2, -0.8, -1.5, -2.1, -1.7,
  -1.1, -0.5, -1.3, -2.4, -3.1, -2.6, -3.4, -4.2, -3.8, -4.6, -5.1, -4.9, -5.14,
];

export const resumenKpis: {
  saldoFinal: CartolaKpi;
  secundarios: CartolaKpi[];
} = {
  saldoFinal: {
    label: "Saldo final",
    value: -5135363,
    hint: "Es el monto de la cuenta al cierre del período, considerando todos los movimientos y las retenciones.",
    tone: "danger",
    trend: saldoDiario,
  },
  secundarios: [
    {
      label: "Total cargos",
      value: 33723418,
      hint: "Todo lo que SALIÓ de la cuenta en el período (pagos, giros, comisiones, impuestos).",
      direction: "out",
      tone: "danger",
      trend: [3.1, 2.4, 3.8, 2.9, 4.1, 3.3, 4.8, 5.2, 3.9, 4.6],
    },
    {
      label: "Total abonos",
      value: 28145974,
      hint: "Todo lo que ENTRÓ a la cuenta en el período (cobros, transferencias recibidas, depósitos).",
      direction: "in",
      tone: "success",
      trend: [2.2, 3.4, 2.1, 3.8, 4.0, 2.9, 3.1, 2.6, 4.2, 3.7],
    },
    {
      label: "Sobregiro disponible",
      value: 6000000,
      hint: "Tu línea de crédito para cubrir la cuenta cuando el saldo baja de cero. No es plata tuya: se paga con intereses.",
    },
    {
      label: "Saldo inicial",
      value: 442081,
      hint: "El saldo con que abrió el período, antes de los movimientos.",
    },
  ],
};

export const movimientos: CartolaMovimiento[] = [
  {
    fecha: "01 jun 2026",
    tipo: "Cargo",
    descripcion: "Cargo Intereses Sobregiro Cursado",
    monto: -39516,
    saldo: 402565,
  },
  {
    fecha: "01 jun 2026",
    tipo: "Cargo",
    descripcion: "Cargo Impuesto Sobregiro Cursado",
    monto: -2540,
    saldo: 400025,
  },
  {
    fecha: "01 jun 2026",
    tipo: "Cargo",
    descripcion: "Cargo por Pago Tarjeta de Crédito vía ejecutivo",
    monto: -1000000,
    saldo: -599975,
  },
  {
    fecha: "02 jun 2026",
    tipo: "Abono",
    descripcion: "Transferencia recibida — Comercial Kaufmann S.A.",
    monto: 1428000,
    saldo: 828025,
  },
  {
    fecha: "03 jun 2026",
    tipo: "Cargo",
    descripcion: "Pago proveedor — Distribuidora Andina Ltda.",
    monto: -2499000,
    saldo: -1670975,
  },
  {
    fecha: "05 jun 2026",
    tipo: "Abono",
    descripcion: "Transferencia recibida — Aguas de Antofagasta S.A.",
    monto: 5486914,
    saldo: 3815939,
  },
  {
    fecha: "10 jun 2026",
    tipo: "Cargo",
    descripcion: "Pago Previred — cotizaciones mayo",
    monto: -1350000,
    saldo: 2465939,
  },
  {
    fecha: "12 jun 2026",
    tipo: "Cargo",
    descripcion: "Pago F29 — IVA mayo",
    monto: -2480000,
    saldo: -14061,
  },
];
