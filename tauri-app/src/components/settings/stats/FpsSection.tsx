import { useRef } from "react";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/shadcn/select";
import { SelectFieldTrigger } from "@/components/ui/SelectField";
import { InfoIcon } from "../settings/icons";
import { useSettingsStore } from "@/stores/settings-store";
import { AUTO_OPTION, monitorAppOptions } from "@/lib/fps-apps";
import { SectionCard } from "./SectionCard";

export function FpsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const presentMonApps = useSettingsStore((s) => s.presentMonApps);
  const { framerate, frametime } = settings.sensors;
  const anyEnabled = framerate.isEnabled || frametime.isEnabled;
  const prevState = useRef<{ framerate: boolean; frametime: boolean } | null>(null);
  // `|| ""` guards a settings.json written before targetAppName existed, where
  // the field is absent at runtime whatever the type says.
  const { value: selectedApp, options: appOptions } = monitorAppOptions({
    apps: presentMonApps,
    target: framerate.targetAppName || "",
  });

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

      {/* Always rendered. This used to be gated on the app list having
          entries, but that list is only what PresentMon saw presenting
          recently, so the control disappeared at the desktop and whenever a
          fullscreen game stopped presenting, taking Auto (and any pick the
          user wanted to undo) with it. See monitorAppOptions. */}
      <div className="flex flex-col gap-[var(--spacingS)]">
        <Select
          value={selectedApp}
          onValueChange={(v) =>
            updateSensor("framerate", { targetAppName: v === AUTO_OPTION ? "" : v })
          }
        >
          <SelectFieldTrigger label="Monitor app:">
            <SelectValue placeholder="Auto" />
          </SelectFieldTrigger>
          <SelectContent>
            <SelectItem value={AUTO_OPTION}>Auto</SelectItem>
            {appOptions.map((app) => (
              <SelectItem key={app} value={app}>
                {app}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-[var(--spacingXxxs)] text-[12px] font-medium leading-[15px] text-[var(--textParagraph1)]">
          <InfoIcon className="size-[16px] shrink-0" />
          <span>
            {presentMonApps.length > 0
              ? "Apps are auto updated every 10 seconds."
              : "No apps detected yet. Auto follows the app in focus."}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
