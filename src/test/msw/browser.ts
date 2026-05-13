/* Worker MSW para activación en `npm run dev` (browser).
   El service worker file vive en public/mockServiceWorker.js, generado
   por `npx msw init public/` (ver ADR-0005). */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
