import { redirect } from "next/navigation";

/* Raíz del dominio (app.qavante.com/). No tiene contenido propio: la app vive en
   el route group (app) detrás del login. Redirige a /inicio → el middleware lo
   gatea (sin sesión → /login?redirect=/inicio; con sesión → dashboard). Antes
   acá quedaba el skeleton "Sprint C0", que no debe ser la landing del producto. */
export default function Home() {
  redirect("/inicio");
}
