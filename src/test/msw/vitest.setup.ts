/* Setup global para vitest: arranca el server MSW antes de cualquier test,
   resetea handlers + db entre tests, y cierra al final. Referenciado por
   vitest.config.ts via `test.setupFiles`. */
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./node";
import { resetDb } from "./db";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  resetDb();
});

afterAll(() => {
  server.close();
});
