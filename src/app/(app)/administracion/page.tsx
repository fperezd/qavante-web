import Link from "next/link";
import {
  Users,
  KeyRound,
  Layers,
  Telescope,
  Coins,
  ListFilter,
  Briefcase,
  Building2,
  Bot,
  Wallet,
  ArrowRight,
  PlugZap,
} from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { AdministracionV12Live } from "@/components/administracion/v12/administracion-v12-live";

interface SubModuleCardProps {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
}

function SubModuleCard({ href, icon: Icon, title, description }: SubModuleCardProps) {
  return (
    <Link
      href={href}
      className="block transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <QavanteCard variant="bordered" className="h-full">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-brand-primary-50 p-2 text-brand-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1 text-sm font-semibold text-neutral-dark">
              {title}
              <ArrowRight className="h-3 w-3 text-neutral-mid" aria-hidden="true" />
            </h3>
            <p className="mt-1 text-sm text-neutral-mid">{description}</p>
          </div>
        </div>
      </QavanteCard>
    </Link>
  );
}

export default function AdministracionPage() {
  const { mcp, administracionV12 } = resolveFeatureFlags();

  /* V12 · Administración (rediseño Fase 2, issue #75) — gated por `administracionV12`, activado
     en producción desde `wrangler.toml`. Reemplaza la grilla de tarjetas por la tabla de 8 (o 9,
     con MCP) entradas con estado
     por fila de la spec §V12: Credenciales reusa la MISMA fuente que V11 (Ley 1), Empresas y
     Usuarios muestran su conteo real. Con OFF nada de abajo cambia (cero regresión: la grilla
     actual queda intacta y sirve como rollback). La fila 12B · Reglas consume el origen y uso
     verificables del contrato API #441; las seis señales restantes siguen declaradas en #96. */
  if (administracionV12) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-dark">Administración</h1>
          <p className="mt-1 text-sm text-neutral-mid">
            ¿Cómo configuro mi equipo y mis fuentes? Usa el selector de empresa del encabezado:
            desde credenciales hasta plantillas, la configuración aplica a la sociedad activa.
          </p>
        </header>
        <AdministracionV12Live mcp={mcp} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Administración</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Cómo configuro mi equipo y mis fuentes? Usa el selector de empresa del encabezado: desde
          credenciales hasta plantillas, la configuración aplica a la sociedad activa.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SubModuleCard
          href="/administracion/empresas"
          icon={Building2}
          title="Empresas"
          description="Las empresas de tu cuenta: cambia entre ellas o agrega una nueva."
        />
        <SubModuleCard
          href="/administracion/usuarios"
          icon={Users}
          title="Usuarios"
          description="Invita, suspende y cambia roles del equipo que accede a tu Qavante."
        />
        <SubModuleCard
          href="/administracion/credenciales"
          icon={KeyRound}
          title="Credenciales"
          description="Claves del SII, certificado digital y conexión con tu banco · por empresa."
        />
        <SubModuleCard
          href="/administracion/conexiones"
          icon={PlugZap}
          title="Conexiones"
          description="Estado de banco, SII y otras fuentes: qué está al día y qué requiere tu acción."
        />
        <SubModuleCard
          href="/administracion/estructura-gestion"
          icon={Layers}
          title="Estructura de gestión"
          description="Ordena tus ingresos, costos, gastos, caja y obligaciones, partiendo de una base sugerida."
        />
        <SubModuleCard
          href="/administracion/vistas-gestion"
          icon={Telescope}
          title="Vistas de gestión"
          description="Mira tu negocio por cliente, proyecto, obra, local, sociedad, canal u otra variable."
        />
        <SubModuleCard
          href="/administracion/monedas"
          icon={Coins}
          title="Monedas"
          description="Moneda principal de tu empresa y monedas en que quieres ver tus reportes."
        />
        <SubModuleCard
          href="/administracion/remuneraciones"
          icon={Wallet}
          title="Sistema de remuneraciones"
          description="Con qué sistema pagas tus sueldos: BUK, Talana o carga manual."
        />
        <SubModuleCard
          href="/administracion/reglas-clasificacion"
          icon={ListFilter}
          title="Reglas de clasificación"
          description="Reglas que Qavante usa para clasificar movimientos similares en el futuro."
        />
        <SubModuleCard
          href="/administracion/plantillas"
          icon={Briefcase}
          title="Plantillas por rubro"
          description="Estructura sugerida de cuentas y vistas según el tipo de negocio que tengas."
        />
        {mcp && (
          <SubModuleCard
            href="/administracion/mcp"
            icon={Bot}
            title="Conectar un asistente (MCP)"
            description="Deja que ChatGPT o Claude lean tus datos de Qavante para responderte, con una API-key que controlas."
          />
        )}
      </div>
    </div>
  );
}
