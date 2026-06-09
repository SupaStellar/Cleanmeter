import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "../Textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Empty: Story = {
  render: () => (
    <div style={{ width: 563 }}>
      <Textarea placeholder="Your feedback here..." />
    </div>
  ),
};

export const Filled: Story = {
  render: () => (
    <div style={{ width: 563 }}>
      <Textarea defaultValue={"Line one\nLine two"} />
    </div>
  ),
};
