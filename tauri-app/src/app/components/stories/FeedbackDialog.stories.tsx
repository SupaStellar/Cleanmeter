import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
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

export const OptionalEmail: Story = {
  ...Default,
  play: async () => {
    const dialog = within(document.body).getByRole("dialog");
    const email = within(dialog).getByRole("textbox", { name: "Email (optional)" });
    await userEvent.type(email, "invalid");
    await userEvent.tab();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(email);
    await userEvent.type(email, "reply@example.com");
    await expect(email).toHaveAttribute("aria-invalid", "false");
  },
};

// Click "Add attachment" to see the picker error state.
const failingPicker = async (): Promise<null> => {
  throw "The file is open in another program.";
};

export const PickerError: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return <FeedbackDialog open={open} onOpenChange={setOpen} pickAttachment={failingPicker} />;
  },
};
