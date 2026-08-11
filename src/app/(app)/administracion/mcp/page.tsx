import { FeatureUnavailableState } from "@/components/qavante";
import { resolveFeatureFlags } from "@/lib/feature-flags";
import { McpView } from "@/components/mcp/mcp-view";

/* Gateado (flag `mcp`, default OFF — ADR-0008). Server Component: resuelve el flag; sin
   `export const runtime` (regla 4). Flag OFF → FeatureUnavailableState. Flag ON → conectar la
   empresa a un asistente LLM (server MCP de Qavante) + gestión de API-keys (ADR-0092, backend
   #882/#888). */
export default function McpPage() {
  const { mcp } = resolveFeatureFlags();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">Conectar un asistente (MCP)</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          Deja que un asistente como ChatGPT o Claude lea tus datos de Qavante para responderte sobre
          tu negocio. Se conecta con una API-key que creas acá y puedes revocar cuando quieras.
        </p>
      </header>

      {mcp ? <McpView /> : <FeatureUnavailableState />}
    </div>
  );
}
