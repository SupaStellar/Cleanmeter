import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MenuBoxed, MenuBoxedItem } from "../MenuBoxed";

const meta: Meta<typeof MenuBoxed> = {
  title: "Components/MenuBoxed",
  component: MenuBoxed,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MenuBoxed>;

function InteractiveMenuBoxed({ tabs }: { tabs: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <MenuBoxed>
      {tabs.map((label, i) => (
        <MenuBoxedItem
          key={label}
          active={i === activeIndex}
          onClick={() => setActiveIndex(i)}
        >
          {label}
        </MenuBoxedItem>
      ))}
    </MenuBoxed>
  );
}

export const TwoTabs: Story = {
  render: () => <InteractiveMenuBoxed tabs={["Tab 1", "Tab 2"]} />,
};

export const ThreeTabs: Story = {
  render: () => <InteractiveMenuBoxed tabs={["Tab 1", "Tab 2", "Tab 3"]} />,
};

export const FourTabs: Story = {
  render: () => (
    <InteractiveMenuBoxed tabs={["Tab 1", "Tab 2", "Tab 3", "Tab 4"]} />
  ),
};

export const FiveTabs: Story = {
  render: () => (
    <InteractiveMenuBoxed
      tabs={["Tab 1", "Tab 2", "Tab 3", "Tab 4", "Tab 5"]}
    />
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {[2, 3, 4, 5, 6].map((count) => (
        <div
          key={count}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <span className="text-body-sm-regular text-[var(--textParagraph2)]">
            {count} tabs
          </span>
          <InteractiveMenuBoxed
            tabs={Array.from({ length: count }, (_, i) => `Tab ${i + 1}`)}
          />
        </div>
      ))}
    </div>
  ),
};
