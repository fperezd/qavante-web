import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PasswordInput } from "./password-input";

const meta = {
  title: "Capa 2 / Credenciales / PasswordInput",
  component: PasswordInput,
  parameters: {
    docs: {
      description: {
        component:
          "Wrapper raw de `<input type=\"password\">` con styling Qavante. `QavanteInput` omitea `type`, así que para campos de clave se usa este componente directamente. `autoComplete='new-password'` para evitar autofill no deseado.",
      },
    },
  },
  argTypes: {
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
  args: {
    placeholder: "Clave SII",
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: "abc" },
};

export const Disabled: Story = {
  args: { disabled: true },
};
