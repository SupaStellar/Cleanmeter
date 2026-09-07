import { usePlatformStore } from "@/stores/platform-store";
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
  const platform = usePlatformStore((s) => s.platform);
  const readings = FPS_READINGS.filter((key) => platform.percentileLows || key === "framerate" || key === "frametime");
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const presentMonApps = useSettingsStore((s) => s.presentMonApps);
  const { framerate, frametime, onePercentLow, zeroPointOnePercentLow } = settings.sensors;
  const anyEnabled = readings.some((key) => settings.sensors[key].isEnabled);
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
            readings.map((key) => [key, settings.sensors[key].isEnabled]),
          ) as Record<FpsReading, boolean>;
          readings.forEach((key) => updateSensor(key, { isEnabled: false }));
        } else {
          const prev = prevState.current;
          // With nothing stored (the card was already off at launch), fall back
          // to each reading's shipped default rather than switching everything
          // on: the two percentile lows default to off, and a blanket `true`
          // here would enable readings the user never asked for.
          readings.forEach((key) =>
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
          <span className="text-[14px] font-medium text-foreground">Frame Count</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={frametime.isEnabled}
            onCheckedChange={(v) => updateSensor("frametime", { isEnabled: v === true })}
          />
          <span className="text-[14px] font-medium text-foreground">Frame Time Graph</span>
        </label>
        {/* Flat rows, no expander. These briefly carried the recording
            binder, one copy under each low, because the run they scope is the
            same for both. Figma 2819:8960 moved that binding to the Settings
            Shortcuts card instead, which is the better place for exactly that
            reason: one key, bound once, rather than the same field mirrored
            into two rows that had to stay in sync. */}
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={platform.percentileLows && onePercentLow.isEnabled}
            disabled={!platform.percentileLows}
            onCheckedChange={(v) => updateSensor("onePercentLow", { isEnabled: v === true })}
          />
          <span className="text-[14px] font-medium text-foreground">1% Low</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={platform.percentileLows && zeroPointOnePercentLow.isEnabled}
            disabled={!platform.percentileLows}
            onCheckedChange={(v) =>
              updateSensor("zeroPointOnePercentLow", { isEnabled: v === true })
            }
          />
          <span className="text-[14px] font-medium text-foreground">0.1% Low</span>
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
          <SelectFieldTrigger label="Selected:">
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
            {platform.os === "linux"
              ? "Auto uses the most recently updated game. Select a game to keep its readings pinned."
              : presentMonApps.length > 0
                ? "Apps are auto updated every 10 seconds."
                : "No apps detected yet. Auto follows the app in focus."}
          </span>
        </div>
      </div>
      {platform.os === "linux" && (
        <div className="flex flex-col gap-2 text-[13px] text-muted-foreground">
          <p>Install MangoHud 0.7.0 or newer, then launch your game with <code>cleanmeter-run</code>. Steam launch options:</p>
          <code className="select-text rounded bg-muted p-2">cleanmeter-run %command%</code>
          <p>Using AppImage? Run <code>./Cleanmeter.AppImage --run your-game</code> instead.</p>
          <p>FPS and frametime are sampled every 100 ms. Percentile lows and benchmark recording require per-frame capture and are unavailable in this Linux preview.</p>
          {presentMonApps.length === 0 && <p>No game telemetry yet. Start a game with the launcher above.</p>}
        </div>
      )}
    </SectionCard>
  );
}
