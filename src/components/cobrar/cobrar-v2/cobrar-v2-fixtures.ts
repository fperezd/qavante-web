/* Datos de ejemplo de Cobrar v2 (Storybook). No prod. */

import type { CobranzaV2Data } from "./types";

/** Cartera con vencido relevante, DSO deteriorándose y concentración alta. */
export const cobranzaConRiesgo: CobranzaV2Data = {
  total: "48200000",
  overdue: "15400000",
  overdue_pct: "32.0",
  dso: 52,
  dso_prev: 45,
  dso_target: 30,
  weekly_collection: [
    { label: "Esta semana", expected: "6800000" },
    { label: "14 jul", expected: "11200000" },
    { label: "21 jul", expected: "4300000" },
    { label: "28 jul", expected: "9100000" },
  ],
  items: [
    { client_name: "Aguas de Antofagasta S.A.", client_rut: "76418976-0", document: "Factura 423", balance: "5486914", days_overdue: 0, due_date: "2026-07-24" },
    { client_name: "Comercial Kaufmann S.A.", client_rut: "96572360-9", document: "Factura 398", balance: "5768543", days_overdue: 72, due_date: "2026-04-20" },
    { client_name: "Legalchile S.A.", client_rut: "96783190-5", document: "Factura 401", balance: "5234345", days_overdue: 34, due_date: "2026-05-28" },
    { client_name: "Maestra Servicios S.A.", client_rut: "96996620-4", document: "Factura 405", balance: "913628", days_overdue: 12, due_date: "2026-06-19" },
    { client_name: "Puerto Columbo S.A.", client_rut: "76008959-1", document: "Factura 395", balance: "380680", days_overdue: 95, due_date: "2026-03-28" },
  ],
  top_debtors: [
    { name: "Comercial Kaufmann S.A.", rut: "96572360-9", total: "18600000", overdue: "9200000" },
    { name: "Aguas de Antofagasta S.A.", rut: "76418976-0", total: "12800000", overdue: "0" },
    { name: "Legalchile S.A.", rut: "96783190-5", total: "9700000", overdue: "5100000" },
    { name: "Otros (12 clientes)", rut: "—", total: "7100000", overdue: "1100000" },
  ],
};

/** Cartera sana: DSO mejorando, poco vencido. */
export const cobranzaSana: CobranzaV2Data = {
  total: "22400000",
  overdue: "1800000",
  overdue_pct: "8.0",
  dso: 34,
  dso_prev: 41,
  dso_target: 45,
  weekly_collection: [
    { label: "Esta semana", expected: "8200000" },
    { label: "14 jul", expected: "6100000" },
    { label: "21 jul", expected: "5300000" },
    { label: "28 jul", expected: "2800000" },
  ],
  items: [
    { client_name: "Cliente A SpA", client_rut: "77123456-7", document: "Factura 512", balance: "4200000", days_overdue: 0, due_date: "2026-07-20" },
    { client_name: "Cliente B Ltda.", client_rut: "76987654-3", document: "Factura 509", balance: "1800000", days_overdue: 6, due_date: "2026-06-25" },
    { client_name: "Cliente C S.A.", client_rut: "96111222-3", document: "Factura 514", balance: "3100000", days_overdue: -4, due_date: "2026-07-05" },
  ],
  top_debtors: [
    { name: "Cliente A SpA", rut: "77123456-7", total: "6800000", overdue: "0" },
    { name: "Cliente C S.A.", rut: "96111222-3", total: "5200000", overdue: "0" },
    { name: "Cliente B Ltda.", rut: "76987654-3", total: "4100000", overdue: "1800000" },
  ],
};
