/* Server MSW para vitest (Node). Llamado desde src/test/msw/vitest.setup.ts. */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
