import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { F29BridgeResponse, F29PaymentApplication, F29PaymentLink } from "@/lib/api/sii";
import { F29BridgePanel } from "./f29-bridge-panel";

/* Stories del puente F29 (D13, issue #202). Lo que cubren, y por qué ESTAS y no otras:

   Los CINCO valores que la descripción del contrato admite para `payment_state`
   (`paid | partial | pending | deferred | unknown`) más un sexto caso que el contrato hace posible
   y ninguna rama declarada cubre: un valor fuera del contrato. `payment_state` NO es un enum en el
   OpenAPI —los cinco valores viven sólo en la descripción del campo y `types.ts` lo genera como
   `string`—, así que un valor nuevo del productor llega sin que el tipo lo detenga. La story
   `EstadoFueraDelContrato` fija cómo se ve ese día: la etiqueta desaparece y el residual completo
   queda al frente, sin que la pantalla clasifique nada por defecto.

   Y las dos ramas que esta pantalla va a ejercer PRIMERO en producción, porque las cuatro tablas
   del bridge están hoy en cero filas: `ResidualNoComputable` (el código 91 todavía no observado, o
   sea `unexplained_delta` en null) y `AusenciaExplicita` (nadie declaró movimiento ni comprobante).
   Son justo las dos donde una pantalla financiera se queda callada, y las dos que acá muestran su
   número completo con la descripción de qué cubre.

   Cada story es el gemelo visual de otra: `Reconciliado` contra `PorPagarConDiferencia` (cero NO se
   rotula como diferencia), `PagadoEnCuotas` contra `AusenciaExplicita` (las dos traen
   `bank_movement_id` null y tienen que verse distinto, o un F29 pagado en dos veces se leería igual
   que uno que nadie pagó). Si alguien colapsa esas distinciones, el diff visual lo muestra. */

/* ── El caso REAL medido en producción ──────────────────────────────────────
   Folio 9238206586, período 2026-07. IVA débito 7.213.010, crédito NULL, PPM 52.519: los códigos
   observados suman 7.265.529. El total oficial (código 91) es 7.450.761. Y como el contrato define
   `unexplained_delta = composed_total − declaration_total`, el valor del período es −185.232. */
const TOTAL_OFICIAL = 7_450_761;
const DELTA_REAL = -185_232;

function cuota(over: Partial<F29PaymentApplication> = {}): F29PaymentApplication {
  return {
    application_kind: "bank_movement",
    applied_amount: "4000000",
    applied_at: "2026-08-20T00:00:00Z",
    declared_at: "2026-08-21T00:00:00Z",
    currency: "CLP",
    provenance: "bank_movement_declared",
    ...over,
  };
}

function vinculo(over: Partial<F29PaymentLink> = {}): F29PaymentLink {
  return {
    applications: [],
    bank_evidence: { applied_amount: "0", bank_movement_id: null },
    declaration_receipt: {
      folio: 9238206586,
      declaration_total: TOTAL_OFICIAL,
      source: "sii_f29_pdf",
    },
    evidence_declared: 0,
    evidence_required: 1,
    missing_requirements: ["bank_movement_declared"],
    payment_state: "pending",
    ...over,
  };
}

function bridge(over: Partial<F29BridgeResponse> = {}): F29BridgeResponse {
  return {
    declaration_id: "decl-9238206586",
    folio: 9238206586,
    period_year: 2026,
    period_month: 7,
    observed_at: "2026-08-14T10:00:00Z",
    data_state: "partial",
    declaration_total: TOTAL_OFICIAL,
    official_components: { code_538: 7_213_010, code_537: null, code_62: 52_519 },
    payment: vinculo(),
    payment_state: "pending",
    reconciled: false,
    unexplained_delta: DELTA_REAL,
    ...over,
  };
}

/** Un pago completo con UN movimiento bancario declarado: la primera de las tres lecturas. */
function pagadoConMovimiento(): F29PaymentLink {
  return vinculo({
    payment_state: "paid",
    evidence_declared: 1,
    missing_requirements: [],
    bank_evidence: {
      applied_amount: String(TOTAL_OFICIAL),
      bank_movement_id: "mov-7f3a",
      currency: "CLP",
      linked_at: "2026-08-20T00:00:00Z",
      provenance: "bank_movement_declared",
    },
    applications: [cuota({ applied_amount: String(TOTAL_OFICIAL), bank_movement_id: "mov-7f3a" })],
  });
}

