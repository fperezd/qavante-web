import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CurrencyCodeSelect } from "./currency-code-select";
import type { Currency } from "@/lib/api/currencies";

/* `<select>` nativo de moneda (ADR-0010, sin combobox). El caso clave que
   cubre el fix #7: un `value` persistido que NO está en las opciones
   (inactivo / filtrado / excluido) se muestra como opción "no disponible" en
   vez de que el select mienta mostrando otra moneda. */

function ccy(p: Partial<Currency> & { code: string }): Currency {
  return {
    name: p.code,
    symbol: null,
    currency_type: "fiat",
    decimals: 2,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  } as Currency;
}

const CURRENCIES: Currency[] = [
  ccy({ code: "CLP", name: "Peso chileno" }),
  ccy({ code: "USD", name: "Dólar estadounidense" }),
  ccy({ code: "EUR", name: "Euro" }),
  ccy({ code: "BTC", name: "Bitcoin (inactiva)", active: false }),
  ccy({ code: "UF", name: "Unidad de Fomento", currency_type: "indexed_unit" }),
];

function Controlled({ initial, ...rest }: { initial: string } & Record<string, unknown>) {
  const [value, setValue] = React.useState(initial);
  return (
    <div className="max-w-xs p-4">
      <CurrencyCodeSelect
        value={value}
        onChange={setValue}
        currencies={CURRENCIES}
        aria-label="Moneda"
        {...rest}
      />
      <p className="mt-2 text-xs text-neutral-mid">value = {JSON.stringify(value)}</p>
    </div>
  );
}

const meta = {
  title: "Capa 2 / Monedas / CurrencyCodeSelect",
  component: CurrencyCodeSelect,
  parameters: { layout: "padded" },
  args: {
    value: "CLP",
    onChange: () => {},
    currencies: CURRENCIES,
  },
} satisfies Meta<typeof CurrencyCodeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fiat: Story = {
  name: "Solo fiat (filterType)",
  render: () => <Controlled initial="USD" filterType="fiat" />,
};

export const ValorInactivo: Story = {
  name: "#7 — value inactivo (BTC) se muestra 'no disponible'",
  render: () => <Controlled initial="BTC" />,
};

export const ValorFiltrado: Story = {
  name: "#7 — value fuera del filterType (UF en fiat)",
  render: () => <Controlled initial="UF" filterType="fiat" />,
};

export const ConVacio: Story = {
  name: "allowEmpty (placeholder seleccionable)",
  render: () => <Controlled initial="" allowEmpty placeholder="Selecciona una moneda…" />,
};
