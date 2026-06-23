# Publicar y consumir `@tooxs/ui`

`@tooxs/ui` se distribuye **bundleado** (con [bunchee](https://github.com/huozhi/bunchee)):
`dist/` con ESM + `.d.ts`, y los `"use client"` preservados **por componente**. Es
**zero-config**: el consumidor NO necesita `transpilePackages`. (Validado con un
`next build` real de una app que lo consume desde el tarball.)

> Detalle de diseño: el barrel exporta **solo componentes (todos `"use client"`) +
> tipos**. Las utilidades puras (`cn`, `resolveAsyncState`, `moveItem`…) quedan
> internas — exportarlas desde un bundle las metería en un chunk client y romperían
> si un Server Component las llamara. El consumidor usa su propio `cn`.

## Build

```bash
cd packages/ui
npm run build      # bunchee -> dist/
```

`prepublishOnly` corre el build automáticamente antes de `npm publish`.

## Publicar a GitHub Packages (org `tooxs`)

El scope `@tooxs` requiere una **organización `tooxs`** en GitHub (el scope npm de
GitHub Packages = owner). Creala (gratis) y asegurate de que el repo del paquete
viva bajo esa org (o publicá con un PAT con permiso sobre la org).

**1. Auth — `~/.npmrc` (o del repo):**

```
@tooxs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` = un Personal Access Token (classic) con scope `write:packages`
(y `read:packages` para instalar).

**2. Publicar:**

```bash
cd packages/ui
npm version patch          # o minor/major
npm publish                # usa publishConfig.registry = npm.pkg.github.com
```

### Publicar desde CI (GitHub Actions)

Workflow (corre desde un repo **bajo la org `tooxs`**, donde `GITHUB_TOKEN` tiene
permiso de packages; si el paquete vive en otro owner, usá un PAT como secret):

```yaml
name: publish-ui
on:
  push:
    tags: ["ui-v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: https://npm.pkg.github.com
          scope: "@tooxs"
      - run: npm ci
      - run: npm run build -w @tooxs/ui
      - run: npm publish -w @tooxs/ui
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Consumir en una app nueva (Next.js 15 + Tailwind v4)

**1. `~/.npmrc` de la app** (para instalar desde GitHub Packages):

```
@tooxs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**2. Instalar** (el paquete + sus peers):

```bash
npm i @tooxs/ui
npm i react react-dom recharts @tanstack/react-table \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**3. `globals.css`** — Tailwind v4 ignora `node_modules`, así que apuntá el `@source`
al `dist` del paquete y cargá los tokens. **No hace falta `transpilePackages`.**

```css
@import "tailwindcss";
@source "../node_modules/@tooxs/ui/dist"; /* genera las clases del paquete */
@import "@tooxs/ui/styles.css"; /* tokens + @theme de marca */
```

> Ajustá el path de `@source` según dónde viva tu `globals.css`.

**4. Montá el `Toaster` una vez** (en tu layout/provider):

```tsx
import { Toaster } from "@tooxs/ui";
// ...> {children}<Toaster />
```

**5. Theming / white-label** — sobreescribí los defaults en tu `:root`:

```css
:root {
  --brand-primary: #7c3aed;
}
```

**6. Usalo** (incluso en Server Components — los componentes son client y cruzan el
boundary solos):

```tsx
import { Button, Card, AsyncBoundary, DataTable, Board } from "@tooxs/ui";
```

## Checklist de release

- [ ] `npm run typecheck` (en `packages/ui`) verde.
- [ ] `npm run build` genera `dist/` (ESM + `.d.ts`).
- [ ] Bump de versión (semver) + `CHANGELOG`.
- [ ] `npm publish` a GitHub Packages (org `tooxs`).
- [ ] Probar `npm i @tooxs/ui` en una app limpia (`@source` + peers, sin
      `transpilePackages`) y `next build`.
