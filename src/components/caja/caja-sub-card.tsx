import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";

/* Card de acceso del módulo Caja (link a una sub-pantalla). Extraída de la page para reusarla también
   en la landing reordenable (`cajaDashboard`). Presentacional. */

export interface CajaSubCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string;
  badgeVariant: "success" | "warning" | "info";
}

export function CajaSubCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant,
}: CajaSubCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <QavanteCard
        variant="bordered"
        className="h-full transition-colors hover:border-brand-primary/40"
        header={
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
            <span className="font-medium">{title}</span>
          </div>
        }
      >
        <div className="space-y-2">
          <QavanteBadge variant={badgeVariant}>{badge}</QavanteBadge>
          <p className="text-sm text-neutral-mid">{description}</p>
        </div>
      </QavanteCard>
    </Link>
  );
}
