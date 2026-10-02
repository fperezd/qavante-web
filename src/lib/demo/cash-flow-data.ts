/* Fuente única de las cifras de EJEMPLO que usan las maquetas de `/maquetas`.
 *
 * Nada de acá sale de una API ni entra a una pantalla con datos reales: las maquetas
 * declaran en su encabezado que las cifras son de ejemplo, y son las únicas que importan
 * este módulo. El tipo de un movimiento también vive acá y no en `lib/api`: el reporte de
 * caja del contrato no publica movimiento por movimiento, así que ponerlo en el módulo de
 * la API haría pasar por campo del contrato algo que ninguna respuesta trae. */

/** Un movimiento de ejemplo. Forma propia de la maqueta, no un esquema del contrato. */
export interface DemoCashFlowTransaction {
  id: string;
  description: string;
  inflow: string;
  outflow: string;
  date: string;
  /** Institución bancaria del movimiento de ejemplo. */
  bankId?: string;
  category?: string;
  classification?: string;
}
/* Primera compra de inventario simulada. Ya fue pagada por banco el 22/09/2026. */
export const DEMO_SUPPLIER_PURCHASE = {
  supplierRut: "76.123.456-0",
  supplierName: "Insumos del Sur SpA",
  description: "Compra inicial de inventario para reventa",
  documentType: 33,
  folio: 9001,
  date: "10/09/2026",
  dueDate: "2026-10-10",
  paidDate: "2026-09-22",
  net: 850_000,
  vat: 161_500,
  total: 1_011_500,
  paid: true,
} as const;

/* Primera venta simulada: se vendió y cobró todo el inventario el 22/09/2026. */
export const DEMO_CUSTOMER_SALE = {
  customerRut: "77.234.567-4",
  customerName: "Comercial Los Aromos SpA",
  description: "Venta inicial del inventario",
  documentType: 33,
  folio: 10001,
  date: "22/09/2026",
  issuedDate: "2026-09-22",
  dueDate: "2026-10-07",
  paidDate: "2026-09-22",
  net: 1_200_000,
  vat: 228_000,
  total: 1_428_000,
  costOfGoodsSold: DEMO_SUPPLIER_PURCHASE.net,
  collected: true,
} as const;

/* La empresa inicia en julio con capital y se prepara para su primera venta
   en septiembre. Los movimientos de crédito y equipamiento son simulados. */
export const DEMO_OPENING_BALANCE = 3_000_000;
export const DEMO_OPENING_CAPITAL_DATE = "2026-07-01";

/* Cuentas por cobrar abiertas: no son movimientos bancarios hasta que se realicen. */
export const DEMO_UNDATED_RECEIVABLE = {
  id: "cobro-simulado-sin-fecha",
  label: "Factura pendiente · fecha por confirmar",
  customerName: "Distribuidora del Sur SpA",
  amount: 185_000,
  classification: "Clientes",
} as const;

export const DEMO_OVERDUE_RECEIVABLES = [
  {
    id: "cobro-simulado-vencido",
    daysOverdue: 6,
    label: "Factura vencida · asesoría mensual",
    customerName: "Servicios Andinos Ltda.",
    customerRut: "76.543.210-3",
    invoiceReference: "Factura 20001",
    amount: 245_000,
    classification: "Servicios",
  },
  {
    id: "cobro-simulado-vencido-soporte",
    daysOverdue: 3,
    label: "Cobro vencido · soporte técnico",
    customerName: "Comercial Los Aromos SpA",
    customerRut: "77.234.567-4",
    invoiceReference: "Factura 20002",
    amount: 320_000,
    classification: "Servicios",
  },
  {
    id: "cobro-simulado-vencido-consultoria",
    daysOverdue: 12,
    label: "Factura vencida · consultoría comercial",
    customerName: "Inversiones Santa Elena Ltda.",
    customerRut: "77.456.789-5",
    invoiceReference: "Factura 20003",
    amount: 580_000,
    classification: "Clientes",
  },
  {
    id: "cobro-simulado-vencido-implementacion",
    daysOverdue: 21,
    label: "Cobro vencido · implementación de sistema",
    customerName: "Distribuidora del Sur SpA",
    customerRut: "76.234.567-6",
    invoiceReference: "Factura 20004",
    amount: 890_000,
    classification: "Clientes",
  },
  {
    id: "cobro-simulado-vencido-mantencion",
    daysOverdue: 34,
    label: "Factura vencida · mantenimiento de equipos",
    customerName: "Talleres del Pacífico Ltda.",
    customerRut: "77.345.678-K",
    invoiceReference: "Factura 20005",
    amount: 175_000,
    classification: "Servicios",
  },
] as const;

