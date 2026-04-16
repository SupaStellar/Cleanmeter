import { useRef } from "react";
import { Caption1, tokens } from "@fluentui/react-components";
import { Checkbox } from "@/components/ui/Checkbox";
import { SensorSection } from "@/components/ui/SensorSection";
import { Select } from "@/components/ui/Select";
import { useSettingsStore } from "@/stores/settings-store";
export function FpsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const presentMonApps = useSettingsStore((s) => s.presentMonApps);
  const { framerate, frametime } = settings.sensors;

  const anyEnabled = framerate.isEnabled || frametime.isEnabled;
  const prevState = useRef<{ framerate: boolean; frametime: boolean } | null>(null);

  return (
    <SensorSection
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
      <Checkbox
        label="Framerate"
        checked={framerate.isEnabled}
        onChange={(v) => updateSensor("framerate", { isEnabled: v })}
      />
      <Checkbox
        label="Frametime"
        checked={frametime.isEnabled}
        onChange={(v) => updateSensor("frametime", { isEnabled: v })}
      />
      <Caption1
        style={{
          color: tokens.colorNeutralForeground4,
          display: "block",
          marginTop: 4,
          lineHeight: 1.4,
        }}
      >
        FPS, frametime, and the graph only update while an app is actively
        rendering. A flat line on the graph means smooth performance, spikes
        indicate stutters. Values may freeze when the tracked app is minimized
        or closed.
      </Caption1>
      {presentMonApps.length > 0 && (
        <div className="mt-2">
          <Caption1
            style={{
              color: tokens.colorNeutralForeground4,
              display: "block",
              marginBottom: 4,
            }}
          >
            Tracks the active app automatically. To monitor a specific app, select it below:
          </Caption1>
          <Select
            label=""
            value={framerate.customReadingId}
            onChange={(v) => updateSensor("framerate", { customReadingId: v })}
            options={[
              { value: "", label: "Auto (active app)" },
              ...presentMonApps.map((app) => ({
                value: app,
                label: app,
              })),
            ]}
            placeholder="Auto (active app)"
          />
        </div>
      )}
    </SensorSection>
  );
}
