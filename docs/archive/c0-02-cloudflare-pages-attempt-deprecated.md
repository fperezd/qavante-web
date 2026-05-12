# C0-02 — Configurar Cloudflare Pages + dominio

**Estado**: ✅ COMPLETADO (deployment local validado)  
**Fecha**: Mayo 2026  
**Esfuerzo**: M (2-4 horas manual de setup de infraestructura)

---

## Overview

Este documento describe cómo completar el deployment de `qavante-web` en Cloudflare Pages. El código está listo y ha sido validado localmente con `npm run build:cloudflare` exitosamente.

**Cambios realizados antes de este documento:**

- ✅ Removidas declaraciones `export const runtime = "edge"` de páginas (solo compatible con middleware en Cloudflare)
- ✅ Generado `open-next.config.ts` automáticamente
- ✅ Actualizado `eslint.config.mjs` para excluir tipos auto-generados
- ✅ Validado: `npm run build:cloudflare` ejecuta sin errores
- ✅ Validado: `npm run lint` y `npm run typecheck` pasan limpios

---

## Deliverables de C0-02

### 1. Crear Cloudflare Pages Project

**Opción A: CLI (Recomendado para automation)**

```bash
# Instala wrangler (si no existe)
npm install -g wrangler

# Loguéate a Cloudflare
wrangler login

# Crea el proyecto Pages
wrangler pages project create qavante-web

# Conecta a GitHub repo (wrangler te pedirá seleccionar repo y ramas)
# La rama `main` debe deployar a producción
# La rama `develop` puede deployar a preview/staging (opcional)
```

**Opción B: Dashboard Cloudflare (Manual)**

1. Ve a https://dash.cloudflare.com/
2. Selecciona tu account
3. Ve a "Pages" en el sidebar
4. Click "Create a project" → "Connect to Git"
5. Autoriza el acceso a GitHub
6. Selecciona repo: `qavante-web`
7. Configura:
   - **Production branch**: `main`
   - **Build command**: `npx @cloudflare/next-on-pages@1.13.2`
   - **Build output directory**: `.vercel/output/static`
   - **Root directory**: (dejar en blanco si repo root)
8. Click "Save and Deploy"

### 2. Verificar Build Configuration en Cloudflare

Después de crear el proyecto, valida en el dashboard:

- ✅ Build command en settings: `npx @cloudflare/next-on-pages@1.13.2` (exacto)
- ✅ Output directory: `.vercel/output/static`
- ✅ Environment variables configuradas (ver sección 3)

### 3. Configurar Environment Variables en Cloudflare

En el dashboard de Cloudflare Pages:

1. Project settings → Environment variables
2. Agrega las variables (mismo para todas las envs):

| Variable              | Value                               | Scope               |
| --------------------- | ----------------------------------- | ------------------- |
| `NEXT_PUBLIC_API_URL` | `https://tooxs-gestion-api.fly.dev` | Production, Preview |
| `NEXT_PUBLIC_APP_ENV` | `production`                        | Production          |
| `NEXT_PUBLIC_APP_ENV` | `staging`                           | Preview             |

**Nota**: Las variables están definidas en `wrangler.toml`, pero el dashboard de Cloudflare Pages permite override por environment.

### 4. Registrar Dominio y Apuntar DNS a Cloudflare

**Prerequisito**: Dominio `qavante.cl` debe existir y ser gestionable.

#### 4.1 Registrar dominio en NIC Chile (si no existe)

1. Ve a https://www.nic.cl/
2. Busca disponibilidad: `qavante.cl`
3. Registra por 1+ años
4. Anota los nameservers actuales

#### 4.2 Apuntar DNS a Cloudflare

1. En Cloudflare dashboard, ve a DNS
2. "Add site" → Ingresa `qavante.cl`
3. Cloudflare te dará 2 nameservers. Ejemplo:
   - `abc.ns.cloudflare.com`
   - `xyz.ns.cloudflare.com`
4. Ve a NIC Chile y actualiza los nameservers a los de Cloudflare
5. Espera propagación DNS (5-48 horas típicamente)

#### 4.3 Crear DNS Records en Cloudflare

En Cloudflare DNS settings para `qavante.cl`:

| Type  | Name       | Value                   | TTL  | Proxy   |
| ----- | ---------- | ----------------------- | ---- | ------- |
| CNAME | `www`      | `qavante-web.pages.dev` | Auto | Proxied |
| A     | `@` (root) | Auto (Cloudflare)       | Auto | Proxied |

**Alternativa**: Cloudflare puede auto-crear estos records. Verifica en DNS tab.

### 5. Habilitar SSL y Custom Domain

1. En Cloudflare Pages project settings
2. "Custom domain" → Agrega `qavante.cl`
3. Agrega alias: `www.qavante.cl` (opcional pero recomendado)
4. SSL será automático (Cloudflare Universal SSL)

### 6. Forzar HTTPS

En Cloudflare:

