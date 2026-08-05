import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { within, expect } from "storybook/test";
import { BancoBankCard } from "./banco-bank-card";
import type { BalanceData, CuentaSaldo, TarjetaCredito } from "@/lib/api/treasury";
import type { CupoTarjeta } from "./banco-model";

/* Un banco y sus productos (cuentas + tarjetas), la pieza central de la pantalla Banco. */

const cuenta = (over: Partial<CuentaSaldo>): CuentaSaldo =>
  ({
    numeroCuenta: "tok-clp",
    numeroFormateado: "07-04222-1",
    nombreCuenta: "Cuenta Corriente CLP",
    codigoProducto: "100",
    codigoMoneda: "CLP",
    esExtranjera: false,
    saldoContable: "1931152.70",
    saldoDisponible: "6931152.70",
    moneda: "CLP",
    fechaDesde: "2026-08-04",
    fechaHasta: "2026-08-04",
    ...over,
  }) as CuentaSaldo;

const balanceConLinea: BalanceData = {
  titulo: null,
  monto: null,
  saldoContableMonto: "1931152.70",
  saldoContableCodigoMoneda: "CLP",
  saldoDisponibleMonto: "6931152.70",
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
  fechaConsultaSaldo: "2026-08-04",
};

const tarjeta = (over: Partial<TarjetaCredito>): TarjetaCredito =>
  ({
    operationNumber: "42595474000067584",
    creditCardCheckDigit: "1",
    product: "Tarjeta de Crédito CLP",
    holder: "TOOXS DIGITAL SPA",
    isActive: true,
    ...over,
  }) as TarjetaCredito;

const cupoClp: CupoTarjeta[] = [
  {
    moneda: "CLP",
    total: 8_000_000,
    usado: 3_200_000,
    disponible: 4_800_000,
    facturado: 3_200_000,
    vencimiento: "2026-09-05",
  },
];

const meta = {
  title: "Propuestas / Banco / BancoBankCard",
  component: BancoBankCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BancoBankCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** BICE con una cuenta CLP (+ línea de crédito) y una tarjeta CLP (cupo). */
export const ConCuentasYTarjetas: Story = {
  args: {
    banco: "BICE",
    referencia: "2026-08-04",
    cuentas: [{ cuenta: cuenta({}), balance: balanceConLinea }],
    tarjetas: [{ tarjeta: tarjeta({}), cupos: cupoClp }],
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("BICE")).toBeInTheDocument();
    await expect(c.getByText("Cuentas corrientes")).toBeInTheDocument();
    await expect(c.getByText("Tarjetas de crédito")).toBeInTheDocument();
    await expect(c.getByText("Cuenta Corriente CLP")).toBeInTheDocument();
    // La cuenta muestra su línea de crédito y la tarjeta su disponible.
    await expect(c.getByText(/Línea de crédito/)).toBeInTheDocument();
    await expect(c.getByText(/Disponible/)).toBeInTheDocument();
  },
};

/** Banco sin productos → mensaje honesto. */
export const SinProductos: Story = {
  args: { banco: "BICE", cuentas: [], tarjetas: [] },
};
