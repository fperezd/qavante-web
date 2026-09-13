import * as React from "react";
import Link from "next/link";
import { Inbox, LoaderCircle, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { estaVacio, type ContenidoVisible } from "./contenido-visible";

/* Tres estados, no dos — Ley 8 ("los estados vacíos siempre hablan").
 *
 * Por qué existe: con el certificado del SII caído, Ventas y Compras devuelven
 * cero documentos y el usuario ve una lista vacía idéntica a la de un mes sin
 * facturas. El sistema SÍ sabe la diferencia (la respuesta trae `status:"error"`
 * y un mensaje de causa), pero la pantalla la tira a la basura. Este primitivo
 * obliga a elegir entre los tres estados reales:
 *
 *   ready → hay datos (renderiza sus hijos y desaparece)
 *   empty → preguntamos y no había nada. El cero es verdad.
 *   error → no pudimos preguntar. No sabemos si hay algo o no.
 *
 * Por qué NO extiende `qavante/qavante-empty.tsx`: son dos sistemas de diseño
 * distintos conviviendo a propósito. `QavanteEmpty` está escrito sobre los
 * tokens `--qv-*` (`border-border`, `bg-gradient-surface`, `brand-primary-50`)
 * que siguen usando las pantallas vivas; migrarlo a `--rd-*` cambiaría el
 * aspecto de las ~20 pantallas que ya lo usan en un PR de UX, y meterle un
 * tercer estado le agregaría a un componente estable una API que ninguno de sus
 * llamadores actuales necesita. Además su modelo es "un panel con título" — no
 * tiene la noción de envolver contenido y decidir. Cuando una pantalla migre al
 * rediseño cambia `QavanteEmpty` por `DataState`; hasta entonces conviven, como
 * ya conviven `RedisenoToastProvider` y sonner (ver `toast.tsx`).
 *
 * Por qué el error es ámbar y no rojo (Ley 2): el rojo es para lo crítico Y
 * accionable, máximo una vez por pantalla, y se lo reservan las decisiones de
 * plata. Una integración caída es "requiere tu acción" — ámbar, el mismo borde
 * de `Banner variant="warn"`. */

export interface DataStateAction {
  label: string;
  /** Ruta interna (`next/link`). Si hay `href`, se ignora `onClick`. */
  href?: string;
  onClick?: () => void;
}

interface DataStateBaseProps {
  /**
   * Qué se estaba buscando, en lenguaje de dueño y en plural:
   * "documentos de venta", "movimientos del banco".
   */
  what: string;
  className?: string;
  /** Ajuste visual opcional para una vista que no use la voz display del rediseño. */
  headingClassName?: string;
}

export type DataStateProps = DataStateBaseProps &
  (
    | { status: "ready"; children: React.ReactNode; cause?: never; action?: never; hint?: never }
    | {
        status: "loading";
        children?: never;
        cause?: never;
        hint?: ContenidoVisible;
        action?: never;
      }
    | {
        status: "empty";
        children?: never;
        cause?: never;
        /** Qué podría explicar el vacío o qué hacer con él. Opcional. */
        hint?: ContenidoVisible;
        action?: DataStateAction;
      }
    | {
        status: "stale" | "partial";
        children?: never;
        cause?: never;
        hint: ContenidoVisible;
        action?: DataStateAction;
      }
    | {
        status: "error";
        children?: never;
        /**
         * La causa, tal como la declara el backend. OBLIGATORIA: un error sin
         * causa es otra vez una pantalla muda, que es justo el bug que esto
         * viene a arreglar. El tipo impide omitirla y impide `undefined`/`null`;
         * la cadena vacía la cubre el fallback de runtime (ver el render).
         */
        cause: ContenidoVisible;
        hint?: never;
        /** Qué hacer al respecto. Casi siempre "Revisar credenciales". */
        action?: DataStateAction;
      }
  );

export function DataState(props: DataStateProps) {
  if (props.status === "ready") return <>{props.children}</>;

  const esError = props.status === "error";
  const cargando = props.status === "loading";
  const advertencia = props.status === "stale" || props.status === "partial";
  const Icon = esError || advertencia ? PlugZap : cargando ? LoaderCircle : Inbox;
  const title = esError
    ? `No pudimos consultar ${props.what}`
    : cargando
      ? `Consultando ${props.what}`
      : props.status === "stale"
        ? `La información de ${props.what} está desactualizada`
        : props.status === "partial"
          ? `La información de ${props.what} está incompleta`
          : `No hay ${props.what}`;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl bg-rediseno-superficie px-6 py-10 text-center",
        esError || advertencia
          ? "border border-rediseno-hairline border-l-[3px] border-l-rediseno-ambar-border"
          : "border border-dashed border-rediseno-hairline",
        props.className,
      )}
    >
      <Icon
        className={cn(
          "size-7",
          cargando && "animate-spin",
          esError || advertencia ? "text-rediseno-ambar" : "text-rediseno-tinta-3-light",
        )}
        aria-hidden
      />
      <h3
        className={cn(
          "font-rediseno-sans text-[17px] font-medium text-rediseno-tinta",
          props.headingClassName,
        )}
      >
        {title}
      </h3>
      <p className="max-w-[26rem] text-[13px] leading-relaxed text-rediseno-tinta-2">
        {esError
          ? /* El tipo obliga a pasar `cause`, pero no puede prohibir la cadena
             vacía. Si llega vacía lo decimos: quedarse mudo acá sería repetir
             exactamente el bug que este componente vino a arreglar. */
            estaVacio(props.cause)
            ? "No recibimos información suficiente sobre el problema. Intenta nuevamente; si continúa, revisa tus conexiones."
            : props.cause
          : cargando
            ? estaVacio(props.hint)
              ? "Espera un momento mientras obtenemos la información."
              : props.hint
            : advertencia
              ? props.hint
              : "No encontramos registros para la consulta realizada. Esto no confirma que el importe sea cero."}
      </p>
      {/* Solo el error dice "no sabemos": el vacío ya afirmó que sí sabe. */}
      {esError && (
        <p className="max-w-[26rem] text-[12.5px] leading-relaxed text-rediseno-tinta-3">
          No podemos confirmar si existen {props.what} hasta que la consulta funcione.
        </p>
      )}
      {!esError && !cargando && !advertencia && !estaVacio(props.hint) && (
        <p className="max-w-[26rem] text-[12.5px] leading-relaxed text-rediseno-tinta-3">
          {props.hint}
        </p>
      )}
      {props.action && <DataStateCta action={props.action} />}
    </div>
  );
}

const ctaCls =
  "mt-1 inline-flex items-center rounded-full bg-rediseno-tinta px-4 py-2 text-[12.5px] font-bold text-white focus-visible:ring-2 focus-visible:ring-rediseno-azul focus-visible:outline-none";

function DataStateCta({ action }: { action: DataStateAction }) {
  if (action.href) {
    return (
      <Link href={action.href} className={ctaCls}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={ctaCls}>
      {action.label}
    </button>
  );
}
