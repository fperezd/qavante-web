# Cloudflare Workers — setup operativo (reemplaza C0-02)

> Este doc reemplaza al deprecated `docs/archive/c0-02-cloudflare-pages-attempt-deprecated.md`. La decisión arquitectural del proyecto es **Cloudflare Workers** vía adapter `@opennextjs/cloudflare`, según Anexo A.6 del Documento Maestro v2.6.3 y CLAUDE.md regla 4.

## Por qué Workers y no Pages

- El adapter `@opennextjs/cloudflare` (en `package.json` + `open-next.config.ts`) empaqueta Next.js a **Workers + workerd + nodejs_compat**. Eso preserva la posibilidad de usar APIs Node (con [límites de `nodejs_compat`](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)) sin obligar a `runtime = 'edge'` en cada page/route.
- Cloudflare Pages con `next-on-pages` exigía Edge Runtime en cada archivo, lo que limitaba librerías y era frágil. Cloudflare ya recomienda Workers para Next.js nuevo.
- Ver historial: PRs #5 y #7 alinearon CLAUDE.md y el doc maestro a Workers; este doc cierra el loop en el repo.

## Stack productivo objetivo

```
src/ (Next.js 15 + React 19)
      │
      ▼ npm run build → .next/
      │
      ▼ npm run build:cloudflare (opennextjs-cloudflare build)
      │
      ├─→ .open-next/worker.js     (entrypoint del Worker)
      └─→ .open-next/assets/       (estáticos servidos vía binding ASSETS)
              │
              ▼ wrangler deploy
              │
      ┌───────┴────────┐
      ▼                ▼
  qavante-web.workers.dev   qavante.com (Custom Domain)
```

## Setup manual — primera vez (no documentado en ningún ticket previo)

Hace falta hacer estos pasos UNA vez en tu cuenta de Cloudflare. Después de esto, cada `push` a `main` deploya solo.

### 1. Crear cuenta y obtener Account ID

1. https://dash.cloudflare.com → sign up (Free)
2. Dashboard → barra lateral derecha tiene **Account ID** (string hex de 32 chars). **Copialo.**

### 2. Crear API Token con permisos de deploy

1. https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → template **"Edit Cloudflare Workers"**
3. Account Resources → Include → tu cuenta
4. Zone Resources → All zones (necesario más tarde para attach del Custom Domain)
5. **Continue → Create Token** → **Copialo** (Cloudflare lo muestra solo una vez)

### 3. Agregar secrets al repo GitHub

`Settings → Secrets and variables → Actions → New repository secret`:

| Secret                  | Valor                    |
| ----------------------- | ------------------------ |
| `CLOUDFLARE_ACCOUNT_ID` | el Account ID del paso 1 |
| `CLOUDFLARE_API_TOKEN`  | el API Token del paso 2  |

### 4. Crear el Worker vacío (una sola vez)

Localmente, con [Node 24+](../../.nvmrc) y `wrangler` instalado por la dependencia del repo:

```bash
npx wrangler login           # OAuth en browser, queda autenticado en tu máquina
npx wrangler deploy --dry-run  # valida que el bundle se arma sin subir nada
```

Si está OK, hacer el primer deploy real desde local (después GH Actions lo cubre):

```bash
npm run build:cloudflare
npx wrangler deploy
```

Esto crea el Worker `qavante-web` en tu cuenta y publica el bundle. Probarlo:

```
https://qavante-web.<tu-subdomain>.workers.dev
```

`<tu-subdomain>` es algo como `fperezd-qavante.workers.dev` — Cloudflare lo asigna a tu cuenta. Lo ves en el dashboard.

### 5. Conectar Custom Domain `qavante.com`

**Prerequisito:** el dominio debe estar agregado a Cloudflare como Site y los nameservers de GoDaddy ya apuntando a Cloudflare (estado "Active" en el dashboard).

1. Cloudflare dashboard → Workers & Pages → seleccionar `qavante-web`
2. **Settings → Triggers → Custom Domains → Add Custom Domain**
3. Ingresar `qavante.com` → Add
4. (Opcional) repetir para `www.qavante.com` con redirect a apex
5. Cloudflare crea los DNS records con proxy ON y emite el SSL en minutos

Verificar: `curl -I https://qavante.com` debería responder 200 (o 307 a /login si hay middleware) con `Server: cloudflare`.

## Deploy automático desde `main`

Ya configurado en [.github/workflows/deploy-cloudflare.yml](../../.github/workflows/deploy-cloudflare.yml):

- Trigger: cada push a `main` (también `workflow_dispatch` manual desde Actions UI).
- Node 24 + npm cache + `npm ci`.
- `npm run build:cloudflare` (OpenNext).
- `cloudflare/wrangler-action@v3` con `command: deploy`.
- `concurrency` evita 2 deploys simultáneos.
- `environment: production` con URL `qavante.com` para que GitHub muestre el link en Deployments.

## Troubleshooting rápido

| Síntoma                                                | Causa típica                                           | Fix                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `npm ci` falla con "Missing: esbuild@0.28.0..."        | Node version desalineado con el lock                   | `setup-node` debe pedir 24 (no 22). Ver PR #16.                        |
| `wrangler deploy` falla con "binding ASSETS not found" | `wrangler.toml` sin `[assets]` block o paths mal       | Confirmar `directory = ".open-next/assets"`                            |
| `qavante.com` da 522                                   | Worker no deployado todavía o Custom Domain mal attach | Probar URL `*.workers.dev` directa; si funciona, revisar Custom Domain |
| Deploy GH Actions pasa pero el sitio no cambia         | Caché de Cloudflare                                    | Cloudflare dashboard → Caching → Configuration → **Purge Everything**  |

## Referencias

- [OpenNext / Cloudflare](https://opennext.js.org/cloudflare/get-started)
- [Wrangler Action](https://github.com/cloudflare/wrangler-action)
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
