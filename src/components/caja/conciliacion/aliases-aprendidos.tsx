import { BrainCircuit } from "lucide-react";
import { QavanteBadge, QavanteCard, QavanteEmpty } from "@/components/qavante";
import type { ReconciliationAlias } from "@/lib/api/reconciliation";
import { formatDateTimeLike } from "@/lib/formatters/date";

type Props = { aliases: ReconciliationAlias[] };

/** Explica evidencia ya registrada por el motor; no crea ni altera aliases. */
export function AliasesAprendidos({ aliases }: Props) {
  return (
    <section aria-labelledby="aliases-aprendidos-title" className="space-y-3">
      <div>
        <h2 id="aliases-aprendidos-title" className="text-lg font-semibold text-neutral-dark">
          Lo que Qavante está aprendiendo
        </h2>
        <p className="mt-1 text-sm text-neutral-mid">
          Un alias identifica una contraparte a partir de una glosa bancaria. Se activa después de
          dos confirmaciones; antes de conciliar, Qavante igual valida monto, documento abierto y
          empresa.
        </p>
      </div>

      {aliases.length === 0 ? (
        <QavanteEmpty
          icon={BrainCircuit}
          title="Aún no hay patrones aprendidos"
          description="Cuando confirmes una misma glosa en más de una ocasión, vas a ver acá la evidencia antes de que Qavante la use como ayuda."
          className="py-8"
        />
      ) : (
        <ul className="space-y-2">
          {aliases.map((alias) => (
            <li key={alias.id}>
              <AliasItem alias={alias} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AliasItem({ alias }: { alias: ReconciliationAlias }) {
  const active = alias.confirmations >= 2;
  const direction =
    alias.direction === "credit" ? "Cobros" : alias.direction === "debit" ? "Pagos" : "Movimiento";
  const source = alias.source === "learned" ? "Aprendido al confirmar" : "Regla creada manualmente";
  const confirmations = `${alias.confirmations} ${alias.confirmations === 1 ? "confirmación" : "confirmaciones"}`;

  return (
    <QavanteCard variant="bordered">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-all text-sm font-medium text-neutral-dark">{alias.pattern}</p>
            <QavanteBadge variant={active ? "success" : "warning"}>
              {active ? "Activo" : "Aún aprendiendo"}
            </QavanteBadge>
          </div>
          <p className="mt-1 text-xs text-neutral-mid">
            {direction} · {source} · {confirmations}
          </p>
        </div>
        <p className="text-xs text-neutral-mid">
          {alias.last_used_at
            ? `Usado ${formatDateTimeLike(alias.last_used_at)}`
            : `Registrado ${formatDateTimeLike(alias.created_at)}`}
        </p>
      </div>
    </QavanteCard>
  );
}
