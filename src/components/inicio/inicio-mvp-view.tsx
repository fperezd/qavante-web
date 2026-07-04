"use client";

import { Activity, User2, Building2, Clock } from "lucide-react";
import { QavanteBadge, QavanteCard, QavanteInlineError } from "@/components/qavante";
import { useMe, type MeUser } from "@/lib/api/users";
import { ROLE_LABELS } from "@/components/administracion/role-labels";
import type { UserRole } from "@/lib/auth/types";
import { buildGreeting, formatLastLogin } from "./inicio-mvp-format";

/* MVP del módulo Inicio. Sprint C8 completo (Pulso Empresa + frase
   ejecutiva + alertas + acciones) requiere endpoints que NO existen
   todavía en el backend — addendum §25.x los marca como Fase 2.

   Mientras tanto, este MVP usa lo que SÍ funciona hoy: `/api/me`, uno
   de los 12 endpoints sin `security` declarado que acepta cookie auth
   (ver Brecha 0 en docs/backend-contracts/c3-treasury-reports-gaps.md).

   Muestra info del usuario logueado: nombre, email, rol, tenant_id y
   último login. Pantalla útil de entrada hasta que CC-API exponga
   los endpoints del Pulso. */

export function InicioMvpView() {
  const query = useMe();

  if (query.isLoading) {
    return (
      <div
        className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando datos del usuario"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="tu información" />;
  }

  if (!query.data?.user) {
    return null;
  }

  const user = query.data.user;
  return <InicioMvpContent user={user} />;
}

export interface InicioMvpContentProps {
  user: MeUser;
}

/* Presentacional puro — útil para Storybook (no requiere mock del hook). */
export function InicioMvpContent({ user }: InicioMvpContentProps) {
  const displayName = user.name?.trim() || user.email;
  const greeting = buildGreeting(new Date(), displayName);
  const roleLabel = ROLE_LABELS[user.role as UserRole] ?? user.role;
  const lastLoginLabel = formatLastLogin(user.last_login_at);

  return (
    <div className="space-y-4">
      <QavanteCard variant="bordered">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-neutral-dark">{greeting}</h2>
          <p className="text-sm text-neutral-mid">
            Bienvenido al inicio de Qavante. Muy pronto vas a ver aquí tu Pulso Empresa, alertas y
            acciones recomendadas.
          </p>
        </div>
      </QavanteCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <InfoCard
          icon={User2}
          label="Tu perfil"
          value={user.name?.trim() || "Sin nombre configurado"}
          extra={user.email}
        />
        <InfoCard
          icon={Building2}
          label="Empresa"
          value={user.tenant_name?.trim() || "Tu empresa"}
          extra={<QavanteBadge variant="success">{roleLabel}</QavanteBadge>}
        />
        <InfoCard icon={Clock} label="Último ingreso" value={lastLoginLabel} extra={null} />
      </div>
    </div>
  );
}

interface InfoCardProps {
  icon: typeof User2;
  label: string;
  value: React.ReactNode;
  extra: React.ReactNode;
}

function InfoCard({ icon: Icon, label, value, extra }: InfoCardProps) {
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-neutral-dark">{label}</span>
        </div>
      }
    >
      <div className="space-y-1">
        <div className="text-sm text-neutral-dark">{value}</div>
        {extra && <div className="text-xs text-neutral-mid">{extra}</div>}
      </div>
    </QavanteCard>
  );
}

/* Re-export para que la page pueda mostrar un fallback consistente. */
export { Activity };
export { buildGreeting, formatLastLogin } from "./inicio-mvp-format";