const meta = {
  title: "Impuestos/F29BridgePanel",
  component: F29BridgePanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof F29BridgePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ─────────────────── Los cinco estados de pago del contrato ─────────────────── */

/** `paid`: el período está cubierto y un movimiento bancario declarado lo respalda. El residual es
 *  cero porque las cuotas cubren el total, no porque la etiqueta diga "pagado". */
export const Pagado: Story = {
  args: {
    bridge: bridge({
      payment_state: "paid",
      reconciled: true,
      data_state: "complete",
      unexplained_delta: 0,
      payment: pagadoConMovimiento(),
    }),
  },
};

/** `partial`: dos cuotas declaradas cubren parte del cobro. El residual es la resta entre hechos
 *  declarados —total oficial menos la suma de las cuotas—, nunca una estimación. */
export const PagadoEnParte: Story = {
  args: {
    bridge: bridge({
      payment_state: "partial",
      payment: vinculo({
        payment_state: "partial",
        evidence_declared: 2,
        missing_requirements: [],
        bank_evidence: { applied_amount: "5000000", bank_movement_id: null, currency: "CLP" },
        applications: [
          cuota({ applied_amount: "4000000", bank_movement_id: "mov-7f3a" }),
          cuota({
            applied_amount: "1000000",
            applied_at: "2026-09-10T00:00:00Z",
            declared_at: "2026-09-11T00:00:00Z",
            application_kind: "declaration_receipt",
            bank_movement_id: null,
            provenance: "manual_receipt_declared",
            receipt_reference: "OP-884120",
          }),
        ],
      }),
    }),
  },
};

/** `pending` con la diferencia no explicada del período real: los códigos del F29 suman 185.232
 *  MENOS que lo que cobra el SII, y esa parte del cobro no la explica ningún código. */
export const PorPagarConDiferencia: Story = {
  args: { bridge: bridge() },
};

/** `deferred`: el período postergó el IVA. Debe algo todavía, y el residual lo dice con su monto. */
export const ConIvaPostergado: Story = {
  args: {
    bridge: bridge({
      payment_state: "deferred",
      official_components: {
        code_538: 7_213_010,
        code_537: null,
        code_62: 52_519,
        code_755: 400_000,
      },
      payment: vinculo({ payment_state: "deferred" }),
    }),
  },
};

/** `unknown`: el productor AFIRMA no saber cuánto se pagó. Es un hecho declarado, distinto de un
 *  valor que no se puede leer, y por eso sí lleva etiqueta propia. */
export const ProductorDeclaraNoSaber: Story = {
  args: {
    bridge: bridge({
      payment_state: "unknown",
      payment: vinculo({ payment_state: "unknown" }),
    }),
  },
};

/* ───────────── El sexto caso: un valor que el contrato no describe ───────────── */

/** El gemelo de las cinco de arriba. `payment_state` se genera como `string`, así que un valor nuevo
 *  del productor entra sin que el tipo lo detenga. Acá NO se mapea a `unknown` —eso convertiría algo
 *  ilegible en una afirmación del productor—: la etiqueta cae a "Cuánto queda por pagar" y el
 *  residual completo queda al frente. */
export const EstadoFueraDelContrato: Story = {
  args: {
    bridge: bridge({
      payment_state: "en_revision_manual",
      payment: vinculo({ payment_state: "en_revision_manual" }),
    }),
  },
};

/* ──────── Las dos ramas que producción ejerce primero (tablas en cero) ──────── */

/** `unexplained_delta` en null: el código 91 todavía no está observado, así que la resta no se puede
 *  hacer. No muestra cero: muestra el residual completo y qué falta para computarlo. */
export const ResidualNoComputable: Story = {
  args: {
    bridge: bridge({
      data_state: "observations_only",
      declaration_total: null,
      unexplained_delta: null,
      payment: vinculo({
        declaration_receipt: { folio: 9238206586, declaration_total: null, source: "sii_f29_pdf" },
        missing_requirements: ["declaration_total_observation", "bank_movement_declared"],
        residual_amount: null,
      }),
    }),
  },
};

/** La AUSENCIA EXPLÍCITA: `bank_movement_id` null con `applications` vacía. Nadie declaró nada.
 *  Gemelo visual de `PagadoEnCuotas`, que trae el mismo null y significa lo contrario. */
export const AusenciaExplicita: Story = {
  args: { bridge: bridge({ payment: vinculo() }) },
};

/** La tercera lectura: `bank_movement_id` null CON aplicaciones. Se pagó, y ningún movimiento único
 *  representa el pago completo. Cada cuota con lo que cubrió. */
export const PagadoEnCuotas: Story = {
  args: {
    bridge: bridge({
      payment_state: "paid",
      reconciled: true,
      data_state: "complete",
      unexplained_delta: 0,
      payment: vinculo({
        payment_state: "paid",
        evidence_declared: 2,
        missing_requirements: [],
        bank_evidence: {
          applied_amount: String(TOTAL_OFICIAL),
          bank_movement_id: null,
          currency: "CLP",
        },
        applications: [
          cuota({ applied_amount: "3450761", bank_movement_id: "mov-7f3a" }),
          cuota({
            applied_amount: "4000000",
            applied_at: "2026-09-10T00:00:00Z",
            declared_at: "2026-09-11T00:00:00Z",
            application_kind: "declaration_receipt",
            bank_movement_id: null,
            provenance: "manual_receipt_declared",
            receipt_reference: "OP-884120",
          }),
        ],
      }),
    }),
  },
};

/** Cero NO se rotula como diferencia: es el hecho de que los códigos explican el total completo.
 *  Gemelo de `PorPagarConDiferencia` y de `ResidualNoComputable`: los tres parten del mismo campo. */
export const Reconciliado: Story = {
  args: {
    bridge: bridge({
      reconciled: true,
      data_state: "complete",
      unexplained_delta: 0,
      official_components: { code_538: 7_398_242, code_537: null, code_62: 52_519 },
      payment: pagadoConMovimiento(),
    }),
  },
};

/** La diferencia del enunciado de #202 (−239.604), como caso de forma: la pantalla tiene que leerse
 *  igual con cualquier magnitud, y el signo se dice en palabras en vez de dejarlo interpretar. */
export const DiferenciaDelEnunciado: Story = {
  args: { bridge: bridge({ unexplained_delta: -239_604 }) },
};

/** La dirección contraria: los códigos suman MÁS que el cobro. Gemelo de la story de arriba — si
 *  alguien borra la dirección y deja sólo la magnitud, estas dos quedan idénticas. */
export const CodigosSobreElCobro: Story = {
  args: { bridge: bridge({ unexplained_delta: 185_232 }) },
};
