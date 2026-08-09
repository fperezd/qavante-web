import { cn } from "@/lib/utils";

/* "R" de factura RECLAMADA en el SII (#744, pedido de Fernando: transparencia, no excluir en
   silencio). El receptor rechazó el documento → no cuenta como costo/crédito/ingreso y su monto
   queda en $0. Se pinta junto al folio donde aparezca la factura (Proveedores, Libro de Compras,
   Clientes, Libro de Ventas). Mismo criterio en compras y ventas. */
export function ReclamadaBadge({ className }: { className?: string }) {
  return (
    <span
      title="Reclamada en el SII, no cuenta como costo/crédito/ingreso (monto $0)"
      aria-label="Reclamada en el SII"
      className={cn(
        "inline-flex size-[15px] shrink-0 items-center justify-center rounded bg-danger-500/15 text-[10px] font-bold leading-none text-danger-500",
        className,
      )}
    >
      R
    </span>
  );
}
