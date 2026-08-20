import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Checkbox } from "@/components/shadcn/checkbox";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Switch } from "@/components/shadcn/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/shadcn/select";
import { SelectFieldTrigger } from "@/components/ui/SelectField";
import { cn } from "@/lib/utils";
import { getAutoStart, setAutoStart } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";
import { useUpdaterStore } from "@/stores/updater-store";
import { POLLING_RATES } from "@/lib/types";
import type { TemperatureUnit } from "@/lib/types";
import {
  BrowserUpdatedIcon,
  ChevronRightIcon,
  ComputerIcon,
  DiscordIcon,
  InfoIcon,
  ThemePreviewDark,
  ThemePreviewLight,
  ThemePreviewSystem,
} from "./icons";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-[var(--spacingL)] rounded-[var(--cornerXl)] bg-[var(--bgSurfaceRaised)] p-[var(--spacingL)]">
      <h2 className="text-[13px] font-semibold uppercase leading-[16px] tracking-[0.1em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function GeneralSection() {
  const startMinimized = useSettingsStore((s) => s.preferences.startMinimized);
  const updatePreferences = useSettingsStore((s) => s.updatePreferences);
  const pixelShift = useSettingsStore((s) => s.settings.pixelShift);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [startWithWindows, setStartWithWindows] = React.useState(false);
  // Rapid toggles fire concurrent setAutoStart calls that can resolve out
  // of order, leaving the checkbox out of sync with the OS registry.
  // Gate clicks while one is in flight.
  const [autoStartPending, setAutoStartPending] = React.useState(false);

  React.useEffect(() => {
    getAutoStart()
      .then((v) => {
        if (v !== undefined) setStartWithWindows(v);
      })
      .catch(() => {});
  }, []);

  const handleStartWithWindows = (enabled: boolean) => {
    setAutoStartPending(true);
    setStartWithWindows(enabled);
    setAutoStart(enabled)
      .catch(() => setStartWithWindows(!enabled))
      .finally(() => setAutoStartPending(false));
  };

  return (
    <SectionCard title="General">
      {/* Three blocks, laid out by the card's own 20 gap rather than a wrapper
          of its own: Figma 2526:6755 puts the checkboxes, the divider and the
          Pixel Shift row 20 apart. */}
      <div className="flex flex-col gap-[var(--spacingS)]">
        <label className="flex cursor-pointer items-center gap-[var(--spacingXs)] text-[14px] font-medium text-foreground">
            <Checkbox
              checked={startWithWindows}
              disabled={autoStartPending}
              onCheckedChange={(v) => handleStartWithWindows(v === true)}
            />
          Start with windows
        </label>
        <label className="flex cursor-pointer items-center gap-[var(--spacingXs)] text-[14px] font-medium text-foreground">
          <Checkbox
            checked={startMinimized}
            onCheckedChange={(v) =>
              updatePreferences({ startMinimized: v === true })
            }
          />
          Start minimized
        </label>
      </div>
      <div className="h-px w-full shrink-0 bg-[var(--borderSubtle)]" />
      <div className="flex items-center gap-[var(--spacingS)]">
        <div className="flex size-[40px] shrink-0 items-center justify-center rounded-[var(--cornerRound)] border border-[var(--borderBold)] bg-[var(--bgSurfaceRaised)]">
          {/* No optical nudge: the exported glyph carries Figma's own 1.67
              inset inside a 20 box, so centring the box centres the glyph. */}
          <ComputerIcon className="size-[20px] text-[var(--textParagraph1)]" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <span className="text-[14px] font-medium leading-[17px] text-[var(--textHeading)]">
            Pixel Shift
          </span>
          <span className="text-[14px] font-normal leading-[17px] text-[var(--textParagraph1)]">
            Shifts the overlay periodically to avoid OLED burn-in.
          </span>
        </div>
        <Switch
          checked={pixelShift}
          onCheckedChange={(v) => updateSettings({ pixelShift: v })}
          aria-label="Pixel Shift"
        />
      </div>
    </SectionCard>
  );
}

