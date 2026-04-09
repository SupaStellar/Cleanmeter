import type { Meta, StoryObj } from "@storybook/react-vite";
import { Keycap } from "../Keycap";

const meta: Meta<typeof Keycap> = {
  title: "Components/Keycap",
  component: Keycap,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Keycap>;

export const Default: Story = {
  args: {
    keys: [
      { label: "Ctrl", className: "w-10" },
      { label: "Alt", className: "w-10" },
      { label: "F10", className: "w-8" },
    ],
  },
};

export const SingleKey: Story = {
  args: {
    keys: ["Esc"],
  },
};

export const TwoKeys: Story = {
  args: {
    keys: [
      { label: "Ctrl", className: "w-10" },
      { label: "S", className: "w-8" },
    ],
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Single key
        </span>
        <Keycap keys={["Esc"]} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Two keys
        </span>
        <Keycap keys={[{ label: "Ctrl", className: "w-10" }, "S"]} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Three keys (Figma reference)
        </span>
        <Keycap
          keys={[
            { label: "Ctrl", className: "w-10" },
            { label: "Alt", className: "w-10" },
            { label: "F10", className: "w-8" },
          ]}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Custom width
        </span>
        <Keycap keys={[{ label: "Space", className: "w-20" }]} />
      </div>
    </div>
  ),
};
