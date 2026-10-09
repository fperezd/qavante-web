import { redirect } from "next/navigation";

/** Conexiones vive bajo Administración; conservamos la ruta antigua como redirección. */
export default function ConexionesRedirectPage() {
  redirect("/administracion/conexiones");
}
