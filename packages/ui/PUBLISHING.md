# Publicar y consumir `@tooxs/ui`

`@tooxs/ui` se distribuye como **source TypeScript** (no bundle): el consumidor
(Next.js) lo transpila con `transpilePackages`. Esta es una decisión deliberada —
garantiza correctness RSC: Next respeta los `"use client"` **por archivo**, y las
utilidades puras (`cn`, lógica de estado) quedan server-safe. Un bundle merge mete
`cn` en un chunk `"use client"` y rompe los componentes server que lo usan.

> Si en el futuro se quiere zero-config (sin `transpilePackages`), se puede agregar
> un build con **bunchee** + entries separados para las utilidades puras, y validar
> el `dist` en un Next real antes de publicar.

## Publicar a un registry privado

El scope `@tooxs` debe existir en el registry elegido.

### Opción A — GitHub Packages

Requiere una organización `tooxs` en GitHub (el scope = owner). En `.npmrc`:

```
@tooxs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
cd packages/ui
npm version patch          # o minor/major
npm publish                # publishConfig.access = restricted
```

### Opción B — npm privado (org @tooxs en npmjs.com)

```
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

```bash
cd packages/ui && npm publish --access restricted
```

### Opción C — Verdaccio (registry self-hosted)

```
@tooxs:registry=http://localhost:4873
```

## Consumir en una app nueva (Next.js 15 + Tailwind v4)

```bash
npm i @tooxs/ui
# peers (deduplicados en tu app):
npm i react react-dom recharts @tanstack/react-table \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**1. `next.config.ts`** — transpilar el paquete:

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { transpilePackages: ["@tooxs/ui"] };
export default nextConfig;
```

**2. `globals.css`** — Tailwind debe escanear el paquete (ignora `node_modules` por
defecto) y cargar los tokens:

```css
@import "tailwindcss";
@source "../../node_modules/@tooxs/ui/src"; /* genera las clases del paquete */
@import "@tooxs/ui/styles.css"; /* tokens + @theme de marca */
```

> Ajustá el path de `@source` según dónde viva tu `globals.css`.

**3. Montá el `Toaster` una vez** (provider client):

```tsx
"use client";
import { Toaster } from "@tooxs/ui";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
```

**4. Theming / white-label** — sobreescribí los defaults en tu `:root`:

```css
:root {
  --brand-primary: #7c3aed;
  --brand-deep: #2a1065;
}
```

**5. Usalo:**

```tsx
import { Button, Card, AsyncBoundary, DataTable, Board } from "@tooxs/ui";
```

## Checklist de release

- [ ] `npm run typecheck` (en `packages/ui`) verde.
- [ ] Bump de versión (semver).
- [ ] `CHANGELOG` actualizado.
- [ ] `npm publish` al registry correcto.
- [ ] Probar `npm i @tooxs/ui` en una app limpia (transpilePackages + @source).
