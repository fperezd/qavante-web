"use client";

import * as React from "react";
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { StatusBadge } from "./status-badge";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "./role-labels";
import type { User } from "@/lib/api/users";
import { useUpdateUser } from "@/lib/api/users";
import type { UserRole } from "@/lib/auth/types";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";

interface UsersTableProps {
  users: User[];
  currentUserRole?: UserRole;
  onSuspendClick: (user: User) => void;
}

export function UsersTable({ users, currentUserRole, onSuspendClick }: UsersTableProps) {
  const update = useUpdateUser();
  const [editingRole, setEditingRole] = React.useState<string | null>(null);

  const columns = React.useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nombre",
        cell: ({ row }) => (
          <span className="font-medium text-neutral-dark">
            {row.original.name ?? <span className="italic text-neutral-mid">Sin nombre</span>}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <span className="text-neutral-dark">{row.original.email}</span>,
      },
      {
        accessorKey: "role",
        header: "Rol",
        cell: ({ row }) => {
          const u = row.original;
          const roleOptions = ASSIGNABLE_ROLES.filter(
            (r) => r !== "owner" || currentUserRole === "owner",
          );
          /* Solo es editable si el rol ACTUAL está entre los asignables por el
             usuario actual. owner (salvo que vos seas owner) y technical_admin
             NO se editan acá: un <select> controlado sin <option> que matchee
             su `value` mostraría un rol equivocado y, al elegir, podría
             DEGRADAR el rol en silencio (code-review #10). Si no es editable,
             se muestra read-only. */
          const canEditRole = roleOptions.includes(u.role);

          if (!canEditRole) {
            return <span className="text-sm text-neutral-dark">{ROLE_LABELS[u.role]}</span>;
          }

          if (editingRole === u.id) {
            return (
              <select
                autoFocus
                value={u.role}
                onChange={async (e) => {
                  const newRole = e.target.value as UserRole;
                  try {
                    await update.mutateAsync({ id: u.id, body: { role: newRole } });
                  } finally {
                    setEditingRole(null);
                  }
                }}
                onBlur={() => setEditingRole(null)}
                className="h-8 rounded-md border border-neutral-light bg-surface px-2 text-sm"
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <button
              type="button"
              onClick={() => setEditingRole(u.id)}
              className="text-sm text-neutral-dark underline-offset-4 hover:underline"
              aria-label={`Cambiar rol de ${u.email}`}
            >
              {ROLE_LABELS[u.role]}
            </button>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "last_login_at",
        header: "Último login",
        cell: ({ row }) => {
          const v = row.original.last_login_at;
          if (!v) return <span className="text-sm text-neutral-mid">—</span>;
          /* Guard: un last_login_at no-ISO/corrupto haría que date-fns `format`
             lance RangeError y rompa el render de TODA la tabla (no hay error
             boundary de segmento). Caer a "—" como con null (code-review #3). */
          const d = new Date(v);
          if (Number.isNaN(d.getTime())) return <span className="text-sm text-neutral-mid">—</span>;
          return (
            <span className="text-sm text-neutral-dark">
              {format(d, "dd MMM yyyy HH:mm", { locale: es })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => {
          const u = row.original;
          const label =
            u.status === "suspended"
              ? "Reactivar"
              : u.status === "invited"
                ? "Cancelar invitación"
                : "Suspender";
          return (
            <div className="flex justify-end">
              <QavanteButton
                size="sm"
                variant="ghost"
                onClick={() => onSuspendClick(u)}
                aria-label={`${label} ${u.email}`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="ml-1 hidden md:inline">{label}</span>
              </QavanteButton>
            </div>
          );
        },
      },
    ],
    [editingRole, update, currentUserRole, onSuspendClick],
  );

  const table = useReactTable({ data: users, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-light bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-light bg-neutral-light/30 text-xs font-medium uppercase tracking-wide text-neutral-mid">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-4 py-3">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, idx) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-neutral-light/40 last:border-b-0 hover:bg-neutral-light/20",
                idx % 2 === 0 ? "bg-surface" : "bg-neutral-light/10",
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