export const DEMO_OVERDUE_RECEIVABLE_TOTAL = DEMO_OVERDUE_RECEIVABLES.reduce(
  (total, receivable) => total + receivable.amount,
  0,
);

export const DEMO_CASH_FLOW_TRANSACTIONS: DemoCashFlowTransaction[] = [
  {
    id: "opening-capital-bice",
    description: "Aporte de capital inicial · BICE",
    inflow: "1500000",
    outflow: "0",
    date: DEMO_OPENING_CAPITAL_DATE,
    bankId: "bice",
    category: "Capital",
    classification: "Capital inicial · BICE",
  },
  {
    id: "opening-capital-chile",
    description: "Aporte de capital inicial · Banco de Chile",
    inflow: "1000000",
    outflow: "0",
    date: DEMO_OPENING_CAPITAL_DATE,
    bankId: "banco-de-chile",
    category: "Capital",
    classification: "Capital inicial · Banco de Chile",
  },
  {
    id: "opening-capital-santander",
    description: "Aporte de capital inicial · Santander",
    inflow: "500000",
    outflow: "0",
    date: DEMO_OPENING_CAPITAL_DATE,
    bankId: "santander",
    category: "Capital",
    classification: "Capital inicial · Santander",
  },
  {
    id: "working-capital-credit-july",
    description: "Desembolso de crédito de capital de trabajo · Banco Local",
    inflow: "750000",
    outflow: "0",
    date: "2026-07-15",
    bankId: "santander",
    category: "Financiamiento",
    classification: "Crédito bancario",
  },
  {
    id: "used-equipment-july",
    description: "Compra de equipo usado para la operación",
    inflow: "0",
    outflow: "420000",
    date: "2026-07-22",
    bankId: "banco-de-chile",
    category: "Inversión",
    classification: "Equipamiento",
  },
  {
    id: "working-capital-credit-payment-august",
    description: "Abono a crédito de capital de trabajo",
    inflow: "0",
    outflow: "180000",
    date: "2026-08-05",
    bankId: "santander",
    category: "Financiamiento",
    classification: "Crédito bancario",
  },
  {
    id: "additional-owner-capital-august",
    description: "Aporte adicional de los socios",
    inflow: "200000",
    outflow: "0",
    date: "2026-08-28",
    bankId: "banco-de-chile",
    category: "Capital",
    classification: "Capital adicional",
  },
  {
    id: "revolving-credit-september",
    description: "Desembolso de crédito rotativo · Banco Local",
    inflow: "300000",
    outflow: "0",
    date: "2026-09-10",
    bankId: "bice",
    category: "Financiamiento",
    classification: "Crédito bancario",
  },
  {
    id: `supplier-payment-33-${DEMO_SUPPLIER_PURCHASE.folio}`,
    description: `Pago de compra de inventario · ${DEMO_SUPPLIER_PURCHASE.supplierName}`,
    inflow: "0",
    outflow: String(DEMO_SUPPLIER_PURCHASE.total),
    date: DEMO_SUPPLIER_PURCHASE.paidDate,
    bankId: "bice",
    category: "Egresos",
    classification: "Proveedores",
  },
  ...(DEMO_CUSTOMER_SALE.collected
    ? [
        {
          id: `customer-collection-33-${DEMO_CUSTOMER_SALE.folio}`,
          description: `Cobro de venta · ${DEMO_CUSTOMER_SALE.customerName}`,
          inflow: String(DEMO_CUSTOMER_SALE.total),
          outflow: "0",
          date: DEMO_CUSTOMER_SALE.paidDate,
          bankId: "bice",
          category: "Ingresos",
          classification: "Clientes",
        },
      ]
    : []),
  ...[
    {
      id: "demo-paid-rent-2026-09-24",
      description: "Pago de arriendo de oficina · Inmobiliaria Centro Ltda.",
      amount: 480_000,
      date: "2026-09-24",
      classification: "Arriendo",
    },
    {
      id: "demo-paid-electricity-2026-09-21",
      description: "Factura de electricidad · CGE",
      amount: 126_500,
      date: "2026-09-21",
      classification: "Servicios básicos",
    },
    {
      id: "demo-paid-materials-2026-09-19",
      description: "Compra de materiales · Comercializadora Andina",
      amount: 327_000,
      date: "2026-09-19",
      classification: "Proveedores",
    },
    {
      id: "demo-paid-internet-2026-09-15",
      description: "Plan de internet empresa · Mundo Telecom",
      amount: 45_000,
      date: "2026-09-15",
      classification: "Telecomunicaciones",
    },
    {
      id: "demo-paid-payroll-2026-09-12",
      description: "Pago de remuneraciones · Equipo operativo",
      amount: 1_250_000,
      date: "2026-09-12",
      classification: "Remuneraciones",
    },
    {
      id: "demo-paid-accounting-2026-09-05",
      description: "Servicios contables · Estudio Rivera",
      amount: 180_000,
      date: "2026-09-05",
      classification: "Honorarios",
    },
    {
      id: "demo-paid-previred-2026-08-21",
      description: "Cotizaciones previsionales · Previred",
      amount: 285_000,
      date: "2026-08-21",
      classification: "Previred",
    },
    {
      id: "demo-paid-software-2026-08-04",
      description: "Licencias de software · Microsoft 365",
      amount: 89_900,
      date: "2026-08-04",
      classification: "Software",
    },
    {
      id: "demo-paid-maintenance-2026-07-19",
      description: "Mantención de equipos · TecnoSur",
      amount: 215_000,
      date: "2026-07-19",
      classification: "Mantención",
    },
    {
      id: "demo-paid-cleaning-2026-07-01",
      description: "Servicio de aseo · LimpioSur",
      amount: 155_000,
      date: "2026-07-01",
      classification: "Servicios generales",
    },
  ].map((item) => ({
    id: item.id,
    description: item.description,
    inflow: "0",
    outflow: String(item.amount),
    date: item.date,
    bankId: "bice",
    category: "Egresos",
    classification: item.classification,
  })),
  ...[
    {
      id: "demo-collected-support-2026-09-20",
      description: "Cobro de factura · mantención mensual",
      amount: 285_000,
      date: "2026-09-20",
    },
    {
      id: "demo-collected-support-2026-09-18",
      description: "Cobro de factura · servicio de soporte",
      amount: 320_000,
      date: "2026-09-18",
    },
    {
      id: "demo-collected-software-2026-09-12",
      description: "Cobro de venta · licencias de software",
      amount: 420_000,
      date: "2026-09-12",
    },
    {
      id: "demo-collected-consulting-2026-09-05",
      description: "Cobro de factura · asesoría mensual",
      amount: 650_000,
      date: "2026-09-05",
    },
    {
      id: "demo-collected-project-2026-08-28",
      description: "Cobro de proyecto · implementación comercial",
      amount: 780_000,
      date: "2026-08-28",
    },
    {
      id: "demo-collected-design-2026-08-16",
      description: "Abono de proyecto · diseño de catálogo",
      amount: 510_000,
      date: "2026-08-16",
    },
    {
      id: "demo-collected-infrastructure-2026-08-04",
      description: "Cobro de factura · soporte de infraestructura",
      amount: 295_000,
      date: "2026-08-04",
    },
    {
      id: "demo-collected-administration-2026-07-22",
      description: "Cobro de servicio · asesoría administrativa",
      amount: 370_000,
      date: "2026-07-22",
    },
    {
      id: "demo-collected-training-2026-07-09",
      description: "Cobro de servicio · capacitación de personal",
      amount: 225_000,
      date: "2026-07-09",
    },
  ].map((item) => ({
    id: item.id,
    description: item.description,
    inflow: String(item.amount),
    outflow: "0",
    date: item.date,
    bankId: "bice",
    category: "Ingresos",
    classification: "Clientes",
  })),
];

/* El saldo actual se obtiene de los movimientos simulados, incluido el aporte inicial. */
export const DEMO_CURRENT_BALANCE = String(
  DEMO_CASH_FLOW_TRANSACTIONS.reduce(
    (saldo, transaction) => saldo + Number(transaction.inflow) - Number(transaction.outflow),
    0,
  ),
);

/* Una venta emitida y una compra recibida; no se ha presentado declaración ni pagado IVA. */
export const DEMO_SII_DOCUMENTS = {
  period: "2026-09",
  emitted: {
    count: 1,
    total: DEMO_CUSTOMER_SALE.total,
    iva: DEMO_CUSTOMER_SALE.vat,
  },
  received: { count: 1, total: DEMO_SUPPLIER_PURCHASE.total, iva: DEMO_SUPPLIER_PURCHASE.vat },
} as const;

export function demoAmountFor(description: string): number {
  return DEMO_CASH_FLOW_TRANSACTIONS.filter(
    (transaction) => transaction.description === description,
  ).reduce((total, transaction) => total + Number(transaction.outflow), 0);
}
