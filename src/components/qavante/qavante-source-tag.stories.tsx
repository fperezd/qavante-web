import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QavanteSourceTag } from "./qavante-source-tag";

const meta = {
  title: "Capa 1 / QavanteSourceTag",
  component: QavanteSourceTag,
  parameters: {
    docs: {
      description: {
        component:
          "Etiqueta que identifica fuente de datos. Anexo B.6 fila 20 del Doc Maestro. Las fuentes están alineadas con conectores wireados en backend: SII (con sub-fuentes RCV/DTE/BHE), BICE (bancos), Buk (nómina), TGR (tesorería), Previred + fallback Manual.",
      },
    },
  },
  argTypes: {
    source: {
      control: "select",
      options: ["sii", "sii-rcv", "sii-dte", "sii-bhe", "bice", "buk", "tgr", "previred", "manual"],
    },
  },
} satisfies Meta<typeof QavanteSourceTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sii: Story = {
  args: { source: "sii" },
};

export const SiiRcv: Story = {
  args: { source: "sii-rcv" },
};

export const SiiDte: Story = {
  args: { source: "sii-dte" },
};

export const SiiBhe: Story = {
  args: { source: "sii-bhe" },
};

export const Bice: Story = {
  args: { source: "bice" },
};

export const Buk: Story = {
  args: { source: "buk" },
};

export const Tgr: Story = {
  args: { source: "tgr" },
};

export const Previred: Story = {
  args: { source: "previred" },
};

export const Manual: Story = {
  args: { source: "manual" },
};

export const AllSources: Story = {
  args: { source: "sii" },
  parameters: {
    docs: {
      description: {
        story: "Las 9 fuentes en una sola vista, para verlas comparativamente.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <QavanteSourceTag source="sii" />
      <QavanteSourceTag source="sii-rcv" />
      <QavanteSourceTag source="sii-dte" />
      <QavanteSourceTag source="sii-bhe" />
      <QavanteSourceTag source="bice" />
      <QavanteSourceTag source="buk" />
      <QavanteSourceTag source="tgr" />
      <QavanteSourceTag source="previred" />
      <QavanteSourceTag source="manual" />
    </div>
  ),
};
