import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardContent, CardFooter, CardTitle } from "../Card";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

function InteractiveCard({ defaultActive = false }: { defaultActive?: boolean }) {
  const [active, setActive] = useState(defaultActive);
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

export const Default: Story = {
  render: () => <InteractiveCard />,
};

export const Active: Story = {
  render: () => <InteractiveCard defaultActive />,
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Default (click to toggle)
        </span>
        <InteractiveCard />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Active (click to toggle)
        </span>
        <InteractiveCard defaultActive />
      </div>
    </div>
  ),
};
