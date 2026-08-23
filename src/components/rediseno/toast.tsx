"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Toast — ESPECIFICACION.md §1.3/Ley 6: "Ningún toast tapa acciones: top-right,
 * 5s auto-dismiss, con Deshacer cuando aplica."
 *
 * Deliberadamente NO reusa `QavanteToaster` (sonner, bottom-right, montado una
 * vez en `app-providers.tsx`): sonner expone un store global — `toast()` pinta
 * en TODAS las instancias de `<Toaster>` montadas a la vez, no por-instancia.
 * Agregar un segundo `<Toaster position="top-right">` habría duplicado cada
 * toast existente de la app (visible en pantallas que no tienen nada que ver
 * con el rediseño). Este es un store propio, aislado, solo para pantallas que
 * ya migraron — cero riesgo de interferir con `toast()` de sonner en el resto
 * de la app. Cuando todas las pantallas migren, este reemplaza a sonner. */

export interface RedisenoToast {
  id: string;
  message: React.ReactNode;
  action?: { label: string; onClick: () => void };
  /** ms antes de auto-dismiss. Default 5000 (Ley 6). */
  durationMs?: number;
}

interface ToastContextValue {
  show: (toast: Omit<RedisenoToast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let seq = 0;
function nextId() {
  seq += 1;
  return `rd-toast-${seq}`;
}

export function RedisenoToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<RedisenoToast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback((toast: Omit<RedisenoToast, "id">) => {
    const id = nextId();
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const value = React.useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <RedisenoToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** `show({ message, action? })` — action típico: `{ label: "Deshacer", onClick }` (Ley 5/6). */
export function useRedisenoToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useRedisenoToast requiere <RedisenoToastProvider>");
  return ctx;
}

function RedisenoToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: RedisenoToast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Notificaciones"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: RedisenoToast; onDismiss: () => void }) {
  React.useEffect(() => {
    const ms = toast.durationMs ?? 5000;
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss identity estable por diseño (closure sobre el id fijo del toast)
  }, [toast.id]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-xl border border-rediseno-hairline bg-rediseno-tinta px-4 py-3 text-[13px] text-white shadow-lg",
      )}
    >
      <div className="min-w-0 flex-1">{toast.message}</div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="shrink-0 font-bold text-white underline underline-offset-2"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="shrink-0 text-white/60 hover:text-white"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
