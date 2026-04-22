import { useEffect, useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { Checkbox } from "@/components/shadcn/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { SectionCard } from "@/components/settings/stats/SectionCard";
import { useSettingsStore } from "@/stores/settings-store";
import { POLLING_RATES } from "@/lib/types";
import { setAutoStart, getAutoStart, isBrowser } from "@/lib/tauri";
import { cn } from "@/lib/utils";

// ─── External links ────────────────────────────────────────────
function openUrl(url: string) {
  if (isBrowser) {
    window.open(url, "_blank");
  } else {
    import("@tauri-apps/plugin-shell").then((m) => m.open(url)).catch(() => {
      window.open(url, "_blank");
    });
  }
}

// ─── Brand icons (matching Figma 2075:8854 / 8866 / 8875) ──────
function GithubIcon() {
  return (
    <svg viewBox="0 0 22 22" className="size-[22px] text-foreground" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11 1.5a9.5 9.5 0 0 0-3 18.51c.47.09.65-.2.65-.45 0-.22-.01-.8-.01-1.57-2.64.57-3.2-1.27-3.2-1.27-.43-1.1-1.05-1.39-1.05-1.39-.86-.59.07-.58.07-.58.95.07 1.45.98 1.45.98.85 1.45 2.22 1.03 2.76.79.09-.61.33-1.03.6-1.27-2.11-.24-4.33-1.05-4.33-4.68 0-1.03.37-1.88.97-2.54-.1-.24-.42-1.2.09-2.51 0 0 .8-.26 2.6.97a9.06 9.06 0 0 1 4.74 0c1.8-1.23 2.6-.97 2.6-.97.51 1.31.19 2.27.09 2.51.6.66.97 1.51.97 2.54 0 3.64-2.22 4.44-4.34 4.67.34.3.64.87.64 1.75 0 1.26-.01 2.28-.01 2.59 0 .25.17.55.66.45A9.5 9.5 0 0 0 11 1.5Z"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 22 16" className="h-4 w-[22px]" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M18.636 1.34A18.1 18.1 0 0 0 14.097 0c-.196.332-.424.78-.58 1.135a16.9 16.9 0 0 0-5.039 0A11.6 11.6 0 0 0 7.896 0 18.3 18.3 0 0 0 3.353 1.34C.48 5.422-.3 9.398.09 13.319A18.3 18.3 0 0 0 5.66 16c.448-.58.848-1.196 1.192-1.845a12 12 0 0 1-1.878-.904c.157-.11.311-.224.461-.342 3.62 1.591 7.554 1.591 11.13 0 .15.118.304.232.46.342-.595.337-1.225.627-1.881.906.344.648.745 1.266 1.192 1.843a18.15 18.15 0 0 0 5.573-2.681c.457-4.545-.78-8.485-3.27-11.979ZM7.345 10.908c-1.087 0-1.978-.953-1.978-2.114 0-1.16.872-2.115 1.978-2.115s1.996.954 1.977 2.115c.002 1.16-.871 2.114-1.977 2.114Zm7.31 0c-1.088 0-1.978-.953-1.978-2.114 0-1.16.871-2.115 1.977-2.115s1.996.954 1.977 2.115c0 1.16-.87 2.114-1.977 2.114Z"
      />
    </svg>
  );
}

function KofiIcon() {
  return (
    <svg viewBox="0 0 25 20" className="h-5 w-[25px]" aria-hidden="true">
      <path
        fill="#FF5E5B"
        d="M23.42 4.3a6.3 6.3 0 0 0-1.87-1.72 7.05 7.05 0 0 0-3.14-.8H2.6a.72.72 0 0 0-.72.73v10.83c0 2.54 2.06 4.6 4.6 4.6h8.92a4.6 4.6 0 0 0 4.59-4.31 5.6 5.6 0 0 0 1.56.23c2.72 0 4.95-2.26 4.95-5.03a5.9 5.9 0 0 0-3.08-4.53ZM12.45 13.5c-.2.17-.46.26-.73.26a1.14 1.14 0 0 1-.73-.26c-1.17-.92-2.1-1.96-2.83-3.02a5.1 5.1 0 0 1-1.02-3.15c0-1.43 1.12-2.58 2.5-2.58.87 0 1.64.45 2.08 1.13a2.49 2.49 0 0 1 2.08-1.13c1.38 0 2.5 1.15 2.5 2.58 0 1.14-.35 2.2-1.02 3.15-.73 1.06-1.66 2.1-2.83 3.02Zm8.53-3.73a3.5 3.5 0 0 1-.97.14l-.4-.02V4.47h.4c1.96 0 3.55 1.19 3.55 2.65s-1.59 2.65-3.55 2.65Z"
      />
    </svg>
  );
}

// ─── Link row card ─────────────────────────────────────────────
function LinkCard({
  icon,
  label,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[56px] items-center gap-2 rounded-[12px] border border-border bg-card px-3",
        "transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-card">
        {icon}
      </span>
      <span className="text-[14px] font-medium text-foreground">{label}</span>
      <ChevronRight className="ml-auto size-5 text-muted-foreground" strokeWidth={2} />
    </button>
  );
}

// ─── Appearance style card ─────────────────────────────────────
function ThemeCard({
  label,
  variant,
  selected,
  onClick,
}: {
  label: string;
  variant: "light" | "dark" | "system";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col overflow-hidden rounded-[8px] bg-card transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected
          ? "border-2 border-foreground"
          : "border border-border hover:border-muted-foreground/40",
      )}
    >
      {/* Preview area */}
      <div className="flex h-[104px] items-center justify-center p-1">
        <div
          className={cn(
            "flex h-full w-full items-center justify-center overflow-hidden rounded-[4px]",
            variant === "light" && "bg-muted",
            variant === "dark" && "bg-[#0C111D]",
            variant === "system" && "relative bg-muted",
          )}
        >
          {variant === "system" && (
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[#0C111D]" />
          )}
        </div>
      </div>
      {/* Label bar */}
      <div className="flex h-[49px] items-center px-4">
        <span className="text-[14px] font-medium text-foreground">{label}</span>
      </div>
    </button>
  );
}

