import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

/* Flujo de usuario REAL — Administración → Usuarios.

   Cubre el bug que tenía la pantalla: nunca le pasaba `currentUserRole` a la tabla ni al dialog,
   así que llegaba `undefined` y la rama "salvo que vos seas owner" de users-table.tsx quedaba
   muerta: NADIE podía asignar el rol Dueño, ni el propio dueño (que es el único que puede
   transferir la propiedad, ROLE_DESCRIPTIONS). Ahora la página lee /api/me.

   MSW sirve /api/me (rol owner) y /api/users (semilla de 4 usuarios). */

test.describe("Flujo: Usuarios (/administracion/usuarios)", () => {
  test("el dueño puede cambiar el rol de otro usuario y le ofrece Dueño (transferir propiedad)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/usuarios");

    await expect(page.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
    await expect(page.getByText("admin@empresa.cl")).toBeVisible();

    // La fila es editable → botón para cambiar el rol (si no fuera editable sería texto plano).
    const cambiar = page.getByRole("button", { name: "Cambiar rol de admin@empresa.cl" });
    await expect(cambiar).toBeVisible();
    await cambiar.click();

    // El <select> ofrece "Dueño" porque el usuario logueado ES owner. Ésta es la rama que
    // estaba muerta: con currentUserRole undefined, "Dueño" se filtraba siempre.
    const select = page.getByRole("combobox");
    await expect(select).toBeVisible();
    await expect(select.getByRole("option", { name: "Dueño" })).toHaveCount(1);
    await expect(select.getByRole("option", { name: "Administrador" })).toHaveCount(1);
  });

  test("la fila del propio dueño también es editable para el dueño", async ({ page, context }) => {
    await loginAs(context, "owner");
    await page.goto("/administracion/usuarios");

    await expect(page.getByText("fperez@tooxs.com")).toBeVisible();
    // Antes esta fila caía a texto plano (read-only) incluso para el dueño.
    await expect(
      page.getByRole("button", { name: "Cambiar rol de fperez@tooxs.com" }),
    ).toBeVisible();
  });
});
