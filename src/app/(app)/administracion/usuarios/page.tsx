"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { UserPlus, Users, AlertCircle } from "lucide-react";
import { QavanteEmpty, QavanteButton } from "@/components/qavante";
import { useMe, useUsers, type User } from "@/lib/api/users";
import { asUserRole } from "@/lib/auth/types";
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
   - Permiso: admin/owner. El gating fino vive en GET /api/users (403 backend)
     y en el sidebar (oculta el módulo). Esta página no re-implementa el gate.
   - Backend endpoints (qavante-api): GET /api/users, POST /api/users,
     PATCH /api/users/{id} — pendientes hasta C0-14. La UI renderiza el
     estado de error con copys del Anexo C.3 mientras BE no esté arriba. */
export default function UsuariosPage() {
  const usersQuery = useUsers();
  /* Rol del usuario logueado: gobierna si se puede asignar `owner` (solo un owner transfiere la
     propiedad). Sin esto, `currentUserRole` llegaba undefined a la tabla y al dialog → la rama
     "salvo que vos seas owner" de users-table.tsx era código muerto y NADIE podía asignar owner,
     ni el dueño. Query aparte: si /api/me falla, la lista igual se ve (y sin rol se cae a la rama
     conservadora, que es la segura). */
  const me = useMe();
  const currentUserRole = asUserRole(me.data?.user.role);
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
        <QavanteButton
          onClick={() => setInviteOpen(true)}
          disabled={usersQuery.isLoading || usersQuery.isError}
        >
          <UserPlus className="h-4 w-4" />
          Invitar usuario
        </QavanteButton>
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
          currentUserRole={currentUserRole}
          onSuspendClick={(u) => setSuspendTarget(u)}
        />
      )}

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentUserRole={currentUserRole}
      />

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
          Si el problema persiste, los endpoints de Users CRUD están pendientes en backend (issue
          qavante-api C0-14).
        </p>
      </div>
    </div>
  );
}
