import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* Índice del recorrido. Cada tarjeta dice QUÉ PROPONE la maqueta, no sólo cómo se llama:
   la propuesta es lo que hay que poder discutir sin abrirla. */
const MAQUETAS = [
  {
    href: "/maquetas/inicio",
    titulo: "Inicio",
    propone:
      "Ordenar la portada en seis pasos numerados: plata disponible hoy, si alcanza para los compromisos de 14 días, pulso y resultado, las tres acciones del día, y la resta que forma el faltante (saldo + cobros − compromisos) con el origen de cada componente.",
    estado: "Pantalla fija: ilustra el orden de lectura, sin filtros ni tablas que respondan.",
  },
  {
    href: "/maquetas/cobros",
    titulo: "Cobros",
    propone:
      "Leer la cobranza por CALENDARIO en vez de por cliente: pestañas Pendientes / Vencidos / Realizados y un horizonte de 7, 14, 30 o 90 días. Separa los cobros con fecha de los que tienen la fecha por confirmar, en vez de meterlos en el mismo total.",
    estado: "Recorrible: las pestañas y el horizonte cambian las cifras y la tabla.",
  },
  {
    href: "/maquetas/pagos",
    titulo: "Pagos",
    propone:
      "El mismo calendario para el lado que paga: Pendientes y Realizados, horizonte de 7 a 90 días, próximo vencimiento y un historial con filtro por mes.",
    estado: "Recorrible: las pestañas, el horizonte y el filtro por mes responden.",
  },
  {
    href: "/maquetas/banco",
    titulo: "Banco",
    propone:
      "Una sola pantalla con los saldos agrupados por banco y cuenta, la evolución del saldo, las tarjetas de crédito con cupo usado y fecha de vencimiento, y los movimientos filtrables por banco.",
    estado:
      "Recorrible: el filtro por banco, el alta de tarjeta y el listado de movimientos responden.",
  },
];

export default function MaquetasPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Maquetas de experiencia</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Propuestas de pantalla para recorrer y decidir. Todas usan cifras de ejemplo y ninguna
          reemplaza a la pantalla que muestra tus números.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {MAQUETAS.map((maqueta) => (
          <Link
            key={maqueta.href}
            href={maqueta.href}
            className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-neutral-dark">{maqueta.titulo}</h2>
              <ArrowRight
                className="h-4 w-4 text-neutral-mid transition group-hover:translate-x-0.5 group-hover:text-brand-primary"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm leading-6 text-neutral-mid">{maqueta.propone}</p>
            <p className="text-xs font-medium text-neutral-mid">{maqueta.estado}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