// ─── Main tab ──────────────────────────────────────────────────
export function AppSettingsTab() {
  const settings = useSettingsStore((s) => s.settings);
  const preferences = useSettingsStore((s) => s.preferences);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const updatePreferences = useSettingsStore((s) => s.updatePreferences);
  const appVersion = useSettingsStore((s) => s.appVersion);

  const [autoStart, setAutoStartState] = useState(false);

  useEffect(() => {
    getAutoStart()
      .then((v) => {
        if (v !== undefined) setAutoStartState(v);
      })
      .catch(() => {});
  }, []);

  const handleAutoStart = (enabled: boolean) => {
    setAutoStartState(enabled);
    setAutoStart(enabled).catch(() => setAutoStartState(!enabled));
  };

  // Keep `isDarkTheme` in sync with the OS when themeMode is "system".
  useEffect(() => {
    if (settings.themeMode !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => {
      if (useSettingsStore.getState().settings.isDarkTheme !== matches) {
        updateSettings({ isDarkTheme: matches });
      }
    };
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.themeMode, updateSettings]);

  const handleThemeMode = (mode: "light" | "dark" | "system") => {
    if (mode === "light") {
      updateSettings({ themeMode: "light", isDarkTheme: false });
    } else if (mode === "dark") {
      updateSettings({ themeMode: "dark", isDarkTheme: true });
    } else {
      const prefersDark =
        typeof window !== "undefined" &&
        !!window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      updateSettings({ themeMode: "system", isDarkTheme: prefersDark });
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-4 p-6 pb-3">
        {/* GENERAL */}
        <SectionCard title="General">
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={autoStart}
                onCheckedChange={(v) => handleAutoStart(v === true)}
              />
              <span className="text-[14px] font-medium text-foreground">
                Start with windows
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={preferences.startMinimized}
                onCheckedChange={(v) =>
                  updatePreferences({ startMinimized: v === true })
                }
              />
              <span className="text-[14px] font-medium text-foreground">
                Start minimized
              </span>
            </label>
          </div>
        </SectionCard>

        {/* TEMPERATURE UNITS */}
        <SectionCard title="Temperature units">
          <RadioGroup
            value={settings.temperatureUnit}
            onValueChange={(v) =>
              updateSettings({ temperatureUnit: v as "C" | "F" })
            }
            className="flex flex-col gap-3"
          >
            <label className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem value="C" id="temp-c" />
              <span className="text-[14px] font-medium text-foreground">
                Celsius °C
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem value="F" id="temp-f" />
              <span className="text-[14px] font-medium text-foreground">
                Fahrenheit °F
              </span>
            </label>
          </RadioGroup>
        </SectionCard>

        {/* POLLING RATE */}
        <SectionCard title="Polling rate">
          <div className="flex flex-col gap-3">
            <Select
              value={String(settings.pollingRate)}
              onValueChange={(v) => updateSettings({ pollingRate: parseInt(v) })}
            >
              <SelectTrigger className="h-10 w-full rounded-[8px] bg-card text-[14px] font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLLING_RATES.map((rate) => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate}ms
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
              <Info className="size-4" strokeWidth={2} />
              <span>The interval in milliseconds the app will update data</span>
            </div>
          </div>
        </SectionCard>

        {/* APPEARANCE */}
        <SectionCard title="Appearance">
          <div className="flex gap-3">
            <ThemeCard
              label="Light"
              variant="light"
              selected={settings.themeMode === "light"}
              onClick={() => handleThemeMode("light")}
            />
            <ThemeCard
              label="Dark"
              variant="dark"
              selected={settings.themeMode === "dark"}
              onClick={() => handleThemeMode("dark")}
            />
            <ThemeCard
              label="System"
              variant="system"
              selected={settings.themeMode === "system"}
              onClick={() => handleThemeMode("system")}
            />
          </div>
        </SectionCard>
      </div>

      {/* External link buttons */}
      <div className="flex flex-col gap-3 px-6">
        <LinkCard
          icon={<GithubIcon />}
          label="Check the latest build"
          onClick={() => openUrl("https://github.com/apyfz/CleanMeter")}
        />
        <div className="flex gap-3">
          <LinkCard
            className="flex-1"
            icon={<DiscordIcon />}
            label="Join the discord server!"
            onClick={() => openUrl("https://discord.gg/cleanmeter")}
          />
          <LinkCard
            className="flex-1"
            icon={<KofiIcon />}
            label="Like the work? Support us!"
            onClick={() => openUrl("https://ko-fi.com/apyfz")}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between px-6 pb-6 text-[12px] font-medium text-subtle-foreground">
        <span>Built by Danil &amp; designed by Mars</span>
        <span>Version v{appVersion}</span>
      </div>
    </div>
  );
}
