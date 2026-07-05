import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { LinkBankAccountsCard } from "./link-bank-accounts-card";

/* Cuentas por vincular (BICE en cuarentena). Un clic crea la cuenta Qavante y la
   vincula (POST bank-accounts → POST .../link). */

const account = (linked: string | null) => ({
  external_id: "0009876543",
  name: "Cuenta Internacional",
  currency: "USD",
  linked_bank_account_id: linked,
});

const CREATE = http.post("*/api/treasury/bank-accounts", () =>
  HttpResponse.json({ id: "acct-new", name: "Cuenta", currency_code: "USD" }, { status: 201 }),
);
const LINK = http.post("*/api/bank-movements/bice/accounts/:externalId/link", () =>
  HttpResponse.json({ external_id: "0009876543", linked_bank_account_id: "acct-new" }),
);

const meta = {
  title: "Capa 2 / Treasury / LinkBankAccountsCard",
  component: LinkBankAccountsCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof LinkBankAccountsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorVincular: Story = {
  name: "Con cuenta por vincular",
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/bank-movements/bice/accounts", () =>
          HttpResponse.json({ accounts: [account("acct-1"), account(null)] }),
        ),
        CREATE,
        LINK,
      ],
    },
  },
};

export const TodoVinculado: Story = {
  name: "Todo vinculado",
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/bank-movements/bice/accounts", () =>
          HttpResponse.json({ accounts: [account("acct-1")] }),
        ),
      ],
    },
  },
};
