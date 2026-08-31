"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Pill } from "@/components/rediseno/pill";
import { RedisenoTable, TablePrimaryCell } from "@/components/rediseno/table";
import type { PillProps } from "@/components/rediseno/pill";
import type { FilaHubV12, TonoEstadoV12 } from "./administracion-v12-model";

/* V12 · Administración — la vista PRESENTACIONAL del hub (rediseño Fase 2, issue #75).
 *
 * PURA de datos: recibe las filas ya resueltas (`FilaHubV12[]`) y las pinta como la "tabla
 * estándar" del rediseño (§1.3). Sin fetch ni mutación propia — eso vive en
 * `AdministracionV12Live`, igual que en V05/V08. */

const TONO_A_VARIANTE: Record<TonoEstadoV12, PillProps["variant"]> = {
  ok: "ok",
  warn: "warn",
  neutral: "mut",
  bad: "bad",
};

export interface AdministracionV12ViewProps {
  filas: FilaHubV12[];
}

export function AdministracionV12View({ filas }: AdministracionV12ViewProps) {
  const columns = React.useMemo<ColumnDef<FilaHubV12, unknown>[]>(
    () => [
      {
        id: "titulo",
        accessorFn: (f) => f.titulo,
        header: "Módulo",
        meta: { principal: true },
        cell: ({ row }) => (
          <TablePrimaryCell
            value={row.original.titulo}
            /* Ley 7 (hallazgo de revisión PR #95): el `.sub` de `TablePrimaryCell` trunca con
               `nowrap` por default — en layout AUTOMÁTICO eso fija el ancho MÍNIMO de la columna
               en la descripción entera (medido: 401 px de desborde a 360, la más larga es
               "Ordena tus ingresos, costos, gastos, caja y obligaciones, partiendo de una base
               sugerida."). Mismo criterio que `cobrar-v04-view.tsx`: envolver, no truncar, cuando
               el contenedor angosta (`@container` ya lo trae `RedisenoTable`). */
            sub={
              <span className="@max-[640px]:whitespace-normal" title={row.original.descripcion}>
                {row.original.descripcion}
              </span>
            }
          />
        ),
      },
      {
        id: "estado",
        accessorFn: (f) => f.estado?.texto ?? "",
        header: "Estado",
        /* Ley 7 (hallazgo de revisión vuelta 3, PR #95): la pill de esta columna es
           `whitespace-nowrap` (`Pill`, primitivo compartido — no se toca) y `table-layout: auto`
           dimensiona la columna ENTERA según su fila más larga: "1 requiere tu acción → Renovar"
           (Credenciales) fija el ancho de la columna en las OCHO filas, aunque la mayoría diga
           "2 empresas". Medido con un decorator de 320 px: la fila del título mide 97 px, "Ver"
           mide 39 px, y esta columna sola 203 px — 339 px de mínimo contra 318 disponibles (21 px
           de desborde, el mismo número que reportó la revisión en Windows a 320; en Linux con
           fuentes más anchas el mínimo era mayor y el desborde llegaba a 37 px a 360).

           Envolver la pill (en vez de colapsar la columna) no es una opción sana: una `rounded-full`
           con texto en dos líneas se ve rota, y es el MISMO criterio que ya usa
           `cobrar-v04-view.tsx` para su columna "Antigüedad" (también una `Pill`, también
           `hideBelowTable`). El dato primario (`título`) nunca colapsa; éste es exactamente el
           accesorio que sí — nada queda inalcanzable: "Ver" sigue llevando a la fila completa,
           con su estado, en la pantalla del módulo. */
        meta: { hideBelowTable: "sm" },
        cell: ({ row }) => {
          const estado = row.original.estado;
          if (!estado) {
            /* Hueco declarado (ver el modelo): sin una señal barata y honesta que resumir, no se
               pinta ni pill ni "—" con aire de estado — se deja la celda en blanco. */
            return null;
          }
          return <Pill variant={TONO_A_VARIANTE[estado.tono]}>{estado.texto}</Pill>;
        },
      },
      {
        id: "accion",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <Link
            href={row.original.href}
            className="text-[12.5px] font-bold text-rediseno-azul hover:underline"
          >
            Ver
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <RedisenoTable
      columns={columns}
      data={filas}
      countNoun={filas.length === 1 ? "módulo" : "módulos"}
      emptyMessage="No hay módulos que mostrar."
      /* Ley 7 (hallazgo de revisión PR #95): sin esto, `RedisenoTable` NO agrega la clase
         `@container` a su wrapper (es opt-in, ver su propio comentario), así que el
         `@max-[640px]:whitespace-normal` del `.sub` de arriba nunca tiene contra qué evaluar y
         la descripción se queda `nowrap` — mide 401 px de desborde a 360. */
      celdasCompactasEnAngosto
    />
  );
}
