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

// Stubbed picker so "Add attachment" shows the chip without an OS file dialog.
const fakePicker = async () => ({ path: "/tmp/Screenshot245.jpeg", name: "Screenshot245.jpeg" });

// Click "Add attachment" in the rendered story to see the attachment-chip state.
export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return <FeedbackDialog open={open} onOpenChange={setOpen} pickAttachment={fakePicker} />;
  },
};
