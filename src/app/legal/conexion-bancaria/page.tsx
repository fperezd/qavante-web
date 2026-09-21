import type { Metadata } from "next";
import { ConexionBancariaLegalDoc } from "@/components/legal/conexion-bancaria-doc";

export const metadata: Metadata = {
  title: "Condiciones y privacidad de la conexión bancaria · Qavante",
  description:
    "Términos y condiciones y política de privacidad (borrador de demostración) para conectar bancos a Qavante a través de Fintoc.",
};

export default function ConexionBancariaLegalPage() {
  return <ConexionBancariaLegalDoc />;
}