// Figma 2075:8785/2075:8789 — radio uses solid fills, not the standard
// border+dot style. Outer 19.2×19.2. Unchecked: #CECFD2 outer with 15.6×15.6
// white centered (gives a 1.8px gray ring). Checked: #0C111D outer with
// 9.6×9.6 white centered (dark filled with a small white dot).
function FigmaRadio({ value }: { value: string }) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      className={cn(
        "group relative size-[19.2px] shrink-0 rounded-full",
        "bg-[var(--bgSurfaceSunken)] data-[state=checked]:bg-[var(--bgBrand)]",
        "transition-colors duration-150 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      <span
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bgSurfaceRaised)]",
          "size-[15.6px] group-data-[state=checked]:size-[9.6px]",
          "transition-[width,height] duration-150 ease-out motion-reduce:transition-none",
        )}
      />
    </RadioGroupPrimitive.Item>
  );
}

function TemperatureUnitsSection() {
  const temperatureUnit = useSettingsStore((s) => s.settings.temperatureUnit);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <SectionCard title="Temperature units">
      <RadioGroup
        value={temperatureUnit}
        onValueChange={(v) =>
          updateSettings({ temperatureUnit: v as TemperatureUnit })
        }
        className="flex flex-col gap-3"
      >
        <label className="flex cursor-pointer items-center gap-2 text-[14px] font-medium text-foreground">
          <FigmaRadio value="C" />
          Celsius °C
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[14px] font-medium text-foreground">
          <FigmaRadio value="F" />
          Fahrenheit °F
        </label>
      </RadioGroup>
    </SectionCard>
  );
}

