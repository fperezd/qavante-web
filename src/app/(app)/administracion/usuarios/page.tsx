"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { UserPlus, Users, AlertCircle } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";
import { useMe, useMyPermissions, useUsers, type User } from "@/lib/api/users";
import { asUserRole } from "@/lib/auth/types";
import { hasPermission, PERM_ASIGNAR_OWNER } from "@/lib/auth/permissions";
import { UsersTable } from "@/components/administracion/users-table";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";

/* Dialogs lazy: sólo descargan el chunk cuando el user los abre.
   Atiende hallazgo audit K.4 #2 (admin-only bundles al borde del
   budget) — separa react-hook-form + zod + base-ui Dialog del First
   Load JS. ssr:false porque los dialogs son interactivos client-only. */
const InviteUserDialog = dynamic(
  () =>
    import("@/components/administracion/invite-user-dialog").then((m) => ({
      default: m.InviteUserDialog,
    })),
  { ssr: false },
);
const SuspendUserDialog = dynamic(
  () =>
    import("@/components/administracion/suspend-user-dialog").then((m) => ({
      default: m.SuspendUserDialog,
    })),
  { ssr: false },
);

/* /app/administracion/usuarios (C0-15).
   - Permiso: gobernado por permisos reales (`/api/users/me/permissions`, ver #591) + 403 backend
     en GET /api/users + el sidebar (oculta el módulo).
   - Backend endpoints VIVOS en prod (aceptan cookie): GET/POST /api/users, PATCH /api/users/{id},
     GET /api/users/me/permissions. */
export default function UsuariosPage() {
  const usersQuery = useUsers();
  /* Rol del usuario logueado: gobierna si se puede asignar `owner` (solo un owner transfiere la
     propiedad). Sin esto, `currentUserRole` llegaba undefined a la tabla y al dialog → la rama
     "salvo que vos seas owner" de users-table.tsx era código muerto y NADIE podía asignar owner,
     ni el dueño. Query aparte: si /api/me falla, la lista igual se ve (y sin rol se cae a la rama
     conservadora, que es la segura). */
  const me = useMe();
  /* Permisos REALES del backend (registry PERMISSIONS_BY_ROLE), en vez de adivinar por rol con
     tablas hardcodeadas en el FE (el "falso permiso" del audit §13.4). El owner trae el wildcard `*`.
     Fallback al rol solo si /me/permissions no cargó, para no bloquear al owner ante un fetch caído. */
  const perms = useMyPermissions();
  const currentUserRole = asUserRole(me.data?.user.role);
  const canAssignOwner = perms.data
    ? hasPermission(perms.data.permissions, PERM_ASIGNAR_OWNER)
    : currentUserRole === "owner";
  // Mostrar "Invitar" salvo que los permisos digan explícitamente que no puede. Sin permisos → se
  // muestra (el backend igual impone 403 en POST /api/users): no escondemos la acción por un fetch caído.
  const canInvite = perms.data ? hasPermission(perms.data.permissions, "users.invite") : true;
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [suspendTarget, setSuspendTarget] = React.useState<User | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-dark">Usuarios</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            ¿Quién accede a la información de mi empresa?
          </p>
        </div>
        {canInvite && (
          <QavanteButton
            onClick={() => setInviteOpen(true)}
            disabled={usersQuery.isLoading || usersQuery.isError}
          >
            <UserPlus className="h-4 w-4" />
            Invitar usuario
          </QavanteButton>
        )}
      </header>

      {usersQuery.isLoading && <LoadingSkeleton />}

      {usersQuery.isError && <ErrorState error={usersQuery.error} />}

      {usersQuery.data && usersQuery.data.items.length === 0 && (
        <QavanteEmpty
          icon={Users}
          title="Todavía no invitaste a nadie"
          description="Invita a tu primer usuario para colaborar en la gestión financiera de tu empresa."
          cta={
            <QavanteButton onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invita al primer usuario
            </QavanteButton>
          }
        />
      )}

      {usersQuery.data && usersQuery.data.items.length > 0 && (
        <UsersTable
          users={usersQuery.data.items}
          canAssignOwner={canAssignOwner}
          onSuspendClick={(u) => setSuspendTarget(u)}
        />
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} canAssignOwner={canAssignOwner} />

      <SuspendUserDialog
        user={suspendTarget}
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSuspendTarget(null);
        }}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-md bg-neutral-light/30"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? apiErrorToUserMessage(error)
      : "No pudimos cargar la lista de usuarios.";
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" />
      <div>
        <p className="font-medium">No pudimos cargar la lista</p>
        <p className="mt-1 text-neutral-mid">{message}</p>
        <p className="mt-2 text-xs text-neutral-mid">
          Reintenta en unos segundos. Si el problema persiste, avisa a soporte.
        </p>
      </div>
    </div>
  );
}
