# Cloudflare DNS — zona `qavante.com`

Inventario versionado de los records DNS de la zona `qavante.com` gestionada por Cloudflare. Documenta **qué existe, por qué, y cómo recrearlo si se pierde**. No reemplaza el dashboard de Cloudflare — lo complementa para evitar el "instalé los DNS donde no era" del bootstrap.

> **Última actualización:** 2026-05-12 — al crearse este doc.
> **Actualizar:** cuando se agregue/modifique/borre un record. Quien lo cambia abre PR aquí en el mismo cambio.

## Estado de la delegación

- **Registrar:** GoDaddy.
- **Nameservers autoritativos:** `amanda.ns.cloudflare.com` + `chad.ns.cloudflare.com` (asignados por Cloudflare al onboarding el 2026-05-12).
- **TLD `.com` delegation:** verificada via `nslookup -type=NS qavante.com a.gtld-servers.net` — muestra solo los NS de Cloudflare. Si vuelve a aparecer `ns37/38.domaincontrol.com` (GoDaddy), la delegación se rompió.

## Records actuales

### Apex `qavante.com`

| Tipo | Contenido | Propósito                                                                                                                                                                                    | Proxy |
| ---- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| —    | _libre_   | Reservado para landing/marketing futura (ver [ADR-0002](../adr/0002-dominio-oficial-qavante-com.md)). Si en Fase 2 se agrega una landing en Vercel/Cloudflare Pages, este record apunta ahí. | —     |

### Subdominios activos

| Hostname          | Tipo                  | Contenido                            | Propósito                                                                                                                                       | Proxy                                                                      | Quién lo gestiona                                        |
| ----------------- | --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| `app.qavante.com` | A/AAAA + Worker route | Worker `qavante-web` (Custom Domain) | **Frontend Next.js productivo.** Bindeado al Worker vía `[[routes]]` en [wrangler.toml](../../wrangler.toml). Cloudflare maneja IPs y SSL.      | Proxied (auto)                                                             | `wrangler deploy` (declarativo desde 2026-05-12, PR #27) |
| `api.qavante.com` | CNAME                 | `tooxs-gestion-api.fly.dev`          | **Backend FastAPI productivo.** Fly emite cert Let's Encrypt sobre este hostname. Ver [ADR-0003](../adr/0003-api-qavante-com-shared-parent.md). | **DNS-only (nube gris)** — crítico para que Fly responda al ACME challenge | Manual (Cloudflare dashboard)                            |

### Records placeholder / libres

| Hostname          | Estado                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `www.qavante.com` | Libre. Cuando exista landing, decidir si CNAME → `qavante.com` (redirect a apex) o A directo a la landing. |

### Records de servicio (no operativos)

Cloudflare auto-genera los siguientes y NO se editan manualmente:

- `NS @` para `amanda.ns.cloudflare.com` y `chad.ns.cloudflare.com` (delegación).
- `SOA @` con email de Cloudflare.

## Cómo recrear la zona desde cero

Si la zona se pierde (cambio de cuenta Cloudflare, accidente, etc.):

1. **Agregar el dominio en Cloudflare:**
   - Dashboard → **Add a Site** → ingresar `qavante.com` → plan **Free**.
   - Cloudflare asigna 2 NS (probablemente distintos a `amanda/chad`). Anotar.

2. **Cambiar nameservers en GoDaddy:**
   - `dcc.godaddy.com` → My Products → `qavante.com` → **Nameservers → Change → I'll use my own** → ingresar los 2 NS que dio Cloudflare.
   - **Atención al detalle:** los NS se cambian a nivel del registrar (GoDaddy), NO agregando records `NS` dentro de la zona DNS. Esta confusión nos costó tiempo en el bootstrap.
   - Propagación al TLD `.com`: minutos a 24h. Verificar con `nslookup -type=NS qavante.com a.gtld-servers.net` — debe mostrar SOLO los NS de Cloudflare.

3. **Recrear records manualmente:**

   ```
   Type: CNAME
   Name: api
   Target: tooxs-gestion-api.fly.dev
   Proxy: DNS only (nube gris) — IMPORTANTE
   TTL: Auto
   ```

4. **El custom domain de `app.qavante.com` se recrea solo** al próximo `wrangler deploy` (declarado en [wrangler.toml](../../wrangler.toml) desde PR #27). No requiere acción manual.

5. **Coordinar con backend** para que `fly certs create api.qavante.com` se ejecute después de que la CNAME esté propagada (ver `qavante-api#58` y [ADR-0003](../adr/0003-api-qavante-com-shared-parent.md)).

## Cómo agregar un nuevo record

1. Cloudflare dashboard → `qavante.com` → DNS → Records → **+ Add record**.
2. Llenar: Tipo, Name, Content, TTL, Proxy status (decidir consciente: Proxied o DNS-only).
3. Save.
4. **Inmediatamente:** abrir PR en este repo agregando el record a la tabla "Records actuales" arriba, con propósito y proxy status. Si lo olvidás, el siguiente que toque DNS no sabe que existe.

## Casos especiales de proxy status

- **Proxied (nube naranja):** Cloudflare responde con sus IPs (`104.x.x.x`, `172.64.x.x`, etc.) y proxea el tráfico hacia el origen. Suma DDoS protection, WAF (en plan pago), cache. Solo tiene sentido para HTTP/HTTPS.
- **DNS only (nube gris):** Cloudflare solo responde con el record original. Necesario cuando:
  - El destino emite su propio cert SSL (e.g., `api.qavante.com → fly.dev` — Fly necesita ver al cliente directo para Let's Encrypt).
  - Otros servicios que requieran ver IP origen real (SMTP, SSH, etc.).
  - Túneles, VPN, conexiones non-HTTP.
- **Default recomendado:** Proxied para records HTTP/HTTPS hacia infra propia; DNS-only para CNAMEs hacia servicios externos que manejan su propio SSL (Fly, Heroku, GitHub Pages, etc.).

## Validación end-to-end

Después de cualquier cambio en la zona, correr desde una shell:

```pwsh
# Delegación TLD (fuente de verdad)
nslookup -type=NS qavante.com a.gtld-servers.net

# Resolución desde resolver público (puede tener cache stale unos minutos)
nslookup app.qavante.com 8.8.8.8
nslookup api.qavante.com 8.8.8.8

# HTTPS funcional
curl -I https://app.qavante.com
curl -I https://api.qavante.com/openapi.json
```

Si la resolución desde `1.1.1.1` o `8.8.8.8` no muestra el record nuevo y la del NS autoritativo (`amanda.ns.cloudflare.com`) sí, es caché stale — esperar hasta el TTL.

## Referencias

- [ADR-0002](../adr/0002-dominio-oficial-qavante-com.md) — decisión del dominio.
- [ADR-0003](../adr/0003-api-qavante-com-shared-parent.md) — decisión de `api.qavante.com`.
- [wrangler.toml](../../wrangler.toml) — fuente de verdad del custom domain `app.qavante.com`.
- PR #27 — versionado del custom domain.
- [Cloudflare DNS docs](https://developers.cloudflare.com/dns/).
- [Fly custom domains](https://fly.io/docs/networking/custom-domain/).
