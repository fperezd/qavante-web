import { MaquetaAviso } from "@/components/maquetas/maqueta-aviso";
import { BancoMaqueta } from "@/components/maquetas/banco-maqueta";

/* El aviso de maqueta va ANTES de la maqueta, siempre: la primera cosa que se lee tiene que
   ser de qué están hechas las cifras que vienen abajo. */
export default function BancoMaquetaPage() {
  return (
    <div className="space-y-5">
      <MaquetaAviso pantallaReal={{ href: "/banco", label: "Banco" }} />
      <BancoMaqueta />
    </div>
  );
}
