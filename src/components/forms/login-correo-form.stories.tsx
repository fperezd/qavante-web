import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoginCorreoForm } from "./login-correo-form";

/* LoginCorreoForm — ruta `/login-correo` (login principal). RUT en `/login-rut`. */
const meta = {
  title: "Auth / LoginCorreoForm",
  component: LoginCorreoForm,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "Formulario de login por correo. Primero Google/Microsoft, luego correo + clave. Validación con zod: email + clave ≥6. Toggle de visibilidad de clave, textos a recuperar clave (`/recuperar-clave`) y registro (`/registro`), y mapeo de error de submit vía apiErrorToUserMessage. En éxito redirige a `?redirect` o `/inicio`.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginCorreoForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Inicial (form vacío)",
};
