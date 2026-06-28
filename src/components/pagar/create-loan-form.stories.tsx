import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { CreateLoanForm } from "./create-loan-form";

/* Alta de préstamo (Pagar → Obligaciones). `POST /api/treasury/obligations`.
   `useRouter` auto-mock (appDirectory). El preview de cuota es client-side. */

const OK = http.post("*/api/treasury/obligations", () =>
  HttpResponse.json(
    {
      obligation: {
        id: "obl-new",
        type: "loan",
        counterparty: "Banco BICE",
        principal_total: "12000000",
        annual_rate: "0.18",
        currency_code: "CLP",
        origination_date: "2026-07-15",
        installments_total: 12,
        status: "active",
        needs_review: false,
      },
      installments: [],
    },
    { status: 201 },
  ),
);

const meta = {
  title: "Capa 2 / Pagar / CreateLoanForm",
  component: CreateLoanForm,
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    msw: { handlers: [OK] },
  },
} satisfies Meta<typeof CreateLoanForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Formulario: Story = {};