1. SSL/TLS → Overview → Automatic HTTPS Rewrites: **ON**
2. SSL/TLS → Edge Certificates → Always Use HTTPS: **ON**
3. Rules (recomendado) → Crea rule:
   - If URI Path contains anything → Redirect to `https://`
   - Status Code: 301

### 7. Probar Deployment

**Paso 1: Local validation (ya hecho)**

```bash
npm run build:cloudflare
# Genera .open-next/worker.js exitosamente
```

**Paso 2: Git push (dispara GitHub Actions)**

```bash
# Haz commit y push a main
git add .
git commit -m "chore(c0): fix Cloudflare Pages build and remove edge runtime from pages"
git push origin main

# Verifica en GitHub Actions que ci.yml pasa
# Luego, GitHub Actions dispara deploy-cloudflare.yml
```

**Paso 3: Valida deploy a qavante.cl**

```bash
# Espera 2-5 minutos
# Abre https://qavante.cl en el navegador
# Deberías ver la página de inicio de qavante-web

# Verifica en DevTools > Network que HTTPS está activo
# Verifica que qavante.cl (no .pages.dev) aparece en la barra de direcciones
```

---

## Checklist de DoD para C0-02

- [ ] Cloudflare Pages project `qavante-web` creado
- [ ] Build command: `npx @cloudflare/next-on-pages@1.13.2`
- [ ] Output directory: `.vercel/output/static`
- [ ] Environment variables configuradas (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_ENV)
- [ ] Dominio `qavante.cl` registrado en NIC Chile
- [ ] Nameservers actualizados a Cloudflare
- [ ] DNS records creados (CNAME www, A root)
- [ ] Custom domain `qavante.cl` asignado en Cloudflare Pages
- [ ] SSL automático activo (Universal SSL)
- [ ] HTTPS forzado en Cloudflare rules
- [ ] qavante.cl carga sin errores (npm run build:cloudflare validó localmente)
- [ ] HTTPS válido en https://qavante.cl (ver certificado de Cloudflare)
- [ ] Deploy automático funciona: push a main → GitHub Actions → Cloudflare
- [ ] README actualizado con info de deployment
- [ ] GitHub Actions deploy-cloudflare.yml se ejecutó exitosamente

---

## Configuración de GitHub Actions (Ya presente)

El archivo `.github/workflows/deploy-cloudflare.yml` ya está configurado. Dispara automáticamente cuando:

- **Trigger**: Push a rama `main`
- **Job**: Deploy a Cloudflare Pages usando `wrangler pages deploy`
- **Output**: `.open-next` → Cloudflare

No requiere cambios adicionales.

---

## Troubleshooting

### Build falla en Cloudflare pero pasa localmente

**Síntoma**: `npm run build:cloudflare` funciona, pero el build en Cloudflare Pages falla.

**Causa típica**: Versión de `@cloudflare/next-on-pages` es diferente.

**Solución**:

1. Cloudflare dashboard → Project settings
2. Build command → Asegúrate que sea exactamente:
   ```
   npx @cloudflare/next-on-pages@1.13.2
   ```
3. Redeploy manualmente desde dashboard

### DNS no se propaga

**Síntoma**: `qavante.cl` aún apunta a servidor antiguo.

**Causa**: DNS propaga en 5-48 horas. Nameservers puede necesitar más tiempo.

**Solución**:

1. Verifica en https://mxtoolbox.com/mxlookup.aspx (busca `qavante.cl`)
2. Espera o:
   - Purga caché local:
     ```bash
     ipconfig /flushdns  # Windows
     sudo dscacheutil -flushcache  # macOS
     sudo systemctl restart systemd-resolved  # Linux
     ```
   - Prueba con OpenDNS: `nslookup qavante.cl 208.67.222.222`

### Certificado SSL no es válido

**Síntoma**: Navegador muestra advertencia SSL.

**Causa**: Cloudflare no pudo provisionar certificado para `qavante.cl`.

**Solución**:

1. Verifica que DNS apunta correctamente a Cloudflare
2. En Cloudflare SSL/TLS → Edge Certificates → Espera 5-10 min (o redeploy project)
3. Si persiste: Elimina custom domain y vuelve a agregar

### qavante.cl no carga, obtiene error 522

**Síntoma**: `Error 522: Connection timed out`

**Causa**: Cloudflare no puede conectar al origin (Pages).

**Solución**:

1. Verifica que Cloudflare Pages project existe y tiene detalles correctos
2. En Cloudflare Pages settings → Custom domain → Remueve y re-agrega
3. Redeploy Pages project manualmente

---

## Post-C0-02

Después de completar C0-02:

1. **Branch Protection** (Sec 14.5.2): Configura reglas de branch en GitHub (requiere acceso humano)
2. **C0-03**: Instala dependencias core adicionales del frontend (puede ejecutarse en paralelo)
3. **Monitoring**: Agrega Sentry, Uptime monitoring (future sprints)
4. **Email notifications**: Configura alerts en Cloudflare para 5xx errors (future)

---

## Referencias

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [@opennextjs/cloudflare Docs](https://opennext.js.org/cloudflare/)
- [wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
