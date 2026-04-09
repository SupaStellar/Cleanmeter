import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../Input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    dotColor: { control: "color" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Text",
    label: "Label",
    prefix: "0%",
  },
  render: (args) => <Input className="w-[297px]" {...args} />,
};

export const WithoutPrefix: Story = {
  args: {
    placeholder: "Enter a value",
    label: "Label",
  },
  render: (args) => <Input className="w-[297px]" {...args} />,
};

export const WithoutLabel: Story = {
  args: {
    placeholder: "Text",
    prefix: "0%",
  },
  render: (args) => <Input className="w-[297px]" {...args} />,
};

export const Error: Story = {
  args: {
    placeholder: "Text",
    label: "Label",
    prefix: "0%",
    error: true,
  },
  render: (args) => <Input className="w-[297px]" {...args} />,
};

export const Disabled: Story = {
  args: {
    placeholder: "Text",
    label: "Label",
    prefix: "0%",
    disabled: true,
  },
  render: (args) => <Input className="w-[297px]" {...args} />,
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 297 }}>
          <span className="text-body-sm-regular text-[var(--textParagraph2)]">Default</span>
          <Input placeholder="Text" label="Label" prefix="0%" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 297 }}>
          <span className="text-body-sm-regular text-[var(--textParagraph2)]">Filled</span>
          <Input label="Label" prefix="0%" defaultValue="Text" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 297 }}>
          <span className="text-body-sm-regular text-[var(--textParagraph2)]">Disabled</span>
          <Input placeholder="Text" label="Label" prefix="0%" disabled />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 297 }}>
          <span className="text-body-sm-regular text-[var(--textParagraph2)]">Error</span>
          <Input placeholder="Text" label="Label" prefix="0%" error />
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 297 }}>
          <span className="text-body-sm-regular text-[var(--textParagraph2)]">Error + Filled</span>
          <Input label="Label" prefix="0%" defaultValue="Text" error />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 297 }}>
          <span className="text-body-sm-regular text-[var(--textParagraph2)]">No prefix</span>
          <Input placeholder="Enter a value" label="Label" />
        </div>
      </div>
    </div>
  ),
};
