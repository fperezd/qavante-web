"use client";

import * as React from "react";
import { reportError } from "@/lib/observability/report-error";

/* global-error.tsx — catch-all de errores del layout raíz (Tooxs Frontend
   Standard §17). Reemplaza el documento entero, así que renderea su propio
   <html>/<body> con estilos inline (no hay acceso al CSS del layout). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="es-CL">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          color: "#1d1d1b",
          background: "#f5f7fa",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 14, color: "#575756", marginBottom: 20 }}>
            Tuvimos un problema inesperado. Recargá la página para continuar.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 12,
              border: 0,
              background: "#1d5bff",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
