import { useRef } from "react";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { useSettingsStore } from "@/stores/settings-store";
import { SectionCard } from "./SectionCard";

export function FpsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const presentMonApps = useSettingsStore((s) => s.presentMonApps);
  const { framerate, frametime } = settings.sensors;
  const anyEnabled = framerate.isEnabled || frametime.isEnabled;
  const prevState = useRef<{ framerate: boolean; frametime: boolean } | null>(null);

  return (
    <SectionCard
      title="FPS"
      enabled={anyEnabled}
      onToggle={(enabled) => {
        if (!enabled) {
          prevState.current = { framerate: framerate.isEnabled, frametime: frametime.isEnabled };
          updateSensor("framerate", { isEnabled: false });
          updateSensor("frametime", { isEnabled: false });
        } else {
          const prev = prevState.current;
          updateSensor("framerate", { isEnabled: prev ? prev.framerate : true });
          updateSensor("frametime", { isEnabled: prev ? prev.frametime : true });
        }
      }}
    >
      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={framerate.isEnabled}
            onCheckedChange={(v) => updateSensor("framerate", { isEnabled: v === true })}
          />
          <span className="text-[14px] font-medium text-foreground">Frame count</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={frametime.isEnabled}
            onCheckedChange={(v) => updateSensor("frametime", { isEnabled: v === true })}
          />
          <span className="text-[14px] font-medium text-foreground">Frame time graph</span>
        </label>
      </div>

      {presentMonApps.length > 0 && (
        <div className="flex flex-col gap-3">
          <Select
            value={framerate.customReadingId || "__auto__"}
            onValueChange={(v) =>
              updateSensor("framerate", { customReadingId: v === "__auto__" ? "" : v })
            }
          >
            <SelectTrigger className="h-10 rounded-[8px] text-[14px]">
              <span className="flex items-center gap-2">
                <span className="text-[14px] font-normal text-muted-foreground">Monitor app:</span>
                <SelectValue placeholder="Auto" />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Auto</SelectItem>
              {presentMonApps.map((app) => (
                <SelectItem key={app} value={app}>
                  {app}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Info className="size-4 text-muted-foreground" strokeWidth={2} />
            <span className="text-[12px] font-medium text-muted-foreground">
              Apps are auto updated every 10 seconds.
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
