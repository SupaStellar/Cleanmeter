import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CollapsibleCard } from "@/components/settings/style/CollapsibleCard";
import { Disclosure } from "@/components/ui/Disclosure";
import { Switch } from "@/components/shadcn/switch";
import { TooltipHint } from "@/components/shadcn/tooltip";
import { Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose } from "@/components/shadcn/dialog";
import { Toast } from "@/components/ui/Toast";
import { useToastStore } from "@/stores/toast-store";

const meta: Meta = {
  title: "Components/Interactions",
  parameters: { layout: "centered", docs: { description: { component: "The live app's accordion, panel, dialog, toast and tooltip implementations. Motion comes from transitions.dev snippets. Use the OS/browser reduced-motion setting to verify instant states. These demos do not emit sounds." } } },
};
export default meta;
type Story = StoryObj;
export const Accordion: Story = { render: () => <div className="w-[500px]"><CollapsibleCard title="Details"><label>Preserved input <input className="border p-2" defaultValue="Keep this value" /></label></CollapsibleCard></div> };
function PanelExample() {
  const [open, setOpen] = useState(false);
  return <div className="w-[500px] rounded-xl bg-card p-5"><label className="flex items-center justify-between">Show options<Switch checked={open} onCheckedChange={setOpen} /></label><Disclosure open={open} variant="panel" className="pt-5"><input aria-label="Panel input" className="border p-2" defaultValue="Preserved across toggles" /></Disclosure></div>;
}
export const Panel: Story = { render: () => <PanelExample /> };
export const Modal: Story = { render: () => <Dialog><DialogTrigger className="rounded border p-3">Open dialog</DialogTrigger><DialogPortal><DialogOverlay /><DialogContent aria-describedby={undefined}><DialogTitle>Example dialog</DialogTitle><input aria-label="Dialog input" className="border p-2" /><DialogClose className="border p-2">Close</DialogClose></DialogContent></DialogPortal></Dialog> };
export const Tooltip: Story = { render: () => <TooltipHint text="Short help text"><button className="rounded border p-3">Hover or focus</button></TooltipHint> };
export const ToastRepeat: Story = { render: () => <div className="relative h-[250px] w-[651px]"><button className="border p-3" onClick={() => useToastStore.getState().showToast("Shortcut already in use")}>Show or repeat toast</button><Toast /></div> };