function PollingRateSection() {
  const pollingRate = useSettingsStore((s) => s.settings.pollingRate);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <SectionCard title="Polling rate">
      <div className="flex flex-col gap-[var(--spacingS)]">
        <Select
          value={String(pollingRate)}
          onValueChange={(v) =>
            updateSettings({ pollingRate: parseInt(v, 10) })
          }
        >
          <SelectFieldTrigger label="Polling rate:">
            <SelectValue />
          </SelectFieldTrigger>
          <SelectContent>
            {POLLING_RATES.map((rate) => (
              <SelectItem key={rate} value={String(rate)}>
                {rate}ms
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-[var(--spacingXxxs)] text-[12px] font-medium leading-[15px] text-[var(--textParagraph1)]">
          <InfoIcon className="size-[16px] shrink-0" />
          <span>The interval in milliseconds the app will update data</span>
        </div>
      </div>
    </SectionCard>
  );
}

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS: {
  value: ThemeChoice;
  label: string;
  Preview: () => React.JSX.Element;
}[] = [
  { value: "light", label: "Light", Preview: ThemePreviewLight },
  { value: "dark", label: "Dark", Preview: ThemePreviewDark },
  { value: "system", label: "System", Preview: ThemePreviewSystem },
];

function AppearanceSection() {
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  React.useEffect(() => {
    if (themeMode !== "system") return;
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
  }, [themeMode, updateSettings]);

  const handleThemeChange = (value: ThemeChoice) => {
    if (value === "light") {
      updateSettings({ themeMode: "light", isDarkTheme: false });
    } else if (value === "dark") {
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
    <SectionCard title="Appearance">
      {/* Figma 2526:6791: three cards 12 apart, each a 104 preview over a 49
          label row. The border is an inset shadow rather than a real border so
          the 2 of a selected card does not resize the content. */}
      <div className="flex gap-[var(--spacingS)]">
        {THEME_OPTIONS.map(({ value, label, Preview }) => {
          const selected = themeMode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleThemeChange(value)}
              className={cn(
                "flex flex-1 flex-col overflow-hidden rounded-[8px] bg-[var(--bgSurfaceRaised)] transition-shadow duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
              style={{
                boxShadow: selected
                  ? "inset 0 0 0 2px var(--borderBrand), 0 4px 8px 0 rgba(0,0,0,0.02)"
                  // Border/Bold already carries alpha, and Figma halves it
                  // again with a 50% stroke opacity on the layer. Mixing the
                  // token toward transparent reproduces that in both themes
                  // instead of hardcoding one theme's result.
                  : "inset 0 0 0 1px color-mix(in srgb, var(--borderBold) 50%, transparent), 0 4px 8px 0 rgba(0,0,0,0.02)",
              }}
            >
              <div className="h-[104px] w-full pb-0 pl-[4px] pr-[4px] pt-[4px]">
                <Preview />
              </div>
              <div className="flex h-[49px] items-center px-[var(--spacingM)] text-[14px] font-medium leading-[17px] text-[var(--textHeading)]">
                {label}
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

function FooterLinkButton({
  icon,
  label,
  href,
  onClick,
  disabled,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const className = cn(
    "flex flex-1 items-center justify-between gap-3 rounded-[12px] border border-[var(--borderBolder)]/50 p-3",
    "transition-colors",
    disabled
      ? "cursor-not-allowed opacity-50"
      : "hover:border-[var(--borderBolder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  );
  const content = (
    <>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-[14px] font-medium text-foreground">{label}</span>
      </div>
      <ChevronRightIcon className="size-5 text-muted-foreground" />
    </>
  );

  if (disabled) {
    return (
      <div className={className} aria-disabled="true" title={title}>
        {content}
      </div>
    );
  }

  // An action button (e.g. trigger the in-app update check) vs an external link.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, "text-left")}>
        {content}
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  );
}

// Canonical invite to the official Cleanmeter community server, set to never
// expire (the invite this replaced had lapsed and returned Unknown Invite).
const DISCORD_INVITE_URL = "https://discord.gg/SCgXtTMNvJ";

// Triggers an in-app update check and reflects the updater status in its label.
// The actual "download & install" happens from the floating UpdateBanner.
function UpdatesButton() {
  const status = useUpdaterStore((s) => s.status);
  const dismissed = useUpdaterStore((s) => s.dismissed);
  const check = useUpdaterStore((s) => s.check);

  const busy =
    status === "checking" ||
    status === "downloading" ||
    status === "installing";

  // "ready" is deliberately not busy: a downloaded update whose pill was
  // dismissed is brought back by pressing this, which is what check() does
  // when it sees that status.
  //
  // The two labels that point at the pill only apply while the pill is on
  // screen. Once it has been dismissed they would be pointing at nothing, so
  // the button goes back to inviting the press that brings it back.
  const pending = (status === "available" || status === "ready") && !dismissed;

  const label =
    status === "checking"
      ? "Checking for updates…"
      : pending && status === "available"
        ? "Update available!"
        : pending
          ? "Update ready to install"
          : status === "downloading" || status === "installing"
            ? "Updating…"
            : status === "uptodate"
              ? "You're on the latest version"
              : status === "error"
                ? "Couldn't check, try again"
                : "Check for latest updates";

  return (
    <FooterLinkButton
      icon={<BrowserUpdatedIcon className="size-8" />}
      label={label}
      onClick={busy ? undefined : () => check({ silent: false })}
      disabled={busy}
      title={label}
    />
  );
}

export function SettingsTab() {
  const appVersion = useSettingsStore((s) => s.appVersion);

  return (
    <div className="flex h-full w-full flex-col gap-[var(--spacingL)]">
      <div className="flex w-full flex-col gap-[var(--spacingM)]">
        <GeneralSection />
        <TemperatureUnitsSection />
        <PollingRateSection />
        <AppearanceSection />
      </div>
      <div className="flex w-full flex-col gap-6">
        <div className="flex gap-3">
          <UpdatesButton />
          <FooterLinkButton
            icon={<DiscordIcon className="size-8" />}
            label="Join the discord server!"
            href={DISCORD_INVITE_URL}
          />
        </div>
        <div className="flex items-center justify-between text-[12px] font-medium text-subtle-foreground">
          <span>Built by Team Crispy</span>
          <span>Version v{appVersion} beta</span>
        </div>
      </div>
    </div>
  );
}
