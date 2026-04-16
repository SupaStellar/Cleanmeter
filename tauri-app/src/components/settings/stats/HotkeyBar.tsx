import { Info } from "lucide-react";

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
  return (
    <div className="flex w-full items-center justify-between rounded-[12px] border border-border px-4 py-4">
      <div className="flex items-center gap-2">
        <Info className="size-5 text-muted-foreground" strokeWidth={2} />
        <span className="text-[14px] font-medium text-foreground">
          Hot key for showing/hiding the overlay
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Kbd wide>Ctrl</Kbd>
        <span className="text-[14px] font-medium text-muted-foreground">+</span>
        <Kbd wide>Alt</Kbd>
        <span className="text-[14px] font-medium text-muted-foreground">+</span>
        <Kbd>F10</Kbd>
      </div>
    </div>
  );
}
