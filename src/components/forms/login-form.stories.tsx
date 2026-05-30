import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoginForm } from "./login-form";

/* LoginForm — ruta `/login`, la pantalla más crítica del producto (puerta
   de entrada). Usa react-hook-form + zod (validación RUT/clave), `useRouter`
   /`useSearchParams` (auto-mockeados por @storybook/nextjs-vite) y `api.post`
   en submit. El snapshot captura el estado inicial (form vacío); los estados
   de error de validación y de submit se ejercitan por interacción en la UI
   de Storybook (no en el snapshot). */
const meta = {
  title: "Auth / LoginForm",
  component: LoginForm,
  parameters: {
    layout: "centered",
    /* Primera story del repo con hooks de App Router (useRouter/
       useSearchParams): appDirectory monta el router mockeado del
       framework. Sin esto: "invariant expected app router to be mounted". */
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "Formulario de login (RUT + clave). Validación con zod: RUT válido (isValidRut) + clave ≥6. Toggle de visibilidad de clave, link a recuperar clave, y mapeo de error de submit vía apiErrorToUserMessage. En éxito redirige a `?redirect` o `/inicio`.",
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
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Inicial (form vacío)",
};
