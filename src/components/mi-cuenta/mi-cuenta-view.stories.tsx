import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MiCuentaContent } from "./mi-cuenta-view";
import type { MeUser } from "@/lib/api/users";

const meta = {
  title: "Mi cuenta / MiCuentaContent",
  component: MiCuentaContent,
  parameters: {
    docs: {
      description: {
        component:
          "Pantalla Mi cuenta: perfil del usuario logueado (nombre, correo, empresa, rol, último ingreso) + cerrar sesión. `MiCuentaContent` es la versión presentacional (recibe MeUser por prop); `MiCuentaView` envuelve con useMe() + estados loading/error. El botón de logout vive en un subcomponente que consume useLogout() — acá se renderiza pero no dispara (el QueryClientProvider del preview alcanza para montarlo).",
      },
    },
  },
} satisfies Meta<typeof MiCuentaContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const FERNANDO: MeUser = {
  id: "6c25a9b0-d100-4881-a372-a91748fecd9a",
  email: "fperez@tooxs.com",
  role: "owner",
  tenant_id: "a1d8143e-a1f7-410b-ac60-e7f15708488c",
  onboarding_completed: true,
  name: "Fernando Perez",
  last_login_at: "2026-05-28T15:40:13.929323Z",
  permissions: [],
};

export const Owner: Story = {
  args: { user: FERNANDO },
};

export const Admin: Story = {
  args: {
    user: {
      ...FERNANDO,
      name: "Ana López",
      email: "ana@empresa.cl",
      role: "admin",
    },
  },
};

export const FinanceManager: Story = {
  args: {
    user: {
      ...FERNANDO,
      name: "Carlos Pérez",
      email: "carlos@empresa.cl",
      role: "finance_manager",
    },
  },
};

export const Viewer: Story = {
  args: {
    user: {
      ...FERNANDO,
      name: "Sofía Rojas",
      email: "sofia@empresa.cl",
      role: "viewer",
    },
  },
};

export const SinNombre: Story = {
  args: {
    user: {
      ...FERNANDO,
      name: null,
      email: "anonimo@empresa.cl",
    },
  },
};

export const SinUltimoLogin: Story = {
  args: {
    user: {
      ...FERNANDO,
      last_login_at: null,
    },
  },
};
