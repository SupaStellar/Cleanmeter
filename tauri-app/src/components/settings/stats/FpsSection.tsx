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
import { DEFAULT_SETTINGS } from "@/lib/types";
import { SectionCard } from "./SectionCard";

// Every reading this card owns, in the order the checkboxes appear. The card's
// master toggle stores and restores all of them, so a reading added later only
// has to be listed here rather than threaded through the toggle by hand.
const FPS_READINGS = [
  "framerate",
  "frametime",
  "onePercentLow",
  "zeroPointOnePercentLow",
] as const;
type FpsReading = (typeof FPS_READINGS)[number];

export function FpsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const presentMonApps = useSettingsStore((s) => s.presentMonApps);
  const { framerate, frametime, onePercentLow, zeroPointOnePercentLow } = settings.sensors;
  const anyEnabled = FPS_READINGS.some((key) => settings.sensors[key].isEnabled);
  const prevState = useRef<Record<FpsReading, boolean> | null>(null);
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
          prevState.current = Object.fromEntries(
            FPS_READINGS.map((key) => [key, settings.sensors[key].isEnabled]),
          ) as Record<FpsReading, boolean>;
          FPS_READINGS.forEach((key) => updateSensor(key, { isEnabled: false }));
        } else {
          const prev = prevState.current;
          // With nothing stored (the card was already off at launch), fall back
          // to each reading's shipped default rather than switching everything
          // on: the two percentile lows default to off, and a blanket `true`
          // here would enable readings the user never asked for.
          FPS_READINGS.forEach((key) =>
            updateSensor(key, {
              isEnabled: prev ? prev[key] : DEFAULT_SETTINGS.sensors[key].isEnabled,
            }),
          );
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
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={onePercentLow.isEnabled}
            onCheckedChange={(v) => updateSensor("onePercentLow", { isEnabled: v === true })}
          />
          <span className="text-[14px] font-medium text-foreground">1% Lows</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={zeroPointOnePercentLow.isEnabled}
            onCheckedChange={(v) =>
              updateSensor("zeroPointOnePercentLow", { isEnabled: v === true })
            }
          />
          <span className="text-[14px] font-medium text-foreground">0.1% Lows</span>
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
