import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardContent, CardFooter, CardMinimal, CardTitle } from "../Card";

type CardVariant = "default" | "minimal";

interface CardArgs {
  variant: CardVariant;
  defaultActive?: boolean;
}

function InteractiveCard({
  variant = "default",
  defaultActive = false,
}: CardArgs) {
  const [active, setActive] = useState(defaultActive);

  if (variant === "minimal") {
    return (
      <CardMinimal
        className="w-[180px]"
        active={active}
        label="Heading"
        onClick={() => setActive(!active)}
      />
    );
  }

  return (
    <Card
      className="h-[187px] w-[273px]"
      active={active}
      onClick={() => setActive(!active)}
    >
      <CardContent />
      <CardFooter>
        <CardTitle>Heading</CardTitle>
      </CardFooter>
    </Card>
  );
}

const meta: Meta<CardArgs> = {
  title: "Components/Card",
  component: InteractiveCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "radio" },
      options: ["default", "minimal"],
    },
    defaultActive: {
      control: { type: "boolean" },
    },
  },
  args: {
    variant: "default",
    defaultActive: false,
  },
};

export default meta;
type Story = StoryObj<CardArgs>;

export const Default: Story = {
  args: { variant: "default", defaultActive: false },
};

export const Active: Story = {
  args: { variant: "default", defaultActive: true },
};

export const Minimal: Story = {
  args: { variant: "minimal", defaultActive: false },
};

export const MinimalActive: Story = {
  args: { variant: "minimal", defaultActive: true },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Default (click to toggle)
        </span>
        <InteractiveCard variant="default" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Default Active (click to toggle)
        </span>
        <InteractiveCard variant="default" defaultActive />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Minimal (click to toggle)
        </span>
        <InteractiveCard variant="minimal" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Minimal Active (click to toggle)
        </span>
        <InteractiveCard variant="minimal" defaultActive />
      </div>
    </div>
  ),
};
