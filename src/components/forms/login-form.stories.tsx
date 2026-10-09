import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { LoginForm } from "./login-form";

/* LoginForm — ruta `/login-rut`, login por RUT (puerta
   de entrada). Usa la validación contractual de RUT/clave, `useRouter`
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
          "Formulario de login por RUT. Valida RUT chileno + clave ≥6. Toggle de visibilidad de clave, enlace a recuperar clave (`/recuperar-clave`) y mapeo de error de submit vía apiErrorToUserMessage. En éxito redirige a `?redirect` o `/inicio`. El login principal (correo/OAuth) vive en `/login-correo`.",
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

export const ValidacionLocal: Story = {
  name: "Validación local",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Iniciar sesión" }));
    await expect(canvas.getByText("RUT requerido")).toBeVisible();
    await expect(canvas.getByText("Mínimo 6 caracteres")).toBeVisible();

    await userEvent.type(canvas.getByLabelText("RUT"), "11.111.111-1");
    await userEvent.type(canvas.getByLabelText("Clave", { selector: "input" }), "123456");
    await userEvent.click(canvas.getByRole("button", { name: "Mostrar clave" }));
    await expect(canvas.getByLabelText("Clave", { selector: "input" })).toHaveAttribute(
      "type",
      "text",
    );
    await expect(canvas.queryByText("RUT requerido")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Mínimo 6 caracteres")).not.toBeInTheDocument();
  },
};
