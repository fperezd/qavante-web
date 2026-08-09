import { DeudasTgrView } from "@/components/pagar/deudas-tgr-view";

/* `/pagar/impuestos/tgr` — Deudas fiscales con la Tesorería (TGR), dentro de
   "Impuestos y TGR". La vista degrada honesto ("en preparación") hasta que el
   backend exponga TGR server-side (api#758); no gateamos por flag porque el
   propio estado de conexión hace de gate honesto. Sin `export const runtime`. */
export default function PagarImpuestosTgrPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Deudas TGR</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Tus deudas con la Tesorería General de la República, giros, multas, PPM e IVA impago, con
          su saldo y vencimiento.
        </p>
      </header>

      <DeudasTgrView />
    </div>
  );
}
