import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedbackDialog } from "../../../components/settings/settings/FeedbackDialog";

const meta: Meta<typeof FeedbackDialog> = {
  title: "Settings/FeedbackDialog",
  component: FeedbackDialog,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof FeedbackDialog>;

// Stubbed picker so the story can show the attachment chip without an OS dialog.
const fakePicker = async () => ({ path: "/tmp/Screenshot245.jpeg", name: "Screenshot245.jpeg" });

export const Empty: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return <FeedbackDialog open={open} onOpenChange={setOpen} pickAttachment={fakePicker} />;
  },
};

export const WithAttachment: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return <FeedbackDialog open={open} onOpenChange={setOpen} pickAttachment={fakePicker} />;
  },
};
