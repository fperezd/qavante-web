import type { BankAccountItem } from "@/lib/api/treasury";
import type { InicioCredito } from "./inicio-creditos-live";

/** Fictional accounts exclusively for isolated component tests and stories. */
export const MULTI_BANK_ACCOUNTS: BankAccountItem[] = [
  {
    id: "bice-clp",
    name: "Operación CLP",
    bank_name: "BICE",
    currency_code: "CLP",
    account_type: "checking",
    active: true,
    balance: "10000000",
    balance_as_of: "2026-09-11T12:00:00Z",
  },
  {
    id: "bice-usd",
    name: "Operación USD",
    bank_name: "BICE",
    currency_code: "USD",
    account_type: "checking",
    active: true,
    balance: "5000",
    balance_as_of: "2026-09-11T12:00:00Z",
  },
  {
    id: "chile-clp",
    name: "Operación CLP",
    bank_name: "Banco de Chile",
    currency_code: "CLP",
    account_type: "checking",
    active: true,
    balance: "5900000",
    balance_as_of: "2026-09-11T12:00:00Z",
  },
  {
    id: "santander-clp",
    name: "Reserva CLP",
    bank_name: "Santander",
    currency_code: "CLP",
    account_type: "savings",
    active: true,
    balance: "2000000",
    balance_as_of: "2026-09-11T12:00:00Z",
  },
  {
    id: "santander-usd",
    name: "Operación USD",
    bank_name: "Santander",
    currency_code: "USD",
    account_type: "checking",
    active: true,
    balance: "3500",
    balance_as_of: "2026-09-11T12:00:00Z",
  },
];
export const MULTI_BANK_CREDITS: InicioCredito[] = [
  {
    id: "line-bice",
    bank: "BICE",
    account: "1234",
    currency: "CLP",
    available: 4000000,
    total: 6000000,
  },
  {
    id: "line-chile",
    bank: "Banco de Chile",
    account: "5678",
    currency: "CLP",
    available: 2000000,
    total: 3000000,
  },
  {
    id: "line-santander",
    bank: "Santander",
    account: "9988",
    currency: "USD",
    available: 1500,
    total: 3000,
  },
];
