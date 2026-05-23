import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { CurrencySettingsDialog } from "./currency-settings-dialog";
import type { CompanyCurrencySettings, Currency } from "@/lib/api/currencies";

/* Fixtures determinísticas (no faker / no Math.random). Replican el seed
   MSW de currencies en `src/test/msw/handlers.ts`. */
const SEED_CURRENCIES: Currency[] = [
  {
    code: "CLP",
    name: "Peso chileno",
    symbol: "$",
    currency_type: "fiat",
    decimals: 0,
    active: true,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "USD",
    name: "Dólar estadounidense",
    symbol: "US$",
    currency_type: "fiat",
    decimals: 2,
    active: true,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    currency_type: "fiat",
    decimals: 2,
    active: true,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "BRL",
    name: "Real brasileño",
    symbol: "R$",
    currency_type: "fiat",
    decimals: 2,
    active: true,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "UF",
    name: "Unidad de Fomento",
    symbol: "UF",
    currency_type: "indexed_unit",
    decimals: 4,
    active: true,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    code: "UTM",
    name: "Unidad Tributaria Mensual",
    symbol: "UTM",
    currency_type: "indexed_unit",
    decimals: 0,
    active: true,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
];

const SEED_SETTINGS: CompanyCurrencySettings = {
  tenant_id: "t-demo",
  functional_currency_code: "CLP",
  default_reporting_currency_code: "USD",
  reporting_currency_codes: ["USD", "EUR"],
  indexed_unit_enabled: true,
  indexed_unit_currency_code: "UF",
  default_exchange_rate_source: "BCCH",
  updated_at: "2026-05-22T00:00:00Z",
};

const meta = {
  title: "Capa 2 / Monedas / CurrencySettingsDialog",
  component: CurrencySettingsDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Editor de Ajustes de moneda (Addendum §15.4/§15.6). Dialog Base UI + react-hook-form + zod con 3 refinamientos de coherencia (funcional ∉ reporting, default_reporting ∈ reporting_codes, indexed_enabled ⇒ code presente). El gating owner/admin lo hace el backend (403 → Anexo C.3); la UI siempre muestra el botón.",
      },
    },
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: fn(),
    currencies: SEED_CURRENCIES,
  },
} satisfies Meta<typeof CurrencySettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editar: Story = {
  args: { settings: SEED_SETTINGS },
  parameters: {
    docs: {
      description: {
        story:
          "Editar settings sembrados (caso típico): CLP funcional, USD/EUR reporting, UF activa, fuente BCCH. Los selectores del form filtran fiat para funcional/reporting y indexed_unit para UF/UTM.",
      },
    },
  },
};

export const Configurar: Story = {
  args: { settings: null },
  parameters: {
    docs: {
      description: {
        story:
          "Tenant sin settings sembrados (§15.4 — `data: null`). Defaults Chile: CLP funcional, sin reporting, sin unidad indexada. El user completa el resto.",
      },
    },
  },
};

export const SinUnidadIndexada: Story = {
  args: {
    settings: {
      ...SEED_SETTINGS,
      indexed_unit_enabled: false,
      indexed_unit_currency_code: null,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Configuración válida sin unidad indexada (typical para PYMEs que no usan UF/UTM). El selector de UF/UTM se oculta cuando el toggle está OFF.",
      },
    },
  },
};

export const Closed: Story = {
  args: { open: false, settings: SEED_SETTINGS },
  parameters: {
    docs: {
      description: {
        story: "Estado cerrado — el Portal no monta el popup. Story sólo para verificar no-break.",
      },
    },
  },
};
