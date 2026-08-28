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

/**
 * The cap inside the shortcut field (Figma 2792:4118). Shorter, outlined
 * rather than moulded, no "+" between caps, and it takes its text colour from
 * the row — which is how the Blue/600 capture board is drawn.
 */
export const Light: Story = {
  args: {
    variant: "light",
    keys: ["Ctrl", "Shift", "R"],
  },
};

export const LightCapturing: Story = {
  args: {
    variant: "light",
    keys: ["Shift", "F9"],
    className: "text-[#155dfc]",
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
