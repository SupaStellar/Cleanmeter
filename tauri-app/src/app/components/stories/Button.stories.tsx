import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button";

const DarkCanvas = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-full items-center justify-center bg-[var(--bgBrand)] p-[var(--spacingXxl)]">
    {children}
  </div>
);

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["filled-white", "filled-dark", "link"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    children: {
      control: "text",
    },
  },
  args: {
    variant: "filled-dark",
    size: "md",
    children: "Update now",
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const FilledWhiteSm: Story = {
  args: {
    variant: "filled-white",
    size: "sm",
    children: "Update now",
  },
  decorators: [
    (Story) => (
      <DarkCanvas>
        <Story />
      </DarkCanvas>
    ),
  ],
};

export const FilledWhiteMd: Story = {
  args: {
    variant: "filled-white",
    size: "md",
    children: "Update now",
  },
  decorators: [
    (Story) => (
      <DarkCanvas>
        <Story />
      </DarkCanvas>
    ),
  ],
};

export const FilledDarkMd: Story = {
  args: {
    variant: "filled-dark",
    size: "md",
    children: "Update now",
  },
};

export const LinkSm: Story = {
  args: {
    variant: "link",
    size: "sm",
    children: "Later",
  },
  decorators: [
    (Story) => (
      <DarkCanvas>
        <Story />
      </DarkCanvas>
    ),
  ],
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-[var(--spacingL)]">
      <DarkCanvas>
        <div className="flex items-center gap-[var(--spacingM)]">
          <Button variant="filled-white" size="sm">Update now</Button>
          <Button variant="filled-white" size="md">Update now</Button>
        </div>
      </DarkCanvas>
      <div className="flex items-center justify-center gap-[var(--spacingM)] p-[var(--spacingL)]">
        <Button variant="filled-dark" size="md">Update now</Button>
      </div>
      <DarkCanvas>
        <Button variant="link" size="sm">Later</Button>
      </DarkCanvas>
    </div>
  ),
};
