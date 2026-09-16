/* Variables comunes de los E2E MSW. Todas quedan explícitas al construir:
 * Next inlinea `NEXT_PUBLIC_*`, así que nunca se toma el valor del shell para
 * decidir el Brief. El caller elige un puerto y el único flag que difiere
 * entre las suites OFF y ON. */
export function e2eBuildEnv(port: number, decisionBrief: boolean): Record<string, string> {
  return {
    NEXT_PUBLIC_API_MOCKING: "enabled",
    NEXT_PUBLIC_API_URL: `http://localhost:${port}`,
    NEXT_PUBLIC_TEST_MODE: "playwright",

    // Flags de los recorridos existentes que se cubren contra MSW.
    NEXT_PUBLIC_FF_BANK_MOVEMENT_CLASSIFICATION: "true",
    NEXT_PUBLIC_FF_CLASSIFICATION_RULES: "true",
    NEXT_PUBLIC_FF_MANAGEMENT_ACCOUNTS: "true",
    NEXT_PUBLIC_FF_CASH_FLOW_REPORT: "true",
    NEXT_PUBLIC_FF_OPERATIONAL_RESULT: "true",
    NEXT_PUBLIC_FF_ACCOUNTS_RECEIVABLE: "true",
    NEXT_PUBLIC_FF_ACCOUNTS_PAYABLE: "true",
    NEXT_PUBLIC_FF_CAJA_V2: "true",
    NEXT_PUBLIC_FF_CAJA_V3: "true",
    NEXT_PUBLIC_FF_PAGAR_V2: "true",
    NEXT_PUBLIC_FF_COBRAR_V2: "true",
    NEXT_PUBLIC_FF_PAGAR_V05: "true",
    NEXT_PUBLIC_FF_COBRAR_V04: "true",
    NEXT_PUBLIC_FF_DASHBOARD_SUMMARY: "true",
    NEXT_PUBLIC_FF_PULSO_DETAIL: "true",
    NEXT_PUBLIC_FF_ASSISTANT: "true",
    NEXT_PUBLIC_FF_HOY_V01: "true",
    /* Verificado contra `wrangler.toml` del Worker: si una variante está en "true" allá y falta
       acá, el E2E valida una pantalla que el usuario no ve. */
    NEXT_PUBLIC_FF_CAJA_V02: "true",
    NEXT_PUBLIC_FF_LIBRO_VENTAS_V2: "true",
    NEXT_PUBLIC_FF_LIBRO_COMPRAS_V2: "true",
    NEXT_PUBLIC_FF_IMPUESTOS_V06: "true",
    NEXT_PUBLIC_FF_BANDEJA_V07: "true",
    NEXT_PUBLIC_FF_BANCO_V03: "true",
    NEXT_PUBLIC_FF_SII_QUERIES: "true",
    NEXT_PUBLIC_FF_OBLIGATIONS: "true",
    NEXT_PUBLIC_FF_REMUNERACIONES: "true",
    NEXT_PUBLIC_FF_RECONCILIATION_REVIEW: "true",
    NEXT_PUBLIC_FF_MULTI_CURRENCY: "true",
    NEXT_PUBLIC_FF_INDUSTRY_TEMPLATES: "true",
    NEXT_PUBLIC_FF_MANAGEMENT_DIMENSIONS: "true",
    NEXT_PUBLIC_FF_MI_CUENTA: "true",
    NEXT_PUBLIC_FF_BANCO_SCREEN: "true",
    NEXT_PUBLIC_FF_PAYROLL_RECONCILE_BOARD: "true",
    NEXT_PUBLIC_FF_BANCO_CONCILIACION: "true",
    NEXT_PUBLIC_FF_PULSO_OBJETIVO: "true",
    NEXT_PUBLIC_FF_COMPORTAMIENTO_PAGO: "true",
    NEXT_PUBLIC_FF_GESTION_DASHBOARD: "true",
    NEXT_PUBLIC_FF_CAJA_DASHBOARD: "true",
    NEXT_PUBLIC_FF_PRESUPUESTO: "true",
    NEXT_PUBLIC_FF_MCP: "true",
    NEXT_PUBLIC_FF_FINANCIAMIENTO_V13: "true",
    NEXT_PUBLIC_FF_SIMULADOR_V14: "true",
    NEXT_PUBLIC_FF_CAJA_MARK_COLLECTED: "true",

    // El kill switch se fija en build-time, sin fallback al entorno anfitrión.
    NEXT_PUBLIC_FF_DECISION_BRIEF: decisionBrief ? "true" : "false",
  };
}
