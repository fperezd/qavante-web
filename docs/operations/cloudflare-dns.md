# DNS de `qavante.com` — referencia histórica, no ruta de release

Este documento conserva una referencia de DNS de 2026-05-12. No autoriza una
promoción, un cambio de aplicación ni una recuperación de producción. La única
autoridad de release es el [runbook de despliegue Azure](./deploy-runbook.md), que
debe validar el destino en runtime antes de declarar un cutover completado.

## Referencia registrada

- Registrar histórico: GoDaddy.
- Nameservers registrados entonces: `amanda.ns.cloudflare.com` y
  `chad.ns.cloudflare.com`.
- El registro histórico de `api.qavante.com` apuntaba a
  `tooxs-gestion-api.fly.dev` como CNAME DNS-only.
- Las menciones previas de un Worker, rutas declarativas o configuración de
  proveedor no son autoridad operativa para `app.qavante.com`.

Si se requiere un cambio DNS real, tratarlo como una operación de
infraestructura separada, verificar el objetivo contra el despliegue Azure y
registrar la decisión mediante el proceso de infraestructura aprobado. No usar
esta referencia para cambiar el destino de la aplicación ni para saltar el
preflight, smoke o verificación de procedencia.
