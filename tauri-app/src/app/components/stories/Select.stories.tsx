import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../Select";

const meta: Meta = {
  title: "Components/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cpu">CPU Usage</SelectItem>
        <SelectItem value="gpu">GPU Usage</SelectItem>
        <SelectItem value="ram">RAM Usage</SelectItem>
        <SelectItem value="fps">FPS</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <Select defaultValue="gpu">
      <SelectTrigger className="w-[220px]" label="Metric:">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cpu">CPU Usage</SelectItem>
        <SelectItem value="gpu">GPU Usage</SelectItem>
        <SelectItem value="ram">RAM Usage</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[220px]" variant="disabled">
        <SelectValue placeholder="Disabled" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="x">X</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, width: 220 }}
      >
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Default
        </span>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cpu">CPU Usage</SelectItem>
            <SelectItem value="gpu">GPU Usage</SelectItem>
            <SelectItem value="ram">RAM Usage</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, width: 220 }}
      >
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          With label
        </span>
        <Select>
          <SelectTrigger label="Metric:">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cpu">CPU Usage</SelectItem>
            <SelectItem value="gpu">GPU Usage</SelectItem>
            <SelectItem value="ram">RAM Usage</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, width: 220 }}
      >
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Disabled
        </span>
        <Select disabled>
          <SelectTrigger variant="disabled">
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="x">X</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, width: 220 }}
      >
        <span className="text-body-sm-regular text-[var(--textParagraph2)]">
          Grouped
        </span>
        <Select defaultValue="cpu-temp">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>CPU</SelectLabel>
              <SelectItem value="cpu-usage">CPU Usage</SelectItem>
              <SelectItem value="cpu-temp">CPU Temp</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>GPU</SelectLabel>
              <SelectItem value="gpu-usage">GPU Usage</SelectItem>
              <SelectItem value="gpu-temp">GPU Temp</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
};
