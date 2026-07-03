import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { AppSidebar } from "./sidebar";

/* AppSidebar — navegación principal. Filtra el módulo Administración por
   rol (solo owner/admin/technical_admin lo ven; gate UX, el backend impone
   la regla real con 403). Usa usePathname (App Router) → appDirectory + un
   pathname mockeado para el resaltado del item activo. */
const meta = {
  title: "Shell / AppSidebar",
  component: AppSidebar,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/inicio" } },
    docs: {
      description: {
        component:
          "Sidebar de navegación. El módulo Administración solo aparece para owner/admin/technical_admin (matriz Anexo C.4). Con userRole undefined (sesión rota) cae al default seguro: tampoco lo muestra. El item de la ruta activa queda resaltado.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[560px]">
        <Story />
      </div>
    ),
  ],
  args: {
    mobileOpen: false,
    onCloseMobile: fn(),
  },
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {
  name: "Owner (ve Administración)",
  args: { userRole: "owner" },
};

export const Viewer: Story = {
  name: "Viewer (sin Administración)",
  args: { userRole: "viewer" },
};

export const SinRol: Story = {
  name: "Sin rol (default seguro, sin Administración)",
  args: { userRole: undefined },
};

export const MobileAbierto: Story = {
  name: "Drawer mobile abierto",
  args: { userRole: "admin", mobileOpen: true },
};

export const ConRemuneraciones: Story = {
  name: "Con Remuneraciones (flag ON)",
  args: { userRole: "owner", remuneracionesEnabled: true },
};
