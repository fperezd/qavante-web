import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BankBalancesCard } from "./bank-balances-card";
import type { BalanceData, CuentaSaldo } from "@/lib/api/treasury";

/* Saldos de banco (BICE) — tarjeta montada en Caja. Saldo disponible al frente
   por cuenta (CLP + USD), contable como referencia. */

const cuentas: CuentaSaldo[] = [
  {
    numeroCuenta: "r-K3yKu_",
    numeroFormateado: "07-04222-1",
    nombreCuenta: "Cuenta Corriente MN",
    codigoProducto: "100",
    codigoMoneda: "000",
    esExtranjera: false,
    saldoContable: "1931152.70",
    saldoDisponible: "3073227.32",
    moneda: "CLP",
    fechaDesde: "2026-07-04",
    fechaHasta: "2026-07-04",
  },
  {
    numeroCuenta: "Ygjlm_Nq",
    numeroFormateado: "013-07-02990-8",
    nombreCuenta: "Cta Cte USD",
    codigoProducto: "101",
    codigoMoneda: "013",
    esExtranjera: true,
    saldoContable: "156.14",
    saldoDisponible: "1511.25",
    moneda: "USD",
    fechaDesde: "2026-07-04",
    fechaHasta: "2026-07-04",
  },
];

const meta = {
  title: "Capa 2 / Treasury / Saldos de banco",
  component: BankBalancesCard,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BankBalancesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Dos cuentas: corriente CLP + cuenta USD, con saldo disponible y contable. */
export const ClpYUsd: Story = { args: { cuentas, referencia: "2026-07-04" } };

/** Con línea de crédito: la corriente CLP tiene cupo $5M (usa $2M, quedan $3M) + venc. sobregiro;
 *  la USD no tiene línea (no se muestra LC). */
export const ConLineaDeCredito: Story = {
  args: {
    cuentas,
    referencia: "2026-07-04",
    balancePorCuenta: new Map<string, BalanceData>([
      [
        "r-K3yKu_",
        {
          titulo: null,
          monto: null,
          saldoContableMonto: "1931152.70",
          saldoContableCodigoMoneda: "CLP",
          saldoDisponibleMonto: "3073227.32",
          saldoDisponibleCodigoMoneda: "CLP",
          saldoUtilizadoMonto: "2000000",
          saldoUtilizadoCodigoMoneda: "CLP",
          montoAprobadoMonto: "5000000",
          montoAprobadoCodigoMoneda: "CLP",
          montoUtilizadoMonto: "2000000",
          montoUtilizadoCodigoMoneda: "CLP",
          montoDisponibleMonto: "3000000",
          montoDisponibleCodigoMoneda: "CLP",
          fechaVencimientoSobregiro: "2026-09-30",
          fechaConsultaSaldo: "2026-07-04",
        },
      ],
    ]),
  },
};

/** Sin cuentas conectadas. */
export const SinCuentas: Story = { args: { cuentas: [] } };
