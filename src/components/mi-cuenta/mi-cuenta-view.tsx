"use client";

import { useState } from "react";
import { Building2, Clock, LogOut, Mail, User2, type LucideIcon } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard, QavanteInlineError } from "@/components/qavante";
import { useLogout, useMe, type MeUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { ROLE_LABELS } from "@/components/administracion/role-labels";
import type { UserRole } from "@/lib/auth/types";
import { formatLastLogin } from "@/components/inicio/inicio-mvp-format";
import { LogoutConfirmDialog } from "./logout-confirm-dialog";

/* Pantalla "Mi cuenta". Muestra el perfil del usuario logueado (nombre,
   correo, empresa, rol, último ingreso) consumiendo `/api/me` — el mismo
   endpoint con cookie auth que usa el MVP de Inicio — y permite cerrar
   sesión vía `POST /api/auth/logout`.

   Gateada por el flag `miCuenta` desde la page; cuando está OFF se ve el
   QavanteEmpty informativo (patrón "MVP honesto" ADR-0013). */

export function MiCuentaView() {
  const query = useMe();

  if (query.isLoading) {
    return (
      <div
        className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando tu cuenta"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="tu cuenta" />;
  }

  if (!query.data?.user) {
    return null;
  }

  return <MiCuentaContent user={query.data.user} />;
}

export interface MiCuentaContentProps {
  user: MeUser;
}

/* Presentacional puro — no usa el hook de sesión, así Storybook puede
   renderizarlo sin mock de react-query. El logout vive en su propio
   componente (`LogoutButton`) porque sí necesita el hook. */
export function MiCuentaContent({ user }: MiCuentaContentProps) {
  const roleLabel = ROLE_LABELS[user.role as UserRole] ?? user.role;

  const rows: ReadonlyArray<{ Icon: LucideIcon; label: string; value: React.ReactNode }> = [
    { Icon: User2, label: "Nombre", value: user.name?.trim() || "Sin nombre configurado" },
    { Icon: Mail, label: "Correo", value: user.email },
    {
      Icon: Building2,
      label: "Empresa",
      value: <span className="font-mono text-xs break-all">{user.tenant_id}</span>,
    },
    { Icon: Clock, label: "Último ingreso", value: formatLastLogin(user.last_login_at) },
  ];

  return (
    <div className="space-y-4">
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-dark">Tu perfil</span>
            <QavanteBadge variant="success">{roleLabel}</QavanteBadge>
          </div>
        }
      >
        <dl className="divide-y divide-border">
          {rows.map(({ Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 py-3">
              <Icon className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
              <dt className="w-28 shrink-0 text-sm text-neutral-mid">{label}</dt>
              <dd className="min-w-0 text-sm text-neutral-dark">{value}</dd>
            </div>
          ))}
        </dl>
      </QavanteCard>

      <QavanteCard
        variant="bordered"
        header={<span className="text-sm font-medium text-neutral-dark">Sesión</span>}
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-mid">
            Cierra tu sesión en este dispositivo. Vuelves a la pantalla de inicio de sesión.
          </p>
          <LogoutButton />
        </div>
      </QavanteCard>
    </div>
  );
}

/* Mensaje de error de logout. Para `ApiError` usamos el copy del Anexo C.3;
   el fallback genérico de QavanteInlineError ("No pudimos cargar…") no aplica
   a una acción, así que lo manejamos acá con una frase propia. */
function logoutErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? apiErrorToUserMessage(error)
    : "No pudimos cerrar tu sesión. Vuelve a intentar en unos segundos.";
}

/* Aislado del contenido presentacional porque consume el hook de mutación.
   El botón abre un diálogo de confirmación (evita logout accidental); el
   logout real corre al confirmar. En éxito, `useLogout` redirige a /login
   con `window.location.href`, así que el diálogo se desmonta solo. */
function LogoutButton() {
  const logout = useLogout();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <QavanteButton variant="secondary" onClick={() => setConfirmOpen(true)}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Cerrar sesión
      </QavanteButton>
      <LogoutConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        loading={logout.isPending}
        error={logout.isError ? logoutErrorMessage(logout.error) : null}
        onConfirm={() => logout.mutate()}
      />
    </>
  );
}
