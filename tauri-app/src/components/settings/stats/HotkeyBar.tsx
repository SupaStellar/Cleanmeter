import { Info } from "lucide-react";
import { Switch } from "@/components/shadcn/switch";
import { useSettingsStore } from "@/stores/settings-store";

function Kbd({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      className="flex h-8 items-center justify-center rounded-[10px] bg-primary text-[13px] font-normal text-primary-foreground"
      style={{ width: wide ? 40 : 32, fontFamily: "Inter, sans-serif" }}
    >
      {children}
    </span>
  );
}

export function HotkeyBar() {
  const overlayVisible = useSettingsStore((s) => s.overlayVisible);
  const setOverlayVisible = useSettingsStore((s) => s.setOverlayVisible);

  return (
    <div className="flex w-full flex-col gap-3 rounded-[12px] border border-border px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Info className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="truncate text-[14px] font-medium text-foreground">
            Show overlay
          </span>
        </div>
        <Switch
          checked={overlayVisible}
          onCheckedChange={setOverlayVisible}
          aria-label="Show overlay"
        />
      </div>
      <div className="h-px w-full bg-divider" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">
          Hot key for showing/hiding the overlay
        </span>
        <div className="flex items-center gap-1">
          <Kbd wide>Ctrl</Kbd>
          <span className="text-[14px] font-medium text-muted-foreground">+</span>
          <Kbd wide>Alt</Kbd>
          <span className="text-[14px] font-medium text-muted-foreground">+</span>
          <Kbd>F10</Kbd>
        </div>
      </div>
    </div>
  );
}
