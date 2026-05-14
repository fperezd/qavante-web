import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteInput } from "./qavante-input";

const meta = {
  title: "Capa 1 / QavanteInput",
  component: QavanteInput,
  parameters: {
    docs: {
      description: {
        component:
          "Input canónico con 5 variants: text, number, currency (formatClp), date, rut (formatRut + isValidRut validación). Anexo B.2 del Doc Maestro.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["text", "number", "currency", "date", "rut"],
    },
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
} satisfies Meta<typeof QavanteInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: { variant: "text", placeholder: "Nombre del responsable…" },
};

export const Number: Story = {
  args: { variant: "number", placeholder: "0" },
};

export const Currency: Story = {
  args: { variant: "currency", placeholder: "$0" },
  parameters: {
    docs: {
      description: {
        story: "Auto-formatea como CLP es-CL: `1234567` → `$1.234.567`.",
      },
    },
  },
};

export const Date: Story = {
  args: { variant: "date" },
};

export const Rut: Story = {
  args: { variant: "rut", placeholder: "76.123.456-7" },
  parameters: {
    docs: {
      description: {
        story:
          "Auto-formatea + valida DV módulo 11 al blur. Si está inválido + touched, agrega `aria-invalid=true` + borde danger.",
      },
    },
  },
};

export const Disabled: Story = {
  args: { variant: "text", disabled: true, value: "no editable" },
};

export const Invalid: Story = {
  args: { variant: "text", invalid: true, value: "valor inválido" },
};
